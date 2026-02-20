import OpenAI from "openai";

// Simple test endpoint to verify Vercel functions work
export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const hasKey = !!process.env.OPENAI_API_KEY;

  let openaiTest = "not tested";
  if (hasKey) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Say hello" }],
      });

      openaiTest =
        "success: " +
        (completion.choices[0]?.message?.content ?? "").substring(0, 50);
    } catch (error) {
      openaiTest =
        "error: " + (error instanceof Error ? error.message : String(error));
    }
  }

  return res.status(200).json({
    message: "API is working!",
    method: req.method,
    hasOpenAIKey: hasKey,
    openaiTest,
    nodeVersion: process.version,
    bodyType: typeof req.body,
    body: req.body,
  });
}
