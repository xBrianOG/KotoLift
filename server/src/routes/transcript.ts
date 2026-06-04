import { Router } from 'express';
import { spawn } from 'child_process';
import { YouTubeTranscriptApi } from 'youtube-transcript-api-js';
import { writeFileSync, unlinkSync, existsSync, readdirSync, readFileSync, mkdirSync, statSync } from 'fs';
import { join, dirname, resolve as resolvePath } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const router = Router();

// Resolve a stable on-disk location for the YouTube cookies file. We
// keep the data dir under server/data so the file persists across
// Render redeploys (it lives in the persistent disk volume).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PERSISTENT_COOKIE_PATH = resolvePath(__dirname, '../../data/yt_cookies.txt');

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

// Cookie source resolution. Priority order:
//   1. server/data/yt_cookies.txt  (uploaded at runtime via /api/transcript/cookies)
//   2. YOUTUBE_COOKIES env var     (deploy-time, baked into Render config)
// In either case, we write to /tmp/yt_cookies.txt and hand the path to
// yt-dlp. The path is content-hashed so we only re-write when the
// cookie contents change.
let resolvedCookieFile: string | null = null;
let resolvedCookieHash: string | null = null;

function readCookieSource(): string | null {
  if (existsSync(PERSISTENT_COOKIE_PATH)) {
    try {
      const content = readFileSync(PERSISTENT_COOKIE_PATH, 'utf-8').trim();
      if (content) return content;
    } catch { /* ignore */ }
  }
  const envCookies = process.env.YOUTUBE_COOKIES?.trim();
  if (envCookies) return envCookies;
  return null;
}

