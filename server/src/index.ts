import express from "express";
import cors from "cors";
import { db } from "./db";
import { expenses, users, userSettings } from "./db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import path from "path";

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-it";

// 代理配置 (优先使用环境变量，否则在非生产环境默认尝试本地代理)
const PROXY_URL = process.env.HTTP_PROXY || (process.env.NODE_ENV === 'production' ? "" : "http://127.0.0.1:7890");
const proxyDispatcher = PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;

// AI Base URL 配置 (默认为官方地址，可通过环境变量覆盖以使用代理)
const AI_BASE_URL = process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";

app.use(cors());
app.use(express.json({ limit: "20mb" }));

// Middleware to authenticate token
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ========== Auth API ==========

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "请输入用户名和密码" });
      return;
    }

    // 密码强度校验：至少8位，包含至少两种字符类型
    if (password.length < 8) {
      res.status(400).json({ error: "密码长度至少需要 8 位" });
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    if ([hasLetter, hasNumber, hasSpecial].filter(Boolean).length < 2) {
      res.status(400).json({ error: "密码必须包含至少两种类型的字符（字母、数字、符号）" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 先查询用户名是否已存在（主动检查，不依赖数据库错误码）
    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existingUser.length > 0) {
      res.status(409).json({ error: "该用户名已被注册" });
      return;
    }

    // Check if this is the first user (for legacy data migration)
    const existingUsers = await db.select().from(users).limit(1);
    const isFirstUser = existingUsers.length === 0;

    try {
      const [result] = await db.insert(users).values({
        username,
        password: hashedPassword,
      });

      const newUserId = result.insertId;

      // If this is the first user, adopt all orphaned expenses (legacy data)
      if (isFirstUser) {
        console.log(`First user registered (ID: ${newUserId}). Migrating legacy expenses...`);
        await db.update(expenses)
          .set({ userId: newUserId })
          .where(isNull(expenses.userId));
      }

      res.status(201).json({ message: "注册成功" });
    } catch (dbError: any) {
      // 兜底：并发场景下仍可能触发唯一约束冲突
      if (dbError.code === 'ER_DUP_ENTRY' || dbError.errno === 1062 || (dbError.message && dbError.message.includes('Duplicate'))) {
        res.status(409).json({ error: "该用户名已被注册" });
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "注册失败，请稍后重试" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const [user] = await db.select().from(users).where(eq(users.username, username));

    if (!user) {
      res.status(401).json({ error: "用户名或密码错误" });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json({ error: "用户名或密码错误" });
      return;
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: user.username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "登录失败，请稍后重试" });
  }
});

// ========== 用户设置 API ==========

// 获取用户设置
app.get("/api/settings", authenticateToken, async (req: any, res) => {
  try {
    const [setting] = await db.select().from(userSettings).where(eq(userSettings.userId, req.user.id));
    res.json(setting || { aiApiKey: "", aiModel: "" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "获取设置失败" });
  }
});

// 更新用户设置
app.put("/api/settings", authenticateToken, async (req: any, res) => {
  try {
    const { aiApiKey, aiModel } = req.body;
    const [existing] = await db.select().from(userSettings).where(eq(userSettings.userId, req.user.id));

    if (existing) {
      await db.update(userSettings)
        .set({ aiApiKey: aiApiKey ?? existing.aiApiKey, aiModel: aiModel ?? existing.aiModel })
        .where(eq(userSettings.userId, req.user.id));
    } else {
      await db.insert(userSettings).values({
        userId: req.user.id,
        aiApiKey: aiApiKey || "",
        aiModel: aiModel || "gemini-2.0-flash",
      });
    }

    const [updated] = await db.select().from(userSettings).where(eq(userSettings.userId, req.user.id));
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "保存设置失败" });
  }
});

// ========== 记账本 API (Auth Required) ==========

