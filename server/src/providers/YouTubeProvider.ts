import type { VideoProvider, AnalyzeResult, Segment, ProviderError } from '../types.js';

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://invidious.privacyredirect.com',
  'https://vid.priv.au',
  'https://invidious.projectsegfau.lt'
];

interface InvidiousCaption {
  label: string;
  language: string;
  url: string;
}

interface InvidiousVideoResponse {
  title?: string;
  description?: string;
  captions?: InvidiousCaption[];
}

interface InvidiousCaptionsResponse {
  captions: Array<{
    start: number;
    dur: number;
    text: string;
  }>;
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const fullUrl = instance + url;
      const response = await fetch(fullUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KotoLift/1.0)',
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        return response;
      }
    } catch (err) {
      lastError = err as Error;
      console.warn(`[Invidious] Instance ${instance} failed:`, err);
    }
  }
  
  throw lastError || new Error('All Invidious instances failed');
}

export class YouTubeProvider implements VideoProvider {
  name = 'YouTube (Invidious)';

  canHandle(url: string): boolean {
    return YOUTUBE_REGEX.test(url);
  }

  private extractVideoId(url: string): string | null {
    const match = url.match(YOUTUBEREGEX);
    return match ? match[4] : null;
  }

  async extract(url: string, lang: string = 'en'): Promise<AnalyzeResult> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      const error = new Error('Invalid YouTube URL') as ProviderError;
      error.provider = this.name;
      error.code = 'INVALID_URL';
      throw error;
    }

    try {
      console.log(`[YouTubeProvider] Fetching video info via Invidious for ${videoId}...`);

      // Get video info including captions
      const infoUrl = `/api/v1/videos/${videoId}?format=json`;
      const infoResponse = await fetchWithRetry(infoUrl);
      const videoInfo: InvidiousVideoResponse = await infoResponse.json();

      if (!videoInfo.captions || videoInfo.captions.length === 0) {
        const error = new Error('No captions available for this video') as ProviderError;
        error.provider = this.name;
        error.code = 'NO_CAPTIONS';
        throw error;
      }

      // Find the best matching caption track
      const targetTrack = videoInfo.captions.find((t) => t.language === lang)
        || videoInfo.captions.find((t) => t.language.startsWith(lang))
        || videoInfo.captions[0];

      console.log(`[YouTubeProvider] Using caption track: ${targetTrack.label}`);

      // Fetch the actual captions
      const captionsUrl = targetTrack.url.replace(/&format=json/, '') + '&format=json';
      const captionsResponse = await fetchWithRetry(captionsUrl);
      const captionsData: InvidiousCaptionsResponse = await captionsResponse.json();

      if (!captionsData.captions || captionsData.captions.length === 0) {
        const error = new Error('No caption content available') as ProviderError;
        error.provider = this.name;
        error.code = 'NO_CAPTIONS';
        throw error;
      }

      const segments: Segment[] = captionsData.captions.map((caption, index) => ({
        id: `seg-${index + 1}`,
        startMs: Math.round(caption.start * 1000),
        endMs: Math.round((caption.start + caption.dur) * 1000),
        text: caption.text
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim()
      }));

      console.log(`[YouTubeProvider] Extracted ${segments.length} segments via Invidious`);

      return {
        segments,
        title: videoInfo.title || `Video ${videoId}`
      };

    } catch (err: any) {
      console.error('[YouTubeProvider] Invidious extraction failed:', err.message);
      
      if (err.code === 'NO_CAPTIONS') {
        throw err;
      }
      
      // Return a specific error that video.ts can catch and fallback to Whisper
      const error = new Error(`Invidious failed: ${err.message}. Please try using Whisper transcription.`) as ProviderError;
      error.provider = this.name;
      error.code = 'INVIDIOUS_FAILED';
      throw error;
    }
  }

  async getCaptions(videoId: string, lang?: string): Promise<Segment[]> {
    try {
      const result = await this.extract(`https://www.youtube.com/watch?v=${videoId}`, lang);
      return result.segments;
    } catch {
      return [];
    }
  }
}

// Fix the regex reference
const YOUTUBEREGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
