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
app.use(express.static(clientBuildPath));

// 所有未匹配的 API 请求，都返回 React 的 index.html (支持 SPA 路由)
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
