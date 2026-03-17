import { Router } from 'express';
import { z } from 'zod';
import { YouTubeProvider } from '../providers/YouTubeProvider.js';
import { WhisperProvider } from '../providers/WhisperProvider.js';
import { authMiddleware } from '../middleware/auth.js';
import { logUsage, getUsage, getCurrentMonth } from '../services/usage.js';
import type { AnalyzeResult } from '../types.js';
import type { Request, Response, NextFunction } from 'express';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const router = Router();

const analyzeSchema = z.object({
  url: z.string().min(1, { message: 'URL is required' }),
  lang: z.enum(['en', 'ja', 'es']).optional(),
  provider: z.enum(['youtube', 'whisper']).optional(),
  preferWhisper: z.boolean().optional()
});

const translateSchema = z.object({
  text: z.string().min(1).max(600),
  sourceLang: z.enum(['en', 'ja', 'es']),
  targetLang: z.enum(['en', 'ja', 'es'])
});

const providers = {
  youtube: new YouTubeProvider(),
  whisper: new WhisperProvider()
};

async function analyzeVideo(url: string, lang?: string, providerName?: string, preferWhisper?: boolean): Promise<AnalyzeResult> {
  // If user explicitly chose a provider, use that one
  if (providerName && providers[providerName as keyof typeof providers]) {
    const provider = providers[providerName as keyof typeof providers];
    if (provider.canHandle(url)) {
      return provider.extract(url, lang);
    }
  }
  
  // If user prefers Whisper, use it directly
  if (preferWhisper) {
    console.log('[Video] User prefers Whisper, skipping YouTube captions');
    if (providers.whisper.canHandle(url)) {
      return providers.whisper.extract(url, lang);
    }
  }
  
  // Default: Try YouTube captions first, then fallback to Whisper
  if (!providerName || providerName === 'youtube') {
    try {
      if (providers.youtube.canHandle(url)) {
        const result = await providers.youtube.extract(url, lang);
        console.log('[Video] Successfully got YouTube captions');
        return result;
      }
    } catch (err: any) {
      if (err.code !== 'NO_CAPTIONS') {
        throw err;
      }
      console.log('[Video] YouTube captions unavailable, falling back to Whisper...');
    }
  }
  
  if (providers.whisper.canHandle(url)) {
    return providers.whisper.extract(url, lang);
  }
  
  throw new Error('Unsupported video URL. Currently only YouTube is supported.');
}

router.post('/analyze', authMiddleware, async (req: any, res: any, next: any) => {
  try {
    const body = analyzeSchema.parse(req.body);
    const { url, lang, provider, preferWhisper } = body;

    const result = await analyzeVideo(url, lang, provider, preferWhisper);
    
    const totalMs = result.segments.reduce((sum, seg) => sum + (seg.endMs - seg.startMs), 0);
    const minutesUsed = Math.ceil(totalMs / 60000);
    
    if (minutesUsed > 0) {
      logUsage(req.userId, minutesUsed);
    }
    
    res.json({
      ...result,
      minutesUsed
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: err.errors
      });
    }

    const status = err.code === 'INVALID_URL' ? 400 : 500;
    res.status(status).json({
      error: err.message || 'Failed to analyze video',
      code: err.code || 'UNKNOWN_ERROR'
    });
  }
});

router.post('/translate', authMiddleware, async (req: any, res: any) => {
  try {
    const body = translateSchema.parse(req.body);
    const { text, sourceLang, targetLang } = body;

    if (sourceLang === targetLang) {
      return res.json({ translation: text });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const langNames: Record<string, string> = {
      en: 'English',
      ja: 'Japanese',
      es: 'Spanish'
    };

    const prompt = `Translate from ${langNames[sourceLang]} to ${langNames[targetLang]}. Output ONLY the translated text.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI translation error:', err);
      return res.status(500).json({ error: 'Translation failed' });
    }

    const data = await response.json();
    const translation = data.choices?.[0]?.message?.content?.trim() || '';

    res.json({ translation });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation Error', details: err.errors });
    }
    console.error('Translate error:', err);
    res.status(500).json({ error: err.message || 'Translation failed' });
  }
});

export default router;
