import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import FormData from 'form-data';
import axios from 'axios';
// @ts-ignore - youtube-transcript-api doesn't have types
import * as youtubeTranscript from 'youtube-transcript-api';
import type { VideoProvider, AnalyzeResult, Segment, ProviderError } from '../types.js';

const execAsync = promisify(exec);

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const TRANSCRIBE_MODEL = process.env.TRANSCRIBE_MODEL || 'whisper-1';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

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

async function getVideoTitle(videoId: string): Promise<string> {
  if (YOUTUBE_API_KEY) {
    try {
      const response = await fetch(
        `${YOUTUBE_API_BASE}/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
      );
      if (response.ok) {
        const data = await response.json();
        const title = data.items?.[0]?.snippet?.title;
        if (title) return title;
      }
    } catch (e) {
      console.error('[Whisper] YouTube API title fetch failed:', e);
    }
  }
  return `Video ${videoId}`;
}

async function getTranscriptFromYouTube(videoId: string, lang: string = 'en'): Promise<Segment[]> {
  try {
    // @ts-ignore - youtube-transcript-api doesn't have types
    const transcript = await youtubeTranscript.YoutubeTranscript.forVideo(videoId) as Array<{offset: number, duration: number, text: string}>;
    
    const segments: Segment[] = transcript.map((item: {offset: number, duration: number, text: string}, index: number) => ({
      id: `seg-${index + 1}`,
      startMs: Math.round(item.offset * 1000),
      endMs: Math.round((item.offset + item.duration) * 1000),
      text: item.text
    }));
    
    console.log(`[Whisper] Got ${segments.length} transcript segments via youtube-transcript-api`);
    return segments;
  } catch (err: any) {
    console.log('[Whisper] youtube-transcript-api failed:', err.message);
    throw err;
  }
}

export class WhisperProvider implements VideoProvider {
  name = 'Whisper';

  canHandle(url: string): boolean {
    return YOUTUBE_REGEX.test(url);
  }

  private extractVideoId(url: string): string | null {
    const match = url.match(YOUTUBEREGEX);
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

    console.log(`[Whisper] Processing video: ${videoId}`);

    let title = `Video ${videoId}`;
    let segments: Segment[] = [];
    let method = '';

    // Step 1: Try youtube-transcript-api (free, no download needed)
    try {
      title = await getVideoTitle(videoId);
      console.log(`[Whisper] Got title: ${title}`);
      
      const transcriptLang = lang || 'en';
      segments = await getTranscriptFromYouTube(videoId, transcriptLang);
      method = 'Transcript (Free)';
      
      if (segments.length > 0) {
        const result: AnalyzeResult = { title, segments };
        cacheResult(url, lang, result);
        console.log(`[Whisper] Successfully got ${segments.length} transcript segments`);
        return { ...result, languageDetected: transcriptLang };
      }
    } catch (transcriptErr) {
      console.log('[Whisper] youtube-transcript-api failed, trying YouTube captions...');
    }

    // Step 2: Try OpenAI Whisper as last resort
    if (!OPENAI_API_KEY) {
      const error = new Error('No transcript available for this video and OpenAI API key not configured.') as ProviderError;
      error.provider = this.name;
      error.code = 'TRANSCRIPTION_FAILED';
      throw error;
    }

    console.log(`[Whisper] Trying Whisper AI transcription...`);

    try {
      const tempFile = path.join(os.tmpdir(), `whisper-${Date.now()}.m4a`);
      
      // Try to download audio using yt-dlp with alternative methods
      try {
        await this.downloadAudio(videoId, tempFile);
      } catch (downloadErr: any) {
        const error = new Error('This video couldn\'t be transcribed. Try a different video.') as ProviderError;
        error.provider = this.name;
        error.code = 'TRANSCRIPTION_FAILED';
        throw error;
      }

      const { segments: whisperSegments, languageDetected } = await this.transcribeAudio(tempFile, lang);
      segments = whisperSegments;
      method = 'AI Transcription';

      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }

      const result: AnalyzeResult = { title, segments, languageDetected };
      cacheResult(url, lang, result);
      console.log(`[Whisper] Successfully transcribed ${segments.length} segments via Whisper`);
      return result;
    } catch (whisperErr: any) {
      console.error('[Whisper] Whisper transcription failed:', whisperErr.message);
      const error = new Error('This video couldn\'t be transcribed. Try a different video.') as ProviderError;
      error.provider = this.name;
      error.code = 'TRANSCRIPTION_FAILED';
      throw error;
    }
  }

  private async downloadAudio(videoId: string, outputPath: string): Promise<void> {
    const methods = [
      // Method 1: Standard yt-dlp
      `yt-dlp -f "bestaudio/best" -o "${outputPath}" "https://www.youtube.com/watch?v=${videoId}"`,
      // Method 2: With iOS client
      `yt-dlp --extractor-args "youtube:player-client=ios" -f "bestaudio" -o "${outputPath}" "https://www.youtube.com/watch?v=${videoId}"`,
      // Method 3: With android client
      `yt-dlp --extractor-args "youtube:player-client=android" -f "bestaudio" -o "${outputPath}" "https://www.youtube.com/watch?v=${videoId}"`,
    ];

    for (let i = 0; i < methods.length; i++) {
      try {
        console.log(`[Whisper] Trying download method ${i + 1}...`);
        await execAsync(methods[i]);
        console.log(`[Whisper] Download method ${i + 1} succeeded`);
        return;
      } catch (err: any) {
        console.log(`[Whisper] Download method ${i + 1} failed: ${err.message}`);
        if (i === methods.length - 1) {
          const error = new Error('Failed to download video audio.') as ProviderError;
          error.provider = 'Whisper';
          error.code = 'TRANSCRIPTION_FAILED';
          throw error;
        }
      }
    }
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
    const langMap: Record<string, string> = {
      'ja': 'ja',
      'en': 'en',
      'es': 'es'
    };
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

const YOUTUBEREGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
