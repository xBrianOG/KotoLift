import { Router } from 'express';
import { spawn } from 'child_process';
import { YouTubeTranscriptApi } from 'youtube-transcript-api-js';
import { writeFileSync, unlinkSync, existsSync, readdirSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

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
  const cookiesEnv = process.env.YOUTUBE_COOKIES;
  if (!cookiesEnv) return null;
  
  try {
    const cookies = cookiesEnv.trim();
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

interface ParsedVttSegment {
  startMs: number;
  endMs: number;
  text: string;
}

/**
 * Parse a WebVTT (.vtt) file into our standard segment shape.
 * yt-dlp emits WebVTT for both manual and auto-generated captions.
 */
function parseVtt(vtt: string): ParsedVttSegment[] {
  const lines = vtt.split(/\r?\n/);
  const segments: ParsedVttSegment[] = [];
  let i = 0;

  function parseTimestamp(raw: string): number {
    // VTT timestamps are HH:MM:SS.mmm or MM:SS.mmm
    const parts = raw.split(':');
    const seconds = parts.pop() as string;
    const minutes = parts.length ? parseInt(parts.pop() as string, 10) : 0;
    const hours = parts.length ? parseInt(parts.pop() as string, 10) : 0;
    const [secStr, msStr] = seconds.split('.');
    return (hours * 3600 + minutes * 60 + parseInt(secStr, 10)) * 1000 + parseInt((msStr || '0').padEnd(3, '0').slice(0, 3), 10);
  }

  function stripCueText(raw: string): string {
    // Strip WebVTT tags (<c.classname>, <v Speaker>, <i>, etc.) and de-HTML
    return raw
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '' || line === 'WEBVTT' || line.startsWith('NOTE') || line.startsWith('STYLE') || line.startsWith('REGION')) {
      i++;
      continue;
    }
    if (line.includes('-->')) {
      const [startRaw, endRawWithPos] = line.split('-->');
      const endRaw = endRawWithPos.trim().split(/\s+/)[0];
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i]);
        i++;
      }
      const text = stripCueText(textLines.join('\n'));
      if (text) {
        segments.push({
          startMs: parseTimestamp(startRaw.trim()),
          endMs: parseTimestamp(endRaw),
          text,
        });
      }
    } else {
      i++;
    }
  }
  return segments;
}

/**
 * Fall back to yt-dlp when the JS transcript library gets rate-limited or
 * the video has no usable captions through the unofficial API. yt-dlp is
 * already installed in the Docker image. Returns null on failure.
 */
async function tryYtDlp(
  videoId: string,
  lang: string,
  cookieFile: string | null,
  timeoutMs = 12000,
): Promise<ParsedVttSegment[] | null> {
  const workDir = join(tmpdir(), `yt-dlp-${randomBytes(6).toString('hex')}`);
  try {
    mkdirSync(workDir, { recursive: true });
  } catch {
    return null;
  }

  const outTemplate = join(workDir, `${videoId}.%(ext)s`);
  const args = [
    '--write-auto-sub',
    '--skip-download',
    '--sub-lang', `${lang},${lang === 'en' ? 'en-US' : 'en'}`,
    '--sub-format', 'vtt',
    '--convert-subs', 'vtt',
    '--no-warnings',
    '--no-playlist',
    '-o', outTemplate,
  ];
  if (cookieFile) {
    args.push('--cookies', cookieFile);
  }
  args.push(`https://www.youtube.com/watch?v=${videoId}`);

  return new Promise((resolve) => {
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* ignore */ }
      cleanup();
      console.warn(`[Transcript] yt-dlp timeout for ${videoId}`);
      resolve(null);
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      try {
        const files = readdirSync(workDir);
        for (const f of files) {
          try { unlinkSync(join(workDir, f)); } catch { /* ignore */ }
        }
        try { unlinkSync(workDir); } catch { /* ignore */ }
      } catch { /* ignore */ }
    }

    proc.on('error', (e) => {
      cleanup();
      console.warn(`[Transcript] yt-dlp spawn error: ${e.message}`);
      resolve(null);
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        cleanup();
        console.warn(`[Transcript] yt-dlp exit ${code}: ${stderr.slice(-200)}`);
        resolve(null);
        return;
      }
      try {
        const files = readdirSync(workDir);
        const vttFile = files.find((f) => f.endsWith('.vtt'));
        if (!vttFile) {
          cleanup();
          console.warn(`[Transcript] yt-dlp produced no .vtt for ${videoId}`);
          resolve(null);
          return;
        }
        const vttContent = readFileSync(join(workDir, vttFile), 'utf-8');
        const parsed = parseVtt(vttContent);
        cleanup();
        if (parsed.length === 0) {
          console.warn(`[Transcript] yt-dlp vtt had no usable cues for ${videoId}`);
          resolve(null);
          return;
        }
        resolve(parsed);
      } catch (e) {
        cleanup();
        console.warn(`[Transcript] yt-dlp post-process error: ${e instanceof Error ? e.message : e}`);
        resolve(null);
      }
    });
  });
}

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

      // Fall back to yt-dlp for non-permanent errors (rate-limit, network
      // blips, library bugs). "No transcript" errors are skipped since
      // yt-dlp can't conjure captions that don't exist.
      if (!isNoTranscriptError(e)) {
        console.log(`[Transcript] Library failed, trying yt-dlp fallback for ${videoId}`);
        const ytdlpSegments = await tryYtDlp(videoId, lang as string, cookieFile);
        if (ytdlpSegments && ytdlpSegments.length > 0) {
          const segments = ytdlpSegments.map((seg, i) => ({
            id: `seg-${i + 1}`,
            startMs: seg.startMs,
            endMs: seg.endMs,
            text: seg.text,
          }));
          transcriptCache.set(videoId, {
            segments,
            cachedAt: Date.now(),
            isFailure: false,
          });
          return {
            title: `Video ${videoId}`,
            segments,
            videoId,
            method: 'yt-dlp auto-captions',
          };
        }
        console.log(`[Transcript] yt-dlp fallback also failed for ${videoId}`);
      }

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