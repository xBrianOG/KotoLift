import 'dotenv/config';
import express from "express";
import videoRouter from "./routes/video.js";
import authRouter from "./routes/auth.js";
import usageRouter from "./routes/usage.js";
import cors from "cors";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// CORS must be FIRST - before any routes
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// API Routes
app.use("/api/video", videoRouter);
app.use("/api/auth", authRouter);
app.use("/api/usage", usageRouter);

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok",
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    environment: "railway"
  });
});

// Serve static files from Vite build
const distPath = path.join(__dirname, "../../dist");
app.use(express.static(distPath));

// SPA Fallback: Redirect all other requests to index.html
app.get("/:path*", (req, res) => {
  if (req.path.startsWith("/api")) return;
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📹 Video analysis: POST /api/video/analyze`);
  console.log(`🔐 Auth: POST /api/auth/apple`);
  console.log(`📊 Usage: GET /api/usage/me`);
});
