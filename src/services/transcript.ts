const YOUTUBE_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

const RAILWAY_API = 'https://sumi.sumidev.com/api';

export interface TranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface FetchResult {
  title: string;
  segments: TranscriptSegment[];
  videoId: string;
  method: string;
}

function extractVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
}

export async function fetchTranscript(videoUrl: string, lang: string = 'en'): Promise<FetchResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  console.log(`[Transcript] Transcribing video: ${videoId}`);

  const response = await fetch(`${RAILWAY_API}/transcribe/${videoId}?lang=${lang}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Could not transcribe video. Please try again.');
  }

  if (!data.segments || data.segments.length === 0) {
    throw new Error('No speech detected in this video.');
  }

  console.log(`[Transcript] Got ${data.segments.length} segments`);
  return data;
}
