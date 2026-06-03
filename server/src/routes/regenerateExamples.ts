import { Router } from 'express';
import OpenAI from 'openai';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

interface ExampleOut {
  ja: string;
  en: string;
  es: string;
}

router.post('/', async (req, res) => {
  const { sentence, detected_language, translations, current_examples } = req.body || {};

  if (!sentence || typeof sentence !== 'string' || !sentence.trim()) {
    return res.status(400).json({ error: 'sentence required' });
  }
  if (!detected_language || !['ja', 'en', 'es'].includes(detected_language)) {
    return res.status(400).json({ error: 'detected_language must be ja, en, or es' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  const avoidClause = Array.isArray(current_examples) && current_examples.length > 0
    ? `\n\nFor variety, do NOT repeat or closely paraphrase any of these existing examples:\n${current_examples
        .map((ex: any, i: number) => `${i + 1}. ${ex?.[detected_language] ?? ''}`)
        .filter(Boolean)
        .join('\n')}`
    : '';

  const contextTranslations =
    translations && typeof translations === 'object'
      ? `Context translations of the input: ja="${translations.ja ?? ''}", en="${translations.en ?? ''}", es="${translations.es ?? ''}".`
      : '';

  const systemPrompt = `You are a language-learning assistant. The user is studying a word or phrase in a flashcard app. Generate 3 NEW example sentences (different from anything you've given before) that show this word/phrase being used in real context, in the user's intended meaning.${avoidClause}

Return STRICT JSON only:
{
  "examples": [
    { "ja": "<short JA example>", "en": "<EN translation>", "es": "<ES translation>" },
    { "ja": "<short JA example>", "en": "<EN translation>", "es": "<ES translation>" },
    { "ja": "<short JA example>", "en": "<EN translation>", "es": "<Spanish translation>" }
  ]
}

Rules:
- Source language of the examples: ${detected_language}. Use the input word/phrase in the user's INTENDED meaning (e.g. "commitment" as in promise/obligation, not "committed" as in suicide).
- Provide all three languages for each example.
- Keep examples short (under 60 chars per language), natural, and contextually varied.
- Do NOT include any prose outside the JSON.`;

  const userPrompt = `${contextTranslations}\n\nInput: "${sentence.trim()}"`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 700,
      temperature: 1.0,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'No response from OpenAI' });
    }

    const parsed = JSON.parse(content) as { examples?: ExampleOut[] };
    const examples = Array.isArray(parsed.examples) ? parsed.examples : [];
    const cleaned: ExampleOut[] = examples
      .filter((e) => e && typeof e.ja === 'string' && typeof e.en === 'string' && typeof e.es === 'string')
      .map((e) => ({ ja: e.ja, en: e.en, es: e.es }))
      .filter((e) => e.ja && e.en && e.es);

    if (cleaned.length === 0) {
      return res.status(502).json({ error: 'OpenAI returned no valid examples' });
    }

    return res.json({ examples: cleaned });
  } catch (e: any) {
    console.error('[RegenerateExamples] Error:', e.message);
    return res.status(500).json({ error: e.message || 'Failed to regenerate examples' });
  }
});

export default router;
