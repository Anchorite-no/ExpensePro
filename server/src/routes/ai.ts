import { Router } from "express";
import net from "net";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { buildPrompt, parseDataUrl, extractJson } from "../utils/ai-helper";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// ---- 延迟读取环境变量 ----
// 模块顶层常量在 import 阶段就固化，可能早于 dotenv.config() 执行
// 改为函数调用，确保每次取值都读到最新的 process.env
function getServerAiKey() { return process.env.SERVER_AI_KEY || ""; }
function getAiBaseUrl() { return process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta"; }
function getProxyUrl() { return process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ""; }

// ---- 本地代理自动探测（仅非 production） ----
const LOCAL_PROXY = "http://127.0.0.1:7890";
let _probeResult: boolean | null = null;

function probeLocalProxy(): Promise<boolean> {
  if (_probeResult !== null) return Promise.resolve(_probeResult);
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: 7890 }, () => {
      socket.destroy();
      _probeResult = true;
      resolve(true);
    });
    socket.on("error", () => { _probeResult = false; resolve(false); });
    socket.setTimeout(200, () => { socket.destroy(); _probeResult = false; resolve(false); });
  });
}

// 缓存 ProxyAgent 避免重复创建
let _cachedProxyUrl: string | null = null;
let _cachedDispatcher: ProxyAgent | undefined;
function buildDispatcher(url: string): ProxyAgent | undefined {
  if (url !== _cachedProxyUrl) {
    _cachedProxyUrl = url;
    _cachedDispatcher = url ? new ProxyAgent(url) : undefined;
  }
  return _cachedDispatcher;
}

async function getProxyDispatcher(): Promise<ProxyAgent | undefined> {
  const envProxy = getProxyUrl();
  if (envProxy) return buildDispatcher(envProxy);
  if (process.env.NODE_ENV !== "production") {
    const ok = await probeLocalProxy();
    if (ok) return buildDispatcher(LOCAL_PROXY);
  }
  return undefined;
}

// AI 状态端点
router.get("/status", (_req, res) => {
  res.json({ serverAi: !!getServerAiKey() });
});

// 诊断端点（需要登录，避免暴露服务器代理配置等信息）
router.get("/debug", authenticateToken, async (_req, res) => {
  const info: Record<string, any> = {
    NODE_ENV: process.env.NODE_ENV || "(unset)",
    AI_BASE_URL: getAiBaseUrl(),
    SERVER_AI_KEY_SET: !!getServerAiKey(),
    HTTPS_PROXY: process.env.HTTPS_PROXY || "(empty)",
    HTTP_PROXY: process.env.HTTP_PROXY || "(empty)",
    probeResult: _probeResult,
  };
  try {
    const dispatcher = await getProxyDispatcher();
    info.dispatcherActive = !!dispatcher;
    info.cachedProxyUrl = _cachedProxyUrl;
  } catch (e: any) {
    info.proxyError = e.message;
  }
  res.json(info);
});

// 小票识别主端点
router.post("/parse-receipt", async (req: any, res: any) => {
  try {
    const { image, apiKey: clientApiKey, model, categories } = req.body;

    const serverKey = getServerAiKey();
    const apiKey = serverKey || clientApiKey;

    if (!image || !apiKey) {
      console.warn("[AI] 400: missing image or apiKey", { hasImage: !!image, hasKey: !!apiKey, serverKeySet: !!serverKey });
      res.status(400).json({ error: "缺少图片或 API Key" });
      return;
    }

    const modelName = model || "gemini-2.0-flash";
    const isComplexModel = modelName.includes("thinking") || modelName.includes("gemini-3");

    const prompt = buildPrompt(categories);
    const { mimeType, base64 } = parseDataUrl(image);

    const baseUrl = getAiBaseUrl();
    const url = `${baseUrl}/models/${modelName}:generateContent?key=${apiKey}`;

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
    console.log("[AI] request:", { model: modelName, mimeType, base64Length: base64.length, proxy: _cachedProxyUrl || "(none)" });

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
            res.status(response.status).json({ error: `AI 接口调用失败 (${response.status})`, detail: errBody });
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
      } catch (err) {
        console.error(`[AI] attempt ${i + 1} failed:`, err);
      }
    }

    console.error("[AI] all 3 retries exhausted");
    res.status(500).json({ error: "AI 识别失败，已重试 3 次" });
  } catch (error: any) {
    console.error("[AI] uncaught error:", error);
    res.status(500).json({
      error: "AI 识别失败",
      detail: error.message || String(error),
    });
  }
});

export default router;