// 1. 获取所有账单
app.get("/api/expenses", authenticateToken, async (req: any, res) => {
  try {
    const result = await db.select()
      .from(expenses)
      .where(eq(expenses.userId, req.user.id))
      .orderBy(desc(expenses.date));
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "获取账单失败" });
  }
});

// 2. 记一笔
app.post("/api/expenses", authenticateToken, async (req: any, res) => {
  try {
    const { title, amount, category, date } = req.body;

    if (!title || !amount || !category) {
      res.status(400).json({ error: "信息不完整" });
      return;
    }

    const [result] = await db.insert(expenses).values({
      title,
      amount: String(amount),
      category,
      date: date ? new Date(date) : new Date(),
      userId: req.user.id
    });

    const [newItem] = await db.select().from(expenses).where(eq(expenses.id, result.insertId));
    res.status(201).json(newItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "记账失败" });
  }
});

// 3. 删除账单
app.delete("/api/expenses/:id", authenticateToken, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "无效 ID" });
      return;
    }

    await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, req.user.id)));
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "删除失败" });
  }
});

// ========== 编辑账单 ==========

// 4. 编辑账单
app.put("/api/expenses/:id", authenticateToken, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "无效 ID" });
      return;
    }

    const { title, amount, category, date } = req.body;
    if (!title || amount === undefined || !category) {
      res.status(400).json({ error: "信息不完整" });
      return;
    }

    await db.update(expenses)
      .set({
        title,
        amount: String(amount),
        category,
        date: date ? new Date(date) : new Date(),
      })
      .where(and(eq(expenses.id, id), eq(expenses.userId, req.user.id)));

    const [updated] = await db.select().from(expenses).where(eq(expenses.id, id));
    if (!updated) {
      res.status(404).json({ error: "记录不存在" });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "更新失败" });
  }
});

// ========== AI 图片识别记账 ==========

function buildPrompt(categories?: string[]): string {
  const cats = Array.isArray(categories) && categories.length > 0
    ? categories.join("、")
    : "餐饮、交通、购物、娱乐、服务订阅、投资、其他";

  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

  return `你是一个专业的记账助手。今天是 ${today}。用户会发送消费小票、账单截图、转账记录等图片，你需要从中识别出所有的消费记录。

请严格按以下 JSON 格式返回结果，不要输出任何其他文字：
{
  "items": [
    {
      "title": "消费项目名称（简短描述）",
      "amount": 金额数字（不带货币符号），
      "category": "分类",
      "date": "YYYY-MM-DD 格式的日期，如果图片中只有月日没有年份，请默认为当年（${new Date().getFullYear()}年）"
    }
  ]
}

分类必须是以下之一：${cats}

识别规则：
1. 如果图片中有多个消费项目，全部列出
2. 金额必须是正数
3. 标题尽量简洁，不超过20个字
4. 如果无法识别图片内容，返回 {"items": [], "error": "无法识别图片内容"}
5. 合理推断分类，例如：外卖/餐厅→餐饮，打车/地铁→交通，超市/商场→购物

请识别这张图片中的消费记录：`;
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  return { mimeType: "image/jpeg", base64: dataUrl };
}

function extractJson(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text); } catch { }
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch { }
  }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch { }
  }
  return null;
}

app.post("/api/ai/parse-receipt", async (req, res) => {
  try {
    const { image, apiKey, model, categories } = req.body;

    if (!image || !apiKey) {
      res.status(400).json({ error: "缺少图片或 API Key" });
      return;
    }

    const modelName = model || "gemini-2.0-flash";
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
        maxOutputTokens: 2048,
        response_mime_type: "application/json",
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

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});

// ========== 静态文件托管 (必须放在 API 路由之后) ==========
// 生产环境下，由 Express 托管 React 构建产物
const clientBuildPath = path.join(__dirname, "../public");
app.use(express.static(clientBuildPath));

// 所有未匹配的 API 请求，都返回 React 的 index.html (支持 SPA 路由)
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});
