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

/**
 * Discriminated union for the safe variant. Lets the caller distinguish
 * "the transcript genuinely doesn't exist" from "YouTube is blocking us"
 * from "the network blipped" — each of which calls for a different UI.
 */
export type TranscriptOutcome =
  | { ok: true; data: FetchResult }
  | { ok: false; status: 'no-transcript'; message: string }
  | { ok: false; status: 'transient'; message: string }
  | { ok: false; status: 'unknown'; message: string };

function extractVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
}

async function fetchWithTimeout(url: string, timeoutMs: number = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/**
 * Throwing variant. Kept for callers that just want success or an Error.
 */
export async function fetchTranscript(videoUrl: string, lang: string = 'en'): Promise<FetchResult> {
  const outcome = await fetchTranscriptSafe(videoUrl, lang);
  if (outcome.ok) return outcome.data;
  throw new Error(outcome.message);
}

/**
 * Safe variant. Returns a discriminated union so the caller can decide
 * what to do based on the failure category:
 *   - no-transcript: 404 from the server, the video has no captions.
 *     yt-dlp can't help. Show "no captions available" in the UI.
 *   - transient: 429 / bot-block. yt-dlp also failed. Show the
 *     "upload cookies" banner so the user can unblock future fetches.
 *   - unknown: any other failure. Show a generic retry option.
 */
export async function fetchTranscriptSafe(
  videoUrl: string,
  lang: string = 'en',
): Promise<TranscriptOutcome> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return { ok: false, status: 'unknown', message: 'Invalid YouTube URL' };
  }

  console.log(`[Transcript] Fetching transcript for: ${videoId}`);

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${API_BASE}/api/transcript/${videoId}?lang=${lang}`,
      8000,
    );
  } catch (e) {
    return {
      ok: false,
      status: 'transient',
      message: e instanceof Error ? e.message : 'Network error while fetching transcript',
    };
  }

  if (response.ok) {
    try {
      const data: FetchResult = await response.json();
      if (!data.segments || data.segments.length === 0) {
        return {
          ok: false,
          status: 'no-transcript',
          message: 'No captions available for this video.',
        };
      }
      console.log(`[Transcript] Got ${data.segments.length} segments via ${data.method}`);
      return { ok: true, data };
    } catch {
      return { ok: false, status: 'unknown', message: 'Malformed transcript response' };
    }
  }

  // Non-2xx. Try to read the server's error message and categorize.
  let serverMessage = `HTTP ${response.status}`;
  try {
    const body = await response.json();
    if (typeof body.error === 'string') serverMessage = body.error;
  } catch {
    /* ignore */
  }

  if (response.status === 404) {
    return { ok: false, status: 'no-transcript', message: serverMessage };
  }
  if (response.status === 429) {
    return { ok: false, status: 'transient', message: serverMessage };
  }
  if (response.status >= 500) {
    return { ok: false, status: 'transient', message: serverMessage };
  }
  return { ok: false, status: 'unknown', message: serverMessage };
}
