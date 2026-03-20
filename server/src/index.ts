import 'dotenv/config';
import { webcrypto } from 'node:crypto';

// Polyfill for Node.js < 20 which doesn't have global crypto by default
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}

import express from "express";
import videoRouter from "./routes/video.js";
import authRouter from "./routes/auth.js";
import usageRouter from "./routes/usage.js";
import transcriptRouter from "./routes/transcript.js";
import transcribeRouter from "./routes/transcribe.js";
import explainRouter from "./routes/explain.js";
import cors from "cors";
import fs from "fs";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directory exists for user accounts
const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) {
  console.log('📁 Creating data directory...');
  fs.mkdirSync(dataDir, { recursive: true });
}

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
app.use("/api/transcript", transcriptRouter);
app.use("/api/transcribe", transcribeRouter);
app.use("/api/explain", explainRouter);

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok",
    version: "1.0.3-whisper",
    timestamp: new Date().toISOString(),
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    environment: "railway"
  });
});

// Serve static files from Vite build
const distPath = path.join(__dirname, "../../dist");
app.use(express.static(distPath));

// SPA Fallback: Serve index.html for all other requests (after API and Static files)
app.use((req, res) => {
  // If it's an API request that wasn't caught, return 404
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API route not found" });
  }
  // Otherwise, serve the frontend for SPA routing
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📹 Video analysis: POST /api/video/analyze`);
  console.log(`🔐 Auth: POST /api/auth/apple`);
  console.log(`📊 Usage: GET /api/usage/me`);
});
