import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import FormData from 'form-data';
import axios from 'axios';
import { YouTubeTranscriptApi } from 'youtube-transcript-api-js';
import type { VideoProvider, AnalyzeResult, Segment, ProviderError } from '../types.js';

const execAsync = promisify(exec);

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const TRANSCRIBE_MODEL = process.env.TRANSCRIBE_MODEL || 'whisper-1';

const CACHE_DIR = './cache/transcripts';

interface WhisperResponse {
  text: string;
  language?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCacheKey(url: string, lang?: string): string {
  const hash = crypto.createHash('sha256').update(`${url}:${lang || 'auto'}`).digest('hex');
  return hash;
}

function getCachePath(url: string, lang?: string): string {
  ensureCacheDir();
  const key = getCacheKey(url, lang);
  return path.join(CACHE_DIR, `${key}.json`);
}

function getCachedResult(url: string, lang?: string): AnalyzeResult | null {
  try {
    const cachePath = getCachePath(url, lang);
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Cache read error:', e);
  }
  return null;
}

function cacheResult(url: string, lang: string | undefined, result: AnalyzeResult): void {
  try {
    const cachePath = getCachePath(url, lang);
    fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Cache write error:', e);
  }
}

/** Write YOUTUBE_COOKIES env var (base64 Netscape cookies) to a temp file for yt-dlp */
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

export class WhisperProvider implements VideoProvider {
  name = 'Whisper';

  canHandle(url: string): boolean {
    return YOUTUBE_REGEX.test(url);
  }

  private extractVideoId(url: string): string | null {
    const match = url.match(YOUTUBE_REGEX);
    return match ? match[4] : null;
  }

  async extract(url: string, lang?: string): Promise<AnalyzeResult> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      const error = new Error('Invalid YouTube URL') as ProviderError;
      error.provider = this.name;
      error.code = 'INVALID_URL';
      throw error;
    }

    const cached = getCachedResult(url, lang);
    if (cached) {
      console.log(`[Whisper] Using cached result for ${url}`);
      return cached;
    }

    // --- Step 1: Try captions via youtube-transcript-api-js (fast, no yt-dlp needed) ---
    try {
      console.log(`[Whisper] Trying YouTube captions for ${videoId}...`);
      const result = await this.extractViaCaptions(videoId, lang);
      console.log(`[Whisper] Got ${result.segments.length} segments via captions`);
      cacheResult(url, lang, result);
      return result;
    } catch (captionErr: any) {
      console.log(`[Whisper] Captions not available (${captionErr.message}), falling back to Whisper AI...`);
    }

    // --- Step 2: Fall back to yt-dlp + Whisper ---
    if (!OPENAI_API_KEY) {
      const error = new Error('No captions available for this video and OpenAI API key is not configured for AI transcription.') as ProviderError;
      error.provider = this.name;
      error.code = 'OPENAI_KEY_MISSING';
      throw error;
    }

    console.log(`[Whisper] Processing video via AI transcription: ${videoId}`);

    const tempFile = path.join(os.tmpdir(), `whisper-${Date.now()}.m4a`);
    let cookieFile: string | null = null;

