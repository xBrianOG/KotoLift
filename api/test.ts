// Simple test endpoint to verify Vercel functions work
export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  return res.status(200).json({ 
    message: "API is working!",
    method: req.method,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    nodeVersion: process.version
  });
}

