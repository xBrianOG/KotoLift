import { Router } from 'express';
import { YouTubeTranscriptApi } from 'youtube-transcript-api-js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const router = Router();

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

router.get('/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const { lang = 'en' } = req.query;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  let cookieFile: string | null = null;
  try {
    console.log(`[Transcript] Fetching transcript for ${videoId}`);
    
    cookieFile = getCookieFile();
    if (cookieFile) {
      console.log(`[Transcript] Using YouTube cookies`);
    } else {
      console.log(`[Transcript] No cookies configured, trying without auth`);
    }

    const api = new YouTubeTranscriptApi(undefined, undefined, cookieFile ? { cookiePath: cookieFile } : undefined);
    const result = await api.fetch(videoId, [lang as string]);

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

    return res.json({
      title: `Video ${videoId}`,
      segments,
      videoId,
      method: 'YouTube Captions'
    });
  } catch (e: any) {
    console.error(`[Transcript] Error:`, e.message);
    return res.status(500).json({ error: e.message || 'Failed to fetch transcript' });
  } finally {
    if (cookieFile && existsSync(cookieFile)) {
      try { unlinkSync(cookieFile); } catch { /* ignore */ }
    }
  }
});

export default router;
