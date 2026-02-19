import { GoogleGenerativeAI } from "@google/generative-ai";

// Simple test endpoint to verify Vercel functions work
export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const hasKey = !!process.env.GEMINI_API_KEY;

  let geminiTest = "not tested";
  if (hasKey) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent("Say hello");
      const response = await result.response;
      geminiTest = "success: " + response.text().substring(0, 50);
    } catch (error) {
      geminiTest =
        "error: " + (error instanceof Error ? error.message : String(error));
    }
  }

  return res.status(200).json({
    message: "API is working!",
    method: req.method,
    hasGeminiKey: hasKey,
    geminiTest: geminiTest,
    nodeVersion: process.version,
    bodyType: typeof req.body,
    body: req.body,
  });
}
