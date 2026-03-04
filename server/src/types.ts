export interface Segment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface AnalyzeResult {
  title: string;
  segments: Segment[];
  languageDetected?: string;
}

export interface AnalyzeRequest {
  url: string;
  lang?: string;
}

export interface VideoProvider {
  name: string;
  canHandle(url: string): boolean;
  extract(url: string, lang?: string): Promise<AnalyzeResult>;
}

export interface ProviderError extends Error {
  provider: string;
  code: 'NO_CAPTIONS' | 'INVALID_URL' | 'NETWORK_ERROR' | 'OPENAI_KEY_MISSING' | 'VIDEO_TOO_LONG' | 'TRANSCRIPTION_FAILED' | 'AUDIO_DOWNLOAD_FAILED';
}