    try {
      cookieFile = getCookieFile();
      await this.downloadAudio(videoId, tempFile, cookieFile);
      console.log(`[Whisper] Transcribing audio...`);

      const { segments, languageDetected } = await this.transcribeAudio(tempFile, lang);

      const result: AnalyzeResult = {
        title: `Video ${videoId}`,
        segments,
        languageDetected
      };

      cacheResult(url, lang, result);
      return result;
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      if (cookieFile && existsSync(cookieFile)) {
        try { unlinkSync(cookieFile); } catch { /* ignore */ }
      }
    }
  }

  private async extractViaCaptions(videoId: string, lang?: string): Promise<AnalyzeResult> {
    const cookiesBase64 = process.env.YOUTUBE_COOKIES;
    let cookieFile: string | null = null;

    try {
      if (cookiesBase64) {
        const cookies = Buffer.from(cookiesBase64, 'base64').toString('utf-8');
        cookieFile = join(tmpdir(), 'yt_cookies_caption.txt');
        writeFileSync(cookieFile, cookies, 'utf-8');
      }

      const api = new YouTubeTranscriptApi(
        undefined,
        undefined,
        cookieFile ? { cookiePath: cookieFile } : undefined
      );

      // Try requested lang first, then English, then any available
      const langsToTry = lang ? [lang, 'en'] : ['en', 'ja', 'es'];
      let lastError: any;

      for (const tryLang of [...new Set(langsToTry)]) {
        try {
          const result = await api.fetch(videoId, [tryLang]);
          const segments: Segment[] = result.snippets.map((snippet: any, i: number) => ({
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
          })).filter((s: Segment) => s.text);

          if (segments.length === 0) throw new Error('Empty captions');

          return {
            title: `Video ${videoId}`,
            segments,
            languageDetected: tryLang
          };
        } catch (e) {
          lastError = e;
        }
      }

      throw lastError || new Error('No captions found');
    } finally {
      if (cookieFile && existsSync(cookieFile)) {
        try { unlinkSync(cookieFile); } catch { /* ignore */ }
      }
    }
  }

  private async downloadAudio(videoId: string, outputPath: string, cookieFile: string | null): Promise<void> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const base = ['-f', 'bestaudio/best', '-o', outputPath, url, '--no-playlist'];

    const tryDownload = (args: string[]): Promise<void> =>
      new Promise((resolve, reject) => {
        const proc = execAsync(['yt-dlp', ...args].join(' '));
        proc.then(() => {
          if (fs.existsSync(outputPath)) resolve();
          else reject(new Error('Output file not found'));
        }).catch(reject);
      });

    // Strategy 1: iOS client without cookies (bypasses bot detection natively, rejects cookies)
    try {
      console.log(`[Whisper] Trying iOS client (no cookies)...`);
      await execAsync(`yt-dlp --extractor-args "youtube:player-client=ios" ${base.join(' ')}`);
      if (fs.existsSync(outputPath)) return;
    } catch (e: any) {
      console.log(`[Whisper] iOS failed: ${e.message?.split('\n')[0]}`);
    }

    // Strategy 2: Android client with cookies
    if (cookieFile) {
      try {
        console.log(`[Whisper] Trying Android client + cookies...`);
        await execAsync(`yt-dlp --extractor-args "youtube:player-client=android" --cookies "${cookieFile}" ${base.join(' ')}`);
        if (fs.existsSync(outputPath)) return;
      } catch (e: any) {
        console.log(`[Whisper] Android failed: ${e.message?.split('\n')[0]}`);
      }

      // Strategy 3: Web client with cookies
      try {
        console.log(`[Whisper] Trying web client + cookies...`);
        await execAsync(`yt-dlp --extractor-args "youtube:player-client=web" --cookies "${cookieFile}" ${base.join(' ')}`);
        if (fs.existsSync(outputPath)) return;
      } catch (e: any) {
        console.log(`[Whisper] Web failed: ${e.message?.split('\n')[0]}`);
      }
    }

    const error = new Error(
      'Could not download this video. Try a video with captions, or refresh your YouTube cookies.'
    ) as ProviderError;
    error.provider = 'Whisper';
    error.code = 'AUDIO_DOWNLOAD_FAILED';
    throw error;
  }

  private async transcribeAudio(audioPath: string, lang?: string): Promise<{ segments: Segment[], languageDetected?: string }> {
    const form = new FormData();

    form.append('file', fs.createReadStream(audioPath), {
      filename: 'audio.m4a',
      contentType: 'audio/mp4'
    });

    form.append('model', TRANSCRIBE_MODEL);
    form.append('response_format', 'verbose_json');

    if (lang) {
      form.append('language', this.mapLanguageCode(lang));
    }

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          ...form.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const data = response.data as WhisperResponse;

    return {
      segments: this.parseWhisperResponse(data),
      languageDetected: data.language
    };
  }

  private mapLanguageCode(lang: string | undefined): string {
    if (!lang || lang === 'auto') return '';
    const langMap: Record<string, string> = { 'ja': 'ja', 'en': 'en', 'es': 'es' };
    return langMap[lang] || '';
  }

  private parseWhisperResponse(data: WhisperResponse): Segment[] {
    if (data.segments && data.segments.length > 0) {
      return data.segments.map((seg, index) => ({
        id: `seg-${index + 1}`,
        startMs: Math.round(seg.start * 1000),
        endMs: Math.round(seg.end * 1000),
        text: seg.text.trim()
      }));
    }

    if (data.text) {
      const sentences = this.splitIntoSentences(data.text);
      const avgMsPerSentence = Math.round(60000 / sentences.length);

      return sentences.map((text, index) => ({
        id: `seg-${index + 1}`,
        startMs: index * avgMsPerSentence,
        endMs: (index + 1) * avgMsPerSentence,
        text: text.trim()
      }));
    }

    throw new Error('No transcription data returned');
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/(?<=[。.!?])\s+/)
      .filter(s => s.trim().length > 0);
  }
}
