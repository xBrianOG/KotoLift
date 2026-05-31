import { Router } from 'express';
import { YouTubeTranscriptApi } from 'youtube-transcript-api-js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const router = Router();

// Cache structure
interface CacheEntry {
  segments: any[];
  cachedAt: number;
  isFailure: boolean;
  errorMessage?: string;
}

// In-memory cache (videoId -> cache entry)
const transcriptCache = new Map<string, CacheEntry>();

// Request deduplication (videoId -> in-flight promise)
const inFlightRequests = new Map<string, Promise<any>>();

// Cache TTLs
const SUCCESS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FAILURE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Helper functions
function getCookieFile(): string | null {
  const cookiesBase64 = process.env.YOUTUBE_COOKIES;
  if (!cookiesBase64) return null;
  
  try {
    const cookies = Buffer.from(cookiesBase64, 'base64').toString('utf-8');
    const tmpFile = join(tmpdir(), 'yt_cookies.txt');
    writeFileSync(tmpFile, cookies, 'utf-8');
    return tmpFile;
  } catch {
    return null;
  }
}

function isRateLimitError(e: any): boolean {
  const msg = e.message || '';
  return msg.includes('rate') || 
         msg.includes('429') || 
         msg.includes('Too many requests') ||
         msg.includes('requests in a short period');
}

function isNoTranscriptError(e: any): boolean {
  const msg = e.message || '';
  return msg.includes('No transcript') || 
         msg.includes('no captions') ||
         msg.includes('not available') ||
         msg.includes('could not retrieve');
}

function cleanCache(): void {
  const now = Date.now();
  for (const [key, entry] of transcriptCache.entries()) {
    const ttl = entry.isFailure ? FAILURE_CACHE_TTL_MS : SUCCESS_CACHE_TTL_MS;
    if (now - entry.cachedAt > ttl) {
      transcriptCache.delete(key);
    }
  }
}

// Periodic cache cleanup (every 10 minutes)
setInterval(cleanCache, 10 * 60 * 1000);

async function fetchTranscriptWithRetry(videoId: string, lang: string, cookieFile: string | null, maxRetries = 2): Promise<any> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const api = new YouTubeTranscriptApi(
        undefined, 
        undefined, 
        cookieFile ? { cookiePath: cookieFile } : undefined
      );
      const result = await api.fetch(videoId, [lang]);
      return result;
    } catch (e: any) {
      lastError = e;
      
      // Don't retry for "no transcript" errors - they're permanent
      if (isNoTranscriptError(e)) {
        throw e;
      }
      
      // Don't retry for non-rate-limit errors
      if (!isRateLimitError(e)) {
        throw e;
      }
      
      // Only retry for rate limit errors, with backoff
      if (attempt < maxRetries - 1) {
        const backoffMs = 2000 * (attempt + 1); // 2s, 4s
        console.log(`[Transcript] Rate limited, retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }
  
  throw lastError;
}

router.get('/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const { lang = 'en' } = req.query;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  // Check cache first
  const cached = transcriptCache.get(videoId);
  const now = Date.now();
  
  if (cached) {
    const ttl = cached.isFailure ? FAILURE_CACHE_TTL_MS : SUCCESS_CACHE_TTL_MS;
    if (now - cached.cachedAt < ttl) {
      if (cached.isFailure) {
        return res.status(429).json({ 
          error: cached.errorMessage || 'Transcript temporarily unavailable',
          retryAfter: Math.ceil((ttl - (now - cached.cachedAt)) / 1000)
        });
      }
      console.log(`[Transcript] Cache hit for ${videoId}`);
      return res.json({
        title: `Video ${videoId}`,
        segments: cached.segments,
        videoId,
        method: 'YouTube Captions (cached)'
      });
    }
  }

  // Check for in-flight request (deduplication)
  if (inFlightRequests.has(videoId)) {
    console.log(`[Transcript] Waiting for in-flight request for ${videoId}`);
    try {
      const result = await inFlightRequests.get(videoId);
      return res.json(result);
    } catch (e) {
      // In-flight failed, we'll try our own request
    }
  }

  // Create new request promise
  const requestPromise = (async () => {
    let cookieFile: string | null = null;
    
    try {
      console.log(`[Transcript] Fetching transcript for ${videoId}`);
      
      cookieFile = getCookieFile();
      if (cookieFile) {
        console.log(`[Transcript] Using YouTube cookies`);
      } else {
        console.log(`[Transcript] No cookies configured`);
      }

      const result = await fetchTranscriptWithRetry(videoId, lang as string, cookieFile);

      const segments = result.snippets.map((snippet: any, i: number) => ({
        id: `seg-${i + 1}`,
        startMs: Math.round(snippet.start * 1000),
        endMs: Math.round((snippet.start + snippet.duration) * 1000),
        text: snippet.text
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'")
          .trim()
      }));

      // Cache successful result
      transcriptCache.set(videoId, {
        segments,
        cachedAt: Date.now(),
        isFailure: false
      });

      return {
        title: `Video ${videoId}`,
        segments,
        videoId,
        method: 'YouTube Captions'
      };
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to fetch transcript';
      
      // Determine error type and cache appropriately
      if (isRateLimitError(e)) {
        transcriptCache.set(videoId, {
          segments: [],
          cachedAt: Date.now(),
          isFailure: true,
          errorMessage: 'Rate limited. Please try again in a few minutes.'
        });
      } else if (isNoTranscriptError(e)) {
        // Don't cache "no transcript" errors for too long
        transcriptCache.set(videoId, {
          segments: [],
          cachedAt: Date.now(),
          isFailure: true,
          errorMessage: 'No transcript available for this video.'
        });
      } else {
        transcriptCache.set(videoId, {
          segments: [],
          cachedAt: Date.now(),
          isFailure: true,
          errorMessage: errorMessage
        });
      }
      
      throw e;
    } finally {
      if (cookieFile && existsSync(cookieFile)) {
        try { unlinkSync(cookieFile); } catch { /* ignore */ }
      }
      inFlightRequests.delete(videoId);
    }
  })();

  // Store promise for deduplication
  inFlightRequests.set(videoId, requestPromise);

  try {
    const result = await requestPromise;
    return res.json(result);
  } catch (e: any) {
    console.error(`[Transcript] Error:`, e.message);
    
    // Return appropriate status based on error type
    if (isRateLimitError(e)) {
      return res.status(429).json({ 
        error: 'Rate limited. Please try again in a few minutes.',
        retryAfter: 600
      });
    }
    
    if (isNoTranscriptError(e)) {
      return res.status(404).json({ 
        error: 'No transcript available for this video.'
      });
    }
    
    return res.status(500).json({ 
      error: e.message || 'Failed to fetch transcript' 
    });
  }
});

// Admin endpoint to clear cache (for debugging)
router.post('/cache/clear', (req, res) => {
  transcriptCache.clear();
  res.json({ success: true, message: 'Cache cleared' });
});

export default router;