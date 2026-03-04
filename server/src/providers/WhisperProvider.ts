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
const MAX_DURATION_MINUTES = parseInt(process.env.MAX_DURATION_MINUTES || '15', 10);

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

async function getVideoInfo(videoId: string): Promise<{ title: string; duration: number }> {
  const cmd = `yt-dlp --print title --print duration ${videoId}`.split(' ');
  cmd[1] = '--print';
  cmd[2] = 'title';
  cmd[3] = '%(title)s';
  cmd.push('--print');
  cmd.push('duration');
  cmd.push('%(duration)s');
  
  const { stdout } = await execAsync(`yt-dlp --print "title:%(title)s" --print "duration:%(duration)s" "https://www.youtube.com/watch?v=${videoId}"`);
  
  const titleMatch = stdout.match(/title:(.+)/);
  const durationMatch = stdout.match(/duration:(.+)/);
  
  const title = titleMatch ? titleMatch[1].trim() : `Video ${videoId}`;
  const duration = durationMatch ? parseInt(durationMatch[1], 10) : 0;
  
  return { title, duration };
}

export class WhisperProvider implements VideoProvider {
  name = 'Whisper';

  canHandle(url: string): boolean {
    return YOUTUBE_REGEX.test(url);
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

    console.log(`[Whisper] Getting video info for: ${videoId}`);
    const { title, duration } = await getVideoInfo(videoId);

    if (duration > MAX_DURATION_MINUTES * 60) {
      const error = new Error(`Video too long. Maximum duration is ${MAX_DURATION_MINUTES} minutes.`) as ProviderError;
      error.provider = this.name;
      error.code = 'VIDEO_TOO_LONG';
      throw error;
    }

    console.log(`[Whisper] Downloading audio for: ${title}`);

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

  private extractVideoId(url: string): string | null {
    const match = url.match(YOUTUBE_REGEX);
    return match ? match[4] : null;
  }

  private async downloadAudio(videoId: string, outputPath: string): Promise<void> {
    const cmd = `yt-dlp -f "bestaudio" -o "${outputPath}" "https://www.youtube.com/watch?v=${videoId}"`;
    await execAsync(cmd);
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
      const totalMs = 60000;
      const avgMsPerSentence = Math.round(totalMs / sentences.length);
      
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
