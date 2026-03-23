import express from "express";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth";
import expenseRoutes from "./routes/expenses";
import settingsRoutes from "./routes/settings";
import aiRoutes from "./routes/ai";

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === "production";

function getTrustProxySetting(): string | number | boolean {
  const rawValue = process.env.TRUST_PROXY?.trim();

  if (!rawValue) {
    return isProduction ? "loopback" : false;
  }

  const normalized = rawValue.toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  if (/^\d+$/.test(normalized)) return Number(normalized);

  return rawValue;
}

app.set("trust proxy", getTrustProxySetting());

app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:", "blob:"],
      manifestSrc: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      workerSrc: ["'self'", "blob:"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = [
  "https://www.airoport.xyz",
  "https://airoport.xyz",
  ...(isProduction ? [] : ["http://localhost:5173", "http://localhost:3001"]),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "请求过于频繁，请稍后再试" },
});

app.use(globalLimiter);
app.use(express.json({ limit: "20mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/ai", aiRoutes);

const clientBuildPath = path.join(__dirname, "../public");

app.get("/manifest.webmanifest", (_req, res) => {
  res.setHeader("Content-Type", "application/manifest+json");
  res.sendFile(path.join(clientBuildPath, "manifest.webmanifest"));
});

app.get("/sw.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Service-Worker-Allowed", "/");
  res.sendFile(path.join(clientBuildPath, "sw.js"));
});

app.use(express.static(clientBuildPath));

app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
