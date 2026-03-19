declare module 'youtube-transcript-api' {
  export interface TranscriptSegment {
    offset: number;
    duration: number;
    text: string;
  }

  export class YoutubeTranscript {
    static forVideo(videoId: string): Promise<TranscriptSegment[]>;
    static getAvailableLanguages(videoId: string): Promise<string[]>;
  }
}
