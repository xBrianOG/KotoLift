const YOUTUBE_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

const API_BASE = import.meta.env.VITE_API_BASE || 'https://kotolift.onrender.com';

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

async function fetchWithTimeout(url: string, timeoutMs: number = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

export async function fetchTranscript(videoUrl: string, lang: string = 'en'): Promise<FetchResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  console.log(`[Transcript] Fetching transcript for: ${videoId}`);

  const response = await fetchWithTimeout(`${API_BASE}/api/transcript/${videoId}?lang=${lang}`, 8000);

  if (!response.ok) {
    let errorMessage = 'Failed to fetch transcript';
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  const data: FetchResult = await response.json();

  if (!data.segments || data.segments.length === 0) {
    throw new Error('No speech detected in this video.');
  }

  console.log(`[Transcript] Got ${data.segments.length} segments via ${data.method}`);
  return data;
}