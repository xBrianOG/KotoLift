import { Router } from 'express';
import OpenAI from 'openai';
import { fetchExamples, type ExampleSourceLang } from '../services/tatoeba.js';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const explainSchema = {
  type: 'object' as const,
  properties: {
    sentence: { type: 'string' as const, minLength: 1, maxLength: 500 }
  },
  required: ['sentence'] as const
};

router.post('/', async (req, res) => {
  const { sentence } = req.body;

  if (!sentence || typeof sentence !== 'string' || sentence.trim().length === 0) {
    return res.status(400).json({ error: 'Sentence is required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  const systemPrompt = `You are an expert language teacher. Analyze the given sentence and provide a comprehensive explanation.

The input language can be Japanese (JA), English (EN), or Spanish (ES). Detect the language and provide translations in ALL THREE languages (JA, EN, ES).

Return a JSON object with this exact structure:
{
  "detected_language": "ja|en|es",
  "translations": {
    "ja": "<Japanese translation>",
    "en": "<English translation>",
    "es": "<Spanish translation>"
  },
  "naturalness": {
    "score_1_to_5": <1-5 integer>,
    "comment": "<brief comment on naturalness in 1-2 sentences>"
  },
  "grammar_points": [
    {
      "title": "<grammar point name/title>",
      "explanation": "<clear explanation of the grammar in English>",
      "example": "<an example sentence using this grammar point>"
    }
  ],
  "vocabulary": [
    {
      "term": "<word/phrase>",
      "meaning": "<English meaning>",
      "notes": "<any useful notes, like conjugation, politeness level, etc. Can be empty string.>"
    }
  ],
  "alternatives": [
    {
      "tone": "neutral|casual|formal",
      "ja": "<alternative sentence in Japanese>",
      "en": "<English translation>",
      "es": "<Spanish translation>"
    }
  ],
  "mistakes": ["<mistake 1 if any>", "<mistake 2 if any>"],
  "suggested_flashcard": {
    "ja": "<flashcard front in Japanese>",
    "en": "<English translation>",
    "es": "<Spanish translation>",
    "tags": ["<relevant tag 1>", "<relevant tag 2>"]
  }
}

Rules:
- detected_language: detect whether the input is Japanese, English, or Spanish. Look at the script (hiragana/katakana/kanji = Japanese, Latin alphabet = English or Spanish, distinguish by common words)
- translations: ALWAYS provide translations in ALL THREE languages regardless of input language
- vocabulary: include 2-5 important words/phrases from the sentence
- grammar_points: identify 1-3 key grammar patterns if present, omit if sentence is simple vocabulary
- alternatives: provide 1-2 alternative ways to express the same meaning
- mistakes: list any common errors a learner might make, or empty array if sentence is natural
- suggested_flashcard: create a useful flashcard (front in original language, back in other languages)
- score_1_to_5: 5 = perfectly natural, 1 = very unnatural/incorrect
- tags should be short (1-2 words), lowercase, no spaces (use hyphens). Include: grammar, vocabulary, or specific topics like "particles", "verb-conjugation", "keigo", "casual-speech", etc.
- mistakes array should be empty if no mistakes, never null`;

  const userPrompt = `Sentence to analyze: ${sentence.trim()}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.7
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'No response from OpenAI' });
    }

    const parsed = JSON.parse(content);

    const detected = (parsed?.detected_language || 'ja') as ExampleSourceLang;
    const queryForExamples =
      (typeof parsed?.translations?.[detected] === 'string' && parsed.translations[detected]) ||
      sentence.trim();
    try {
      parsed.examples = await fetchExamples(queryForExamples, detected, 3);
    } catch (e) {
      console.warn('[Explain] Tatoeba lookup failed:', e);
      parsed.examples = [];
    }

    return res.json(parsed);
  } catch (e: any) {
    console.error('[Explain] Error:', e.message);
    return res.status(500).json({ error: e.message || 'Failed to generate explanation' });
  }
});

export default router;
