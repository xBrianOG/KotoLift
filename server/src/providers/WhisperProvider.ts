import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import FormData from 'form-data';
import axios from 'axios';
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

    if (!OPENAI_API_KEY) {
      const error = new Error('OpenAI API key not configured') as ProviderError;
      error.provider = this.name;
      error.code = 'OPENAI_KEY_MISSING';
      throw error;
    }

    console.log(`[Whisper] Processing video: ${videoId}`);

    // Get video title
    const title = `Video ${videoId}`;

    console.log(`[Whisper] Downloading audio...`);

    const tempFile = path.join(os.tmpdir(), `whisper-${Date.now()}.m4a`);

    try {
      await this.downloadAudio(videoId, tempFile);
      console.log(`[Whisper] Transcribing audio...`);
      
      const { segments, languageDetected } = await this.transcribeAudio(tempFile, lang);
      
      const result: AnalyzeResult = { 
        title, 
        segments,
        languageDetected
      };
      
      cacheResult(url, lang, result);
      
      return result;
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  private async downloadAudio(videoId: string, outputPath: string): Promise<void> {
    const methods = [
      `yt-dlp -f "bestaudio/best" -o "${outputPath}" "https://www.youtube.com/watch?v=${videoId}"`,
      `yt-dlp --extractor-args "youtube:player-client=ios" -f "bestaudio" -o "${outputPath}" "https://www.youtube.com/watch?v=${videoId}"`,
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
          error.code = 'AUDIO_DOWNLOAD_FAILED';
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
