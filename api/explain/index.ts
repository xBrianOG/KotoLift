import OpenAI from "openai";

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { sentence, focus } = req.body || {};

    if (!sentence) {
      return res.status(400).json({ error: "Sentence is required" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OpenAI API key not configured on server" });
    }

    const openai = new OpenAI({ apiKey });

    const focusText =
      focus === "both"
        ? "English and Spanish"
        : focus === "english"
          ? "English"
          : "Spanish";

    const prompt = `You are a language tutor helping a native Japanese speaker learning English and Spanish.

Explain this sentence (focus on ${focusText}):
"${sentence}"

Return STRICT JSON only:
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful language tutor. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    return res.status(200).json(JSON.parse(content));
  } catch (error: any) {
    console.error("[API Error]", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
}