function getCookieFile(): string | null {
  const content = readCookieSource();
  if (!content) return null;

  // Cheap content hash so we only re-write the temp file when the
  // cookie content actually changes (vs. on every request).
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  const hashStr = String(hash);

  if (resolvedCookieFile && resolvedCookieHash === hashStr) {
    return resolvedCookieFile;
  }

  try {
    const tmpFile = join(tmpdir(), 'yt_cookies.txt');
    writeFileSync(tmpFile, content, 'utf-8');
    resolvedCookieFile = tmpFile;
    resolvedCookieHash = hashStr;
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

/**
 * YouTube's anti-bot message wraps the actual cause inside a "Could not
 * retrieve a transcript for the video ... This is most likely caused by:
 * The video is unplayable for the following reason: Sign in to confirm
 * you're not a bot" string. This is a TRANSIENT scrape-side block, not a
 * missing-captions condition. yt-dlp can usually get past it (it uses a
 * different fetch path), so we route it through the fallback.
 */
function isBotBlockError(e: any): boolean {
  const msg = e.message || '';
  return msg.includes("you're not a bot") ||
         msg.includes('Sign in to confirm') ||
         msg.includes('not a bot') ||
         msg.includes('Consent cookie') ||
         msg.includes('PO Token');
}

/**
 * The library says "no captions exist for this video" when the video
 * has captions disabled or none were published. yt-dlp cannot conjure
 * captions that don't exist, so we skip the fallback in this case.
 * Note: "Could not retrieve" used to match here, but the library also
 * wraps its bot-block message with that phrase — hence the
 * isBotBlockError check above taking precedence.
 */
function isNoTranscriptError(e: any): boolean {
  const msg = e.message || '';
  if (isBotBlockError(e)) return false;
  return msg.includes('No transcript was found') ||
         msg.includes('Transcript is disabled') ||
         msg.includes('No transcripts were found') ||
         msg.includes('Subtitles are disabled');
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
 *
 * Tries multiple YouTube player clients in order. The default 'web'
 * client is the most aggressively anti-bot-scraped. 'mediaconnect'
 * and 'ios' have much weaker bot detection and are usually
 * successful when the web client gets the 'Sign in to confirm'
 * block. We try them in sequence and return the first success.
 */
async function tryYtDlp(
  videoId: string,
  lang: string,
  cookieFile: string | null,
  timeoutMs = 12000,
): Promise<ParsedVttSegment[] | null> {
  const PLAYER_CLIENTS = ['mediaconnect', 'ios', 'tv', 'web'];
  for (const client of PLAYER_CLIENTS) {
    const result = await tryYtDlpWithClient(videoId, lang, cookieFile, client, timeoutMs);
    if (result && result.length > 0) return result;
  }
  return null;
}

async function tryYtDlpWithClient(
  videoId: string,
  lang: string,
  cookieFile: string | null,
  playerClient: string,
  timeoutMs: number,
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
    '--extractor-args', `youtube:player_client=${playerClient}`,
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
      console.warn(`[Transcript] yt-dlp timeout (client=${playerClient}) for ${videoId}`);
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
      console.warn(`[Transcript] yt-dlp spawn error (client=${playerClient}): ${e.message}`);
      resolve(null);
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        cleanup();
        console.warn(`[Transcript] yt-dlp exit ${code} (client=${playerClient}): ${stderr.slice(-200)}`);
        resolve(null);
        return;
      }
      try {
        const files = readdirSync(workDir);
        const vttFile = files.find((f) => f.endsWith('.vtt'));
        if (!vttFile) {
          cleanup();
          console.warn(`[Transcript] yt-dlp produced no .vtt (client=${playerClient}) for ${videoId}`);
          resolve(null);
          return;
        }
        const vttContent = readFileSync(join(workDir, vttFile), 'utf-8');
        const parsed = parseVtt(vttContent);
        cleanup();
        if (parsed.length === 0) {
          console.warn(`[Transcript] yt-dlp vtt had no usable cues (client=${playerClient}) for ${videoId}`);
          resolve(null);
          return;
        }
        console.log(`[Transcript] yt-dlp succeeded (client=${playerClient}) for ${videoId}: ${parsed.length} segments`);
        resolve(parsed);
      } catch (e) {
        cleanup();
        console.warn(`[Transcript] yt-dlp post-process error (client=${playerClient}): ${e instanceof Error ? e.message : e}`);
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
      const botBlocked = isBotBlockError(e);
      const rateLimited = isRateLimitError(e);
      const noTranscript = isNoTranscriptError(e);

      console.log(
        `[Transcript] Library failed for ${videoId}: bot=${botBlocked} rate=${rateLimited} noTranscript=${noTranscript} msg="${errorMessage.slice(0, 120)}"`,
      );

      // Fall back to yt-dlp for anything that isn't definitively "no
      // captions exist" — yt-dlp can usually get past rate-limit and
      // bot-block, and is worth a try for unknown errors too.
      // tryYtDlp internally tries multiple player clients
      // (mediaconnect → ios → tv → web) in order.
      let ytdlpSegments: ParsedVttSegment[] | null = null;
      if (!noTranscript) {
        console.log(`[Transcript] Library failed, trying yt-dlp fallback for ${videoId}`);
        ytdlpSegments = await tryYtDlp(videoId, lang as string, cookieFile);
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
        console.log(`[Transcript] yt-dlp fallback exhausted all clients for ${videoId}`);
      }

      // Determine error type and cache appropriately
      if (rateLimited || botBlocked) {
        transcriptCache.set(videoId, {
          segments: [],
          cachedAt: Date.now(),
          isFailure: true,
          errorMessage: 'YouTube is blocking requests from this server. Please try again in a few minutes.',
        });
      } else if (noTranscript) {
        // Don't cache "no transcript" errors for too long
        transcriptCache.set(videoId, {
          segments: [],
          cachedAt: Date.now(),
          isFailure: true,
          errorMessage: 'No transcript available for this video.',
        });
      } else {
        transcriptCache.set(videoId, {
          segments: [],
          cachedAt: Date.now(),
          isFailure: true,
          errorMessage: errorMessage,
        });
      }

      // Throw a clean, user-facing error rather than the raw library
      // message (which is full of GitHub-issue-tracking boilerplate
      // that confuses end users).
      let userMessage: string;
      let statusCode: number;
      if (noTranscript) {
        userMessage = 'No transcript available for this video.';
        statusCode = 404;
      } else if (rateLimited || botBlocked) {
        userMessage = 'YouTube is blocking requests from this server. Please try again in a few minutes.';
        statusCode = 429;
      } else {
        userMessage = 'Failed to fetch transcript. Please try again.';
        statusCode = 500;
      }
      const userError: any = new Error(userMessage);
      userError.cause = e;
      userError.status = statusCode;
      throw userError;
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
    const status = typeof e.status === 'number' ? e.status : 500;
    return res.status(status).json({
      error: e.message || 'Failed to fetch transcript',
    });
  }
});

// Admin endpoint to clear cache (for debugging)
router.post('/cache/clear', (req, res) => {
  transcriptCache.clear();
  res.json({ success: true, message: 'Cache cleared' });
});

/**
 * Upload YouTube cookies at runtime. Accepts a raw cookies.txt body
 * (Netscape format, the standard export from browser cookie exporters).
 * Persists to data/yt_cookies.txt so it survives Render restarts
 * (data/ is the persistent disk volume). Call once after extracting
 * cookies from a logged-in browser; subsequent transcript fetches
 * will use them via the --cookies flag to yt-dlp.
 *
 * Example:
 *   curl -X POST -H "Content-Type: text/plain" --data-binary @cookies.txt \
 *        https://your-app/api/transcript/cookies
 */
router.post('/cookies', (req, res) => {
  try {
    // Express body parser uses bodyParser.text() for text/plain by default
    // when content-type matches. We accept either text/plain (raw body)
    // or JSON { "cookies": "..." }.
    let cookies: string | null = null;
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.includes('application/json')) {
      cookies = typeof req.body?.cookies === 'string' ? req.body.cookies : null;
    } else {
      cookies = typeof req.body === 'string' ? req.body.trim() : null;
    }

    if (!cookies) {
      return res.status(400).json({
        error: 'No cookies in body. Send raw cookies.txt as text/plain or JSON { "cookies": "..." }',
      });
    }

    // Sanity check: a valid Netscape cookies file starts with a header line
    // beginning with "# Netscape" or "# HTTP Cookie" or a tab-separated
    // domain line. We don't enforce strictly, just check the first line.
    const firstLine = cookies.split('\n')[0]?.trim() || '';
    const looksValid =
      firstLine.startsWith('# Netscape') ||
      firstLine.startsWith('# HTTP Cookie') ||
      firstLine.includes('\t') ||
      firstLine.startsWith('#') /* comment lines are fine too */;
    if (!looksValid) {
      return res.status(400).json({
        error: 'File does not look like a Netscape-format cookies.txt. First line: ' + firstLine.slice(0, 80),
      });
    }

    // Make sure the data dir exists, then write.
    mkdirSync(dirname(PERSISTENT_COOKIE_PATH), { recursive: true });
    writeFileSync(PERSISTENT_COOKIE_PATH, cookies, 'utf-8');
    const size = statSync(PERSISTENT_COOKIE_PATH).size;

    // Invalidate the in-process resolution cache so the new cookies
    // take effect on the very next transcript request.
    resolvedCookieFile = null;
    resolvedCookieHash = null;

    console.log(`[Transcript] YouTube cookies uploaded (${size} bytes) to ${PERSISTENT_COOKIE_PATH}`);
    return res.json({
      success: true,
      path: PERSISTENT_COOKIE_PATH,
      bytes: size,
      message: 'Cookies saved. Next transcript requests will use them.',
    });
  } catch (e) {
    console.error('[Transcript] Cookie upload failed:', e);
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Upload failed' });
  }
});

/** GET current cookie status. Useful for the setup UI / debugging. */
router.get('/cookies/status', (_req, res) => {
  const persistentExists = existsSync(PERSISTENT_COOKIE_PATH);
  const envSet = !!process.env.YOUTUBE_COOKIES?.trim();
  const source = persistentExists ? 'persistent-file' : envSet ? 'env-var' : 'none';
  return res.json({
    source,
    persistentPath: PERSISTENT_COOKIE_PATH,
    persistentExists,
    envSet,
  });
});

/** DELETE cookies (for clearing a bad cookie file). */
router.delete('/cookies', (_req, res) => {
  try {
    if (existsSync(PERSISTENT_COOKIE_PATH)) {
      unlinkSync(PERSISTENT_COOKIE_PATH);
    }
    resolvedCookieFile = null;
    resolvedCookieHash = null;
    return res.json({ success: true, message: 'Cookies cleared' });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Delete failed' });
  }
});

export default router;