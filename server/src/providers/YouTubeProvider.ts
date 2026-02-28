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

    const error = new Error(
      'YouTube captions are currently unavailable due to API changes. ' +
      'Use Provider 2 (Whisper) for audio transcription instead.'
    ) as ProviderError;
    error.provider = this.name;
    error.code = 'NO_CAPTIONS';
    throw error;
  }

  private extractVideoId(url: string): string | null {
    const match = url.match(YOUTUBE_REGEX);
    return match ? match[4] : null;
  }
}
