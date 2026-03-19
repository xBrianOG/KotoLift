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

function parseXmlCaptions(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const matches = xml.matchAll(/<text[^>]*start="([^"]+)"[^>]*dur="([^"]+)"[^>]*>([^<]+)<\/text>/gi);
  for (const m of matches) {
    const startMs = Math.round(parseFloat(m[1]) * 1000);
    const durMs = Math.round(parseFloat(m[2]) * 1000);
    const text = m[3]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .trim();
    if (text) {
      segments.push({
        id: `seg-${segments.length + 1}`,
        startMs,
        endMs: startMs + durMs,
        text
      });
    }
  }
  return segments;
}

async function fetchViaPopup(videoId: string, lang = 'en'): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const width = 800;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      `https://www.youtube.com/watch?v=${videoId}`,
      'youtube_transcript',
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for this site.'));
      return;
    }

    let resolved = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 60;
    const CHECK_MS = 500;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        closePopup();
        reject(new Error('Timed out loading YouTube page'));
      }
    }, MAX_ATTEMPTS * CHECK_MS + 3000);

    const intervalId = setInterval(async () => {
      attempts++;
      if (resolved || attempts > MAX_ATTEMPTS) {
        clearInterval(intervalId);
        return;
      }

      try {
        if (popup.closed) {
          if (!resolved) {
            resolved = true;
            clearInterval(intervalId);
            clearTimeout(timeoutId);
            reject(new Error('Popup was closed'));
          }
          return;
        }

        const doc = popup.document;
        if (!doc || doc.readyState !== 'complete') return;

        const title =
          doc.querySelector('h1')?.textContent?.trim() ||
          `Video ${videoId}`;

        const captionTracks = doc.querySelectorAll('track[kind="captions"]');
        if (captionTracks.length === 0) return;

        const targetCode = lang.split('-')[0];
        const langTrack = Array.from(captionTracks).find(
          (t) => t.getAttribute('srclang')?.split('-')[0] === targetCode
        );
        const track = (langTrack || captionTracks[0]) as HTMLTrackElement;

        if (!track.src) return;

        const response = await fetch(track.src);
        if (!response.ok) return;

        const xml = await response.text();
        const segments = parseXmlCaptions(xml);

        if (segments.length === 0) return;

        if (!resolved) {
          resolved = true;
          clearInterval(intervalId);
          clearTimeout(timeoutId);
          closePopup();
          resolve({
            title: title.replace(/ - YouTube$/, '').trim(),
            segments,
            videoId,
            method: 'YouTube Captions'
          });
        }
      } catch {
        // keep trying
      }
    }, CHECK_MS);

    function closePopup() {
      try { popup!.close(); } catch { /* ignore */ }
    }
  });
}

export async function fetchTranscript(videoUrl: string, lang: string = 'en'): Promise<FetchResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  console.log(`[Transcript] Fetching transcript for video: ${videoId}`);

  // Try popup (user's home IP + same-origin access)
  try {
    console.log(`[Transcript] Trying popup window...`);
    const result = await fetchViaPopup(videoId, lang);
    console.log(`[Transcript] Success from popup! Got ${result.segments.length} segments`);
    return result;
  } catch (e) {
    console.log(`[Transcript] Popup failed:`, e);
  }

  // Fallback to Railway backend
  try {
    console.log(`[Transcript] Trying Railway backend...`);
    const response = await fetch(`${RAILWAY_API}/transcript/${videoId}?lang=${lang}`);
    if (response.ok) {
      const data = await response.json();
      if (data.segments && data.segments.length > 0) {
        console.log(`[Transcript] Success from Railway!`);
        return data;
      }
    } else {
      const err = await response.json();
      console.log(`[Transcript] Railway error: ${err.error}`);
    }
  } catch (e) {
    console.error(`[Transcript] Railway failed:`, e);
  }

  throw new Error('Could not fetch transcript. Try a different video.');
}
