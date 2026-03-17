import express from "express";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// 引入拆分的路由模块
import authRoutes from "./routes/auth";
import expenseRoutes from "./routes/expenses";
import settingsRoutes from "./routes/settings";
import aiRoutes from "./routes/ai";

const app = express();
const PORT = process.env.PORT || 3001;

// 信任反向代理（nginx），使 HTTPS 检测正常工作（PWA Service Worker 要求 HTTPS）
app.set('trust proxy', 1);

// 安全响应头（防点击劫持、MIME嗅探、XSS等）
app.use(helmet({
  contentSecurityPolicy: false, // SPA 自带脚本，CSP 单独在 nginx 层配置
  crossOriginEmbedderPolicy: false,
}));

// CORS 限制到自己域名
const allowedOrigins = [
  'https://www.airoport.xyz',
  'https://airoport.xyz',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:3001'] : [])
];
app.use(cors({
  origin: (origin, callback) => {
    // 同源请求（origin 为 undefined）和允许列表内的域名放行
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// 全局限速：每 IP 每分钟最多 120 次请求（正常使用绰绰有余）
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});
app.use(globalLimiter);

app.use(express.json({ limit: "20mb" }));

// 挂载路由模块
// 注意：保持原有的 API 路径前缀一致
app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/ai", aiRoutes);

// ========== 静态文件托管 (必须放在 API 路由之后) ==========
// 生产环境下，由 Express 托管 React 构建产物
const clientBuildPath = path.join(__dirname, "../public");

// 修复 PWA 相关文件的 MIME 类型和响应头
app.get('/manifest.webmanifest', (_req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.sendFile(path.join(clientBuildPath, 'manifest.webmanifest'));
});
app.get('/sw.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(clientBuildPath, 'sw.js'));
});

app.use(express.static(clientBuildPath));

// SPA 兜底：未匹配的非 API 请求返回 index.html（支持前端路由）
// 排除 /api/ 前缀，避免吞掉 API GET 端点（如 /api/ai/debug）
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
