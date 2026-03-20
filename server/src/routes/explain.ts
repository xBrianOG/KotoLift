import { Router } from 'express';
import OpenAI from 'openai';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const explainSchema = {
  type: 'object' as const,
  properties: {
    sentence: { type: 'string' as const, minLength: 1, maxLength: 500 },
    focus: { type: 'string' as const, enum: ['english', 'spanish', 'both'] }
  },
  required: ['sentence'] as const
};

router.post('/', async (req, res) => {
  const { sentence, focus = 'both' } = req.body;

  if (!sentence || typeof sentence !== 'string' || sentence.trim().length === 0) {
    return res.status(400).json({ error: 'Sentence is required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  const focusInstruction = focus === 'english' 
    ? 'Provide detailed English translations and explanations.'
    : focus === 'spanish'
    ? 'Provide detailed Spanish translations and explanations.'
    : 'Provide detailed translations and explanations in both English and Spanish.';

  const systemPrompt = `You are an expert Japanese language teacher. Analyze the given Japanese sentence and provide a comprehensive explanation.

Return a JSON object with this exact structure:
{
  "detected_language": "ja",
  "translations": {
    "ja": "<original sentence>",
    "en": "<natural English translation>",
    "es": "<natural Spanish translation>"
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
    "ja": "<flashcard front (Japanese)>",
    "en": "<English translation for back>",
    "es": "<Spanish translation for back>",
    "tags": ["<relevant tag 1>", "<relevant tag 2>"]
  }
}

Rules:
- vocabulary: include 2-5 important words/phrases from the sentence
- grammar_points: identify 1-3 key grammar patterns if present, omit if sentence is simple vocabulary
- alternatives: provide 1-2 alternative ways to express the same meaning
- mistakes: list any common errors a learner might make, or empty array if sentence is natural
- suggested_flashcard: create a flashcard that would be useful for learning (front in Japanese, back in translations)
- If the sentence is in English or Spanish instead of Japanese, still provide explanations but detect the language and adjust accordingly
- score_1_to_5: 5 = perfectly natural, 1 = very unnatural/incorrect
- tags should be short (1-2 words), lowercase, no spaces (use hyphens). Include: grammar, vocabulary, or specific topics like "particles", "verb-conjugation", "keigo", "casual-speech", etc.
- mistakes array should be empty if no mistakes, never null`;

  const userPrompt = `${focusInstruction}\n\nSentence to analyze: ${sentence.trim()}`;

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
    return res.json(parsed);
  } catch (e: any) {
    console.error('[Explain] Error:', e.message);
    return res.status(500).json({ error: e.message || 'Failed to generate explanation' });
  }
});

export default router;
