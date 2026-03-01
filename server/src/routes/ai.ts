import { Router } from "express";
import net from "net";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { buildPrompt, parseDataUrl, extractJson } from "../utils/ai-helper";

const router = Router();

// 延迟读取环境变量的 helper —— 确保在 dotenv.config() 之后才取值
// （模块顶层常量在 import 阶段就固化，可能早于 dotenv 加载）
function getServerAiKey() { return process.env.SERVER_AI_KEY || ""; }
function getAiBaseUrl() { return process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta"; }
function getProxyUrl() { return process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ""; }

// ---- 本地代理自动探测 ----
const LOCAL_PROXY = "http://127.0.0.1:7890";
let _probeResult: boolean | null = null;  // null=未探测, true=可用, false=不可用

/** 探测本地 7890 端口是否在监听（仅执行一次，200ms 超时） */
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

// 缓存 ProxyAgent 实例，避免每次请求都创建
let _cachedProxyUrl: string | null = null;
let _cachedDispatcher: ProxyAgent | undefined;
function buildDispatcher(url: string): ProxyAgent | undefined {
  if (url !== _cachedProxyUrl) {
    _cachedProxyUrl = url;
    _cachedDispatcher = url ? new ProxyAgent(url) : undefined;
  }
  return _cachedDispatcher;
}

/**
 * 获取当前应使用的代理 dispatcher
 * 优先级：环境变量 > 本地 7890 自动探测（仅非 production）
 */
async function getProxyDispatcher(): Promise<ProxyAgent | undefined> {
  const envProxy = getProxyUrl();
  if (envProxy) return buildDispatcher(envProxy);
  // 非 production 时自动探测本地常见代理端口
  if (process.env.NODE_ENV !== "production") {
    const ok = await probeLocalProxy();
    if (ok) return buildDispatcher(LOCAL_PROXY);
  }
  return undefined;
}

// AI 状态端点 (无需认证)
router.get("/status", (_req, res) => {
  res.json({ serverAi: !!getServerAiKey() });
});

router.post("/parse-receipt", async (req: any, res: any) => {
  console.log("[AI] /parse-receipt hit");  // 路由入口日志
  try {
    const { image, apiKey: clientApiKey, model, categories } = req.body;

    const serverKey = getServerAiKey();
    // 优先使用服务端密钥，不泄露给前端
    const apiKey = serverKey || clientApiKey;

    if (!image || !apiKey) {
      console.log("[AI] 400: missing image or apiKey", { hasImage: !!image, hasApiKey: !!apiKey });
      res.status(400).json({ error: "缺少图片或 API Key" });
      return;
    }

    const modelName = model || "gemini-2.0-flash";
    
    // 针对 Thinking 模型或 Gemini 3 系列（可能包含思考过程），移除 JSON 强制模式
    // 这样可以避免 "Mode not supported" 或输出截断错误
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
        maxOutputTokens: 8192, // 增加 Token 上限以容纳思考过程
        ...(isComplexModel ? {} : { response_mime_type: "application/json" }),
      },
    };

    const proxyUrl = getProxyUrl();
    const dispatcher = await getProxyDispatcher();
    const actualProxy = dispatcher ? (_cachedProxyUrl || proxyUrl) : "(none)";
    console.log("[AI] request:", {
      model: modelName,
      mimeType,
      base64Length: base64.length,
      baseUrl,
      proxy: actualProxy,
    });

    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (i > 0) console.log(`[AI] Retry attempt ${i + 1}...`);

        const response = await undiciFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          dispatcher,
        });

        if (!response.ok) {
          const errBody = await response.text();
          console.error(`[AI] Gemini API error (Attempt ${i + 1}):`, response.status, errBody);
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
        console.warn(`[AI] Attempt ${i + 1}: valid response but failed to extract JSON from:`, content.substring(0, 200));
      } catch (err) {
        console.error(`[AI] Attempt ${i + 1} failed:`, err);
      }
    }

    console.error("[AI] All 3 retries exhausted");
    res.status(500).json({ error: "AI 识别失败，已重试 3 次" });
  } catch (error: any) {
    console.error("[AI] parse-receipt uncaught error:", error);
    res.status(500).json({
      error: "AI 识别失败",
      detail: error.message || String(error)
    });
  }
});

export default router;
