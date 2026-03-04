import { YoutubeTranscript } from 'youtube-transcript';
import type { VideoProvider, AnalyzeResult, Segment, ProviderError } from '../types.js';

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export class YouTubeProvider implements VideoProvider {
  name = 'YouTube';

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

    try {
      console.log(`[YouTubeProvider] Fetching captions for video: ${videoId}`);
      const transcripts = await YoutubeTranscript.fetchTranscript(videoId, { lang: lang || 'en' });
      
      if (!transcripts || transcripts.length === 0) {
        const error = new Error('No captions available for this video') as ProviderError;
        error.provider = this.name;
        error.code = 'NO_CAPTIONS';
        throw error;
      }

      const segments: Segment[] = transcripts.map((item, index) => {
        const startMs = Math.round(item.offset * 1000);
        const durationMs = Math.round(item.duration * 1000);
        return {
          id: `seg-${index + 1}`,
          startMs,
          endMs: startMs + durationMs,
          text: item.text
        };
      });

      console.log(`[YouTubeProvider] Found ${segments.length} caption segments`);

      return {
        segments,
        title: `YouTube Video (${videoId})`
      };
    } catch (err: any) {
      console.error('[YouTubeProvider] Error fetching captions:', err.message);
      const error = new Error(`Failed to fetch YouTube captions: ${err.message}`) as ProviderError;
      error.provider = this.name;
      error.code = 'NO_CAPTIONS';
      throw error;
    }
  }

  async getCaptions(videoId: string, lang?: string): Promise<Segment[]> {
    try {
      const transcripts = await YoutubeTranscript.fetchTranscript(videoId, { lang: lang || 'en' });
      
      if (!transcripts || transcripts.length === 0) {
        return [];
      }

      return transcripts.map((item, index) => {
        const startMs = Math.round(item.offset * 1000);
        const durationMs = Math.round(item.duration * 1000);
        return {
          id: `seg-${index + 1}`,
          startMs,
          endMs: startMs + durationMs,
          text: item.text
        };
      });
    } catch (err) {
      console.error('[YouTubeProvider] Error in getCaptions:', err);
      return [];
    }
  }

  private extractVideoId(url: string): string | null {
    const match = url.match(YOUTUBE_REGEX);
    return match ? match[4] : null;
  }
}
