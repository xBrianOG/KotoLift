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

  console.log(`[Transcript] Fetching transcript for video: ${videoId}`);

  try {
    console.log(`[Transcript] Trying Railway backend proxy...`);
    const response = await fetch(`${RAILWAY_API}/transcript/${videoId}?lang=${lang}`);
    if (response.ok) {
      const data = await response.json();
      if (data.segments && data.segments.length > 0) {
        console.log(`[Transcript] Success from Railway backend!`);
        return data;
      }
    } else {
      console.log(`[Transcript] Railway returned ${response.status}`);
    }
  } catch (e) {
    console.error(`[Transcript] Railway backend failed:`, e);
  }

  throw new Error('Could not fetch transcript. Try a different video.');
}
