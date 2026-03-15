import 'dotenv/config';
import express from "express";
import videoRouter from "./routes/video.js";
import authRouter from "./routes/auth.js";
import usageRouter from "./routes/usage.js";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// CORS must be FIRST - before any routes
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

app.use("/api/video", videoRouter);
app.use("/auth", authRouter);
app.use("/api/usage", usageRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📹 Video analysis: POST /api/video/analyze`);
  console.log(`🔐 Auth: POST /auth/apple`);
  console.log(`📊 Usage: GET /api/usage/me`);
});
