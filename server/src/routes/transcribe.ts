import { Router } from 'express';
import { spawn } from 'child_process';
import { createReadStream, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import OpenAI from 'openai';
import { YouTubeTranscriptApi } from 'youtube-transcript-api-js';

const router = Router();

function getCookieFile(): string | null {
  const cookiesBase64 = process.env.YOUTUBE_COOKIES;
  if (!cookiesBase64) return null;
  try {
    const cookies = Buffer.from(cookiesBase64, 'base64').toString('utf-8');
    const tmpFile = join(tmpdir(), 'yt_cookies_transcribe.txt');
    writeFileSync(tmpFile, cookies, 'utf-8');
    return tmpFile;
  } catch {
    return null;
  }
}

async function tryYouTubeCaptions(videoId: string, lang: string): Promise<any[] | null> {
  try {
    const cookiesBase64 = process.env.YOUTUBE_COOKIES;
    let cookieFile: string | null = null;
    if (cookiesBase64) {
      const cookies = Buffer.from(cookiesBase64, 'base64').toString('utf-8');
      cookieFile = join(tmpdir(), 'yt_cookies_caption2.txt');
      writeFileSync(cookieFile, cookies, 'utf-8');
    }

    const api = new YouTubeTranscriptApi(
      undefined,
      undefined,
      cookieFile ? { cookiePath: cookieFile } : undefined
    );

    const langsToTry = [lang, 'en', 'ja', 'es'];
    for (const tryLang of [...new Set(langsToTry)]) {
      try {
        const result = await api.fetch(videoId, [tryLang]);
        const segments = result.snippets
          .map((s: any, i: number) => ({
            id: `seg-${i + 1}`,
            startMs: Math.round(s.start * 1000),
            endMs: Math.round((s.start + s.duration) * 1000),
            text: s.text
              .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
          }))
          .filter((s: any) => s.text);
        if (segments.length > 0) return segments;
      } catch { /* try next lang */ }
    }
  } catch { /* captions not available */ }
  return null;
}

async function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn('yt-dlp', args);
    let stderr = '';
    ytdlp.stderr.on('data', (data) => { stderr += data.toString(); });
    ytdlp.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(stderr));
    });
    ytdlp.on('error', (err) => reject(err));
  });
}

async function downloadAudio(videoId: string, cookieFile: string | null): Promise<string> {
  const tmpDir = tmpdir();
  const outputPath = join(tmpDir, `audio_${videoId}_${Date.now()}.mp3`);
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const base = ['-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', outputPath, url, '--no-playlist'];

  // Strategy 1: iOS client without cookies (iOS bypasses bot detection natively, but rejects cookies)
  try {
    console.log(`[Transcribe] Trying yt-dlp with iOS client (no cookies)...`);
    await runYtDlp([...base, '--extractor-args', 'youtube:player-client=ios']);
    if (existsSync(outputPath)) return outputPath;
  } catch (e: any) {
    console.log(`[Transcribe] iOS client failed: ${e.message?.split('\n')[0]}`);
  }

  // Strategy 2: Android client with cookies
  if (cookieFile) {
    try {
      console.log(`[Transcribe] Trying yt-dlp with Android client + cookies...`);
      await runYtDlp([...base, '--extractor-args', 'youtube:player-client=android', '--cookies', cookieFile]);
      if (existsSync(outputPath)) return outputPath;
    } catch (e: any) {
      console.log(`[Transcribe] Android client failed: ${e.message?.split('\n')[0]}`);
    }

    // Strategy 3: Web client with cookies
    try {
      console.log(`[Transcribe] Trying yt-dlp with web client + cookies...`);
      await runYtDlp([...base, '--extractor-args', 'youtube:player-client=web', '--cookies', cookieFile]);
      if (existsSync(outputPath)) return outputPath;
    } catch (e: any) {
      console.log(`[Transcribe] Web client failed: ${e.message?.split('\n')[0]}`);
    }
  }

  throw new Error('Could not download video audio. YouTube may be blocking this video. Try a different video or refresh your YouTube cookies.');
}

router.get('/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const lang = (req.query.lang as string) || 'en';

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  // Step 1: Try captions first (fast, free, no download needed)
  console.log(`[Transcribe] Trying captions for ${videoId}`);
  const captionSegments = await tryYouTubeCaptions(videoId, lang);
  if (captionSegments) {
    console.log(`[Transcribe] Got ${captionSegments.length} segments via captions`);
    return res.json({
      title: `Video ${videoId}`,
      segments: captionSegments,
      videoId,
      method: 'YouTube Captions'
    });
  }

  // Step 2: Fall back to yt-dlp + Whisper
  console.log(`[Transcribe] No captions, downloading audio for ${videoId}`);
  let audioPath: string | null = null;
  let cookieFile: string | null = null;

  try {
    cookieFile = getCookieFile();
    audioPath = await downloadAudio(videoId, cookieFile);
    console.log(`[Transcribe] Audio downloaded, sending to Whisper...`);

    const openai = new OpenAI({ apiKey });
    const fileStream = createReadStream(audioPath) as unknown as File;

    const whisperResponse = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      language: lang.split('-')[0],
      response_format: 'verbose_json',
      timestamp_granularities: ['segment']
    });

    const segments = (whisperResponse.segments || []).map((seg: any, i: number) => ({
      id: `seg-${i + 1}`,
      startMs: Math.round((seg.start || 0) * 1000),
      endMs: Math.round((seg.end || (seg.start || 0) + 3) * 1000),
      text: (seg.text || '').trim()
    })).filter((s: any) => s.text);

    console.log(`[Transcribe] Got ${segments.length} segments from Whisper`);

    return res.json({
      title: `Video ${videoId}`,
      segments,
      videoId,
      method: 'Whisper AI'
    });
  } catch (e: any) {
    console.error(`[Transcribe] Error:`, e.message);
    return res.status(500).json({ error: e.message || 'Failed to transcribe video' });
  } finally {
    if (audioPath && existsSync(audioPath)) {
      try { unlinkSync(audioPath); } catch { /* ignore */ }
    }
    if (cookieFile && existsSync(cookieFile)) {
      try { unlinkSync(cookieFile); } catch { /* ignore */ }
    }
  }
});

export default router;
