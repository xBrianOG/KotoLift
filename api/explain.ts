import OpenAI from "openai";

export default async function handler(req: any, res: any) {
  console.log("[API] ========== NEW REQUEST ==========");
  console.log("[API] Method:", req.method);
  console.log("[API] URL:", req.url);
  console.log("[API] Headers:", JSON.stringify(req.headers, null, 2));

  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      console.log("[API] Handling OPTIONS request");
      return res.status(200).end();
    }

    if (req.method !== "POST") {
      console.error("[API] Invalid method:", req.method);
      return res.status(405).json({ error: "Method not allowed" });
    }

    console.log("[API] Request body:", JSON.stringify(req.body, null, 2));
    console.log("[API] Has OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
    if (process.env.OPENAI_API_KEY) {
      console.log("[API] API Key length:", process.env.OPENAI_API_KEY.length);
      console.log(
        "[API] API Key prefix:",
        process.env.OPENAI_API_KEY.substring(0, 10) + "...",
      );
    }

    const ip =
      req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
    const rateLimitKey = `rate_limit:${ip}`;
    console.log("[API] Client IP:", ip);

    if (!global.rateLimitStore) {
      global.rateLimitStore = new Map();
      console.log("[API] Initialized rate limit store");
    }

    const current = global.rateLimitStore.get(rateLimitKey) || 0;
    console.log("[API] Current rate limit count for IP:", current);

    if (current > 10) {
      console.error("[API] Rate limit exceeded for IP:", ip);
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    global.rateLimitStore.set(rateLimitKey, current + 1);
    console.log("[API] Updated rate limit count to:", current + 1);

    const { sentence, focus } = req.body || {};
    console.log("[API] Extracted sentence:", sentence);
    console.log("[API] Extracted focus:", focus);

    if (!sentence || typeof sentence !== "string" || sentence.length > 500) {
      console.error("[API] Invalid sentence:", {
        sentence,
        type: typeof sentence,
        length: sentence?.length,
      });
      return res.status(400).json({ error: "Invalid sentence" });
    }

    if (!["english", "spanish", "both"].includes(focus || "both")) {
      console.error("[API] Invalid focus:", focus);
      return res.status(400).json({ error: "Invalid focus" });
    }

    console.log("[API] Validation passed");

    const focusText =
      focus === "both"
        ? "English and Spanish"
        : focus === "english"
          ? "English"
          : "Spanish";

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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[API] OPENAI_API_KEY not found in environment");
      console.error(
        "[API] Available env vars:",
        Object.keys(process.env).filter((k) => !k.includes("SECRET")),
      );
      return res.status(500).json({ error: "API key not configured" });
    }

    console.log("[API] Initializing OpenAI API client...");
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    console.log("[API] Sending request to OpenAI API (gpt-4o-mini)...");
    console.log("[API] Prompt length:", prompt.length);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a language tutor helping a native Japanese speaker learning English and Spanish. Always respond with valid JSON only, no markdown formatting.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    console.log("[API] OpenAI API call completed");
    console.log("[API] Response received");

    const text = completion.choices[0]?.message?.content || "";
    console.log("[API] Response text length:", text.length);
    console.log("[API] Response text preview:", text.substring(0, 200));

    console.log("[API] Cleaning response text...");
    const cleanText = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    console.log("[API] Cleaned text length:", cleanText.length);

    console.log("[API] Extracting JSON from response...");
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[API] No JSON found in response");
      console.error("[API] Clean text:", cleanText);
      return res
        .status(502)
        .json({ error: "Invalid LLM response - no JSON found" });
    }

    console.log("[API] JSON match found, length:", jsonMatch[0].length);
    console.log("[API] Parsing JSON...");

    const parsed = JSON.parse(jsonMatch[0]);
    console.log("[API] JSON parsed successfully");
    console.log("[API] Parsed object keys:", Object.keys(parsed));
    console.log("[API] Sending success response");

    return res.status(200).json(parsed);
  } catch (error) {
    console.error("[API] ========== ERROR OCCURRED ==========");
    console.error("[API] Error type:", typeof error);
    console.error(
      "[API] Error name:",
      error instanceof Error ? error.name : "unknown",
    );
    console.error(
      "[API] Error message:",
      error instanceof Error ? error.message : String(error),
    );
    console.error("[API] Error object:", error);

    if (error instanceof Error && error.stack) {
      console.error("[API] Error stack:", error.stack);
    }

    // Check if it's an OpenAI API specific error
    if (error && typeof error === "object" && "message" in error) {
      console.error("[API] Error details:", JSON.stringify(error, null, 2));
    }

    return res.status(500).json({
      error: "Internal error",
      details: error instanceof Error ? error.message : String(error),
      stack:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.stack
            : undefined
          : undefined,
    });
  } finally {
    console.log("[API] ========== REQUEST COMPLETE ==========");
  }
}

declare global {
  var rateLimitStore: Map<string, number>;
}
