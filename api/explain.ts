import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  const rateLimitKey = `rate_limit:${ip}`;

  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map();
  }

  const current = global.rateLimitStore.get(rateLimitKey) || 0;
  if (current > 10) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  global.rateLimitStore.set(rateLimitKey, current + 1);

  const { sentence, focus } = req.body;

  if (!sentence || typeof sentence !== "string" || sentence.length > 500) {
    return res.status(400).json({ error: "Invalid sentence" });
  }

  if (!["english", "spanish", "both"].includes(focus || "both")) {
    return res.status(400).json({ error: "Invalid focus" });
  }

  const focusText = focus === "both" ? "English and Spanish" : focus === "english" ? "English" : "Spanish";

  const prompt = `You are a language tutor helping a native Japanese speaker learning English and Spanish.

Explain this sentence (focus on ${focusText}):

"${sentence}"

Return STRICT JSON only (no markdown, no code blocks, no explanation):

{
  "detected_language": "ja|en|es",
  "translations": { "ja": "...", "en": "...", "es": "..." },
  "naturalness": { "score_1_to_5": number, "comment": "..." },
  "grammar_points": [
    { "title": "...", "explanation": "...", "example": "..." }
  ],
  "vocabulary": [
    { "term": "...", "meaning": "...", "notes": "..." }
  ],
  "alternatives": [
    { "tone": "neutral|casual|formal", "ja": "...", "en": "...", "es": "..." }
  ],
  "mistakes": [ "..." ],
  "suggested_flashcard": {
    "ja": "...",
    "en": "...",
    "es": "...",
    "tags": ["..."]
  }
}`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response:", cleanText);
      return res.status(502).json({ error: "Invalid LLM response" });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      error: "Internal error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

declare global {
  var rateLimitStore: Map<string, number>;
}

