import { Router } from "express";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { buildPrompt, parseDataUrl, extractJson } from "../utils/ai-helper";

const router = Router();

const SERVER_AI_KEY = process.env.SERVER_AI_KEY || "";
const AI_BASE_URL = process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const PROXY_URL = process.env.HTTP_PROXY || "";
const proxyDispatcher = PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;

// AI 状态端点 (无需认证)
router.get("/status", (_req, res) => {
  res.json({ serverAi: !!SERVER_AI_KEY });
});

router.post("/parse-receipt", async (req: any, res: any) => {
  try {
    const { image, apiKey: clientApiKey, model, categories } = req.body;

    // 优先使用服务端密钥，不泄露给前端
    const apiKey = SERVER_AI_KEY || clientApiKey;

    if (!image || !apiKey) {
      res.status(400).json({ error: "缺少图片或 API Key" });
      return;
    }

    const modelName = model || "gemini-2.0-flash";
    
    // 针对 Thinking 模型或 Gemini 3 系列（可能包含思考过程），移除 JSON 强制模式
    // 这样可以避免 "Mode not supported" 或输出截断错误
    const isComplexModel = modelName.includes("thinking") || modelName.includes("gemini-3");

    const prompt = buildPrompt(categories);
    const { mimeType, base64 } = parseDataUrl(image);

    // 使用配置的 Base URL
    const url = `${AI_BASE_URL}/models/${modelName}:generateContent?key=${apiKey}`;

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

    console.log("AI request:", { model: modelName, mimeType, base64Length: base64.length });

    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (i > 0) console.log(`Retry attempt ${i + 1}...`);

        const response = await undiciFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          dispatcher: proxyDispatcher,
        });

        if (!response.ok) {
          const errBody = await response.text();
          console.error(`Gemini API error (Attempt ${i + 1}):`, response.status, errBody);
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
          res.json(parsed);
          return;
        }
      } catch (err) {
        console.error(`Attempt ${i + 1} failed:`, err);
      }
    }

    res.status(500).json({ error: "AI 识别失败，已重试 3 次" });
  } catch (error: any) {
    console.error("AI parse error:", error);
    res.status(500).json({
      error: "AI 识别失败",
      detail: error.message || String(error)
    });
  }
});

export default router;
