import express from "express";
import cors from "cors";
import path from "path";

// 引入拆分的路由模块
import authRoutes from "./routes/auth";
import expenseRoutes from "./routes/expenses";
import settingsRoutes from "./routes/settings";
import aiRoutes from "./routes/ai";

const app = express();
const PORT = process.env.PORT || 3001;

// 信任反向代理（nginx），使 HTTPS 检测正常工作（PWA Service Worker 要求 HTTPS）
app.set('trust proxy', 1);

app.use(cors());
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
