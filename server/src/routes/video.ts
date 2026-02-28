import { Router } from 'express';
import { z } from 'zod';
import { YouTubeProvider } from '../providers/YouTubeProvider.js';
import { WhisperProvider } from '../providers/WhisperProvider.js';
import { authMiddleware } from '../middleware/auth.js';
import { logUsage, getUsage, getCurrentMonth } from '../services/usage.js';
import type { AnalyzeResult } from '../types.js';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

const analyzeSchema = z.object({
  url: z.string().url({ message: 'Invalid URL' }),
  lang: z.string().optional(),
  provider: z.enum(['youtube', 'whisper']).optional()
});

const providers = {
  youtube: new YouTubeProvider(),
  whisper: new WhisperProvider()
};

async function analyzeVideo(url: string, lang?: string, providerName?: string): Promise<AnalyzeResult> {
  if (providerName && providers[providerName as keyof typeof providers]) {
    const provider = providers[providerName as keyof typeof providers];
    if (provider.canHandle(url)) {
      return provider.extract(url, lang);
    }
  }
  
  if (!providerName || providerName === 'youtube') {
    try {
      if (providers.youtube.canHandle(url)) {
        return await providers.youtube.extract(url, lang);
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
    const { url, lang, provider } = body;

    const result = await analyzeVideo(url, lang, provider);
    
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

export default router;
