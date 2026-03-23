import { Router } from "express";
import net from "net";
import rateLimit from "express-rate-limit";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { buildPrompt, parseDataUrl, extractJson } from "../utils/ai-helper";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();
const DEFAULT_MODEL = "gemini-2.0-flash";
const ALLOWED_MODELS = new Set([
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-3-flash-preview",
]);
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_RECEIPT_IMAGE_BYTES = 5 * 1024 * 1024;

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 24,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return authReq.user?.id ? `user:${authReq.user.id}` : "anonymous";
  },
  message: { error: "AI 请求过于频繁，请稍后再试" },
});

function getServerAiKey() {
  return process.env.SERVER_AI_KEY || "";
}

function getAiBaseUrl() {
  return process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
}

function getProxyUrl() {
  return process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function getBase64ByteLength(base64: string) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

const LOCAL_PROXY = "http://127.0.0.1:7890";
let probeResult: boolean | null = null;

function probeLocalProxy(): Promise<boolean> {
  if (probeResult !== null) return Promise.resolve(probeResult);

  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: 7890 }, () => {
      socket.destroy();
      probeResult = true;
      resolve(true);
    });

    socket.on("error", () => {
      probeResult = false;
      resolve(false);
    });

    socket.setTimeout(200, () => {
      socket.destroy();
      probeResult = false;
      resolve(false);
    });
  });
}

let cachedProxyUrl: string | null = null;
let cachedDispatcher: ProxyAgent | undefined;

function buildDispatcher(url: string): ProxyAgent | undefined {
  if (url !== cachedProxyUrl) {
    cachedProxyUrl = url;
    cachedDispatcher = url ? new ProxyAgent(url) : undefined;
  }
  return cachedDispatcher;
}

async function getProxyDispatcher(): Promise<ProxyAgent | undefined> {
  const envProxy = getProxyUrl();
  if (envProxy) return buildDispatcher(envProxy);

  if (!isProduction()) {
    const ok = await probeLocalProxy();
    if (ok) return buildDispatcher(LOCAL_PROXY);
  }

  return undefined;
}

router.get("/status", (_req, res) => {
  res.json({ serverAi: !!getServerAiKey() });
});

router.get("/debug", authenticateToken, async (_req, res) => {
  if (isProduction()) {
    res.sendStatus(404);
    return;
  }

  const info: Record<string, unknown> = {
    NODE_ENV: process.env.NODE_ENV || "(unset)",
    AI_BASE_URL: getAiBaseUrl(),
    SERVER_AI_KEY_SET: !!getServerAiKey(),
    proxyConfigured: !!getProxyUrl(),
    probeResult,
  };

  try {
    const dispatcher = await getProxyDispatcher();
    info.dispatcherActive = !!dispatcher;
  } catch (error: any) {
    info.proxyError = error.message;
  }

  res.json(info);
});

router.post("/parse-receipt", authenticateToken, aiLimiter, async (req: AuthRequest, res: any) => {
  try {
    const { image, apiKey: clientApiKey, model, categories } = req.body ?? {};
    const serverKey = getServerAiKey();
    const apiKey = serverKey || clientApiKey;

    if (typeof image !== "string" || !image || !apiKey) {
      console.warn("[AI] 400: missing image or apiKey", {
        hasImage: typeof image === "string" && image.length > 0,
        hasKey: !!apiKey,
        serverKeySet: !!serverKey,
      });
      res.status(400).json({ error: "缺少图片或 API Key" });
      return;
    }

    const modelName = typeof model === "string" && model.trim() ? model.trim() : DEFAULT_MODEL;
    if (!ALLOWED_MODELS.has(modelName)) {
      res.status(400).json({ error: "不支持的 AI 模型" });
      return;
    }

    const prompt = buildPrompt(categories);
    const { mimeType, base64 } = parseDataUrl(image);

    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      res.status(400).json({ error: "不支持的图片格式" });
      return;
    }

    if (getBase64ByteLength(base64) > MAX_RECEIPT_IMAGE_BYTES) {
      res.status(413).json({ error: "图片过大，请压缩后再试" });
      return;
    }

    const baseUrl = getAiBaseUrl();
    const url = `${baseUrl}/models/${modelName}:generateContent?key=${apiKey}`;
    const isComplexModel = modelName.includes("thinking") || modelName.includes("gemini-3");
    const body = {
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        ...(isComplexModel ? {} : { response_mime_type: "application/json" }),
      },
    };

    const dispatcher = await getProxyDispatcher();
    console.log("[AI] request:", {
      model: modelName,
      mimeType,
      base64Length: base64.length,
      proxyEnabled: !!dispatcher,
    });

    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (i > 0) console.log(`[AI] retry ${i + 1}...`);

        const response = await undiciFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          dispatcher,
        });

        if (!response.ok) {
          const errBody = await response.text();
          console.error(`[AI] Gemini API error (attempt ${i + 1}):`, response.status, errBody.substring(0, 300));

          if (response.status >= 400 && response.status < 500) {
            const payload: Record<string, string> = {
              error: `AI 接口调用失败 (${response.status})`,
            };
            if (!isProduction()) payload.detail = errBody.substring(0, 300);
            res.status(response.status).json(payload);
            return;
          }

          throw new Error(`API Error ${response.status}`);
        }

        const data = await response.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };

        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = extractJson(content);

        if (parsed) {
          console.log("[AI] success, items:", Array.isArray((parsed as any).items) ? (parsed as any).items.length : "N/A");
          res.json(parsed);
          return;
        }

        console.warn(`[AI] attempt ${i + 1}: extractJson returned null, content preview:`, content.substring(0, 200));
      } catch (error) {
        console.error(`[AI] attempt ${i + 1} failed:`, error);
      }
    }

    console.error("[AI] all 3 retries exhausted");
    res.status(500).json({ error: "AI 识别失败，已重试 3 次" });
  } catch (error: any) {
    console.error("[AI] uncaught error:", error);
    const payload: Record<string, string> = { error: "AI 识别失败" };
    if (!isProduction()) payload.detail = error.message || String(error);
    res.status(500).json(payload);
  }
});

export default router;
