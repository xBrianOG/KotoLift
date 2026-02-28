import 'dotenv/config';
import express from "express";
import videoRouter from "./routes/video.js";
import authRouter from "./routes/auth.js";
import usageRouter from "./routes/usage.js";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/api/video", videoRouter);
app.use("/auth", authRouter);
app.use("/api/usage", usageRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📹 Video analysis: POST /api/video/analyze`);
  console.log(`🔐 Auth: POST /auth/apple`);
  console.log(`📊 Usage: GET /api/usage/me`);
});

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.options(/.*/, cors());
