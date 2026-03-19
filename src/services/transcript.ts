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

async function fetchTranscriptFromIframe(videoId: string, lang = 'en'): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;pointer-events:none;';
    iframe.title = 'YouTube video';
    iframe.src = `https://www.youtube.com/watch?v=${videoId}`;
    document.body.appendChild(iframe);

    let resolved = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 50;
    const CHECK_MS = 500;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('Timed out waiting for YouTube page'));
      }
    }, MAX_ATTEMPTS * CHECK_MS + 2000);

    const intervalId = setInterval(async () => {
      attempts++;
      if (resolved || attempts > MAX_ATTEMPTS) {
        clearInterval(intervalId);
        return;
      }

      try {
        const win = iframe.contentWindow;
        const doc = win?.document;
        if (!doc || !win) return;

        const yt = (win as any).yt;
        if (!yt?.playerService?.createPlayer) return;

        const title =
          doc.querySelector('h1')?.textContent?.trim() ||
          (win as any).yt?.playerModule?.playerMap?.values()?.next()?.value?.getVideoData?.()?.title ||
          `Video ${videoId}`;

        const captionTracks = doc.querySelectorAll('track[kind="captions"]');
        if (captionTracks.length === 0) return;

        const targetCode = lang.split('-')[0];
        const langTrack = Array.from(captionTracks).find(
          (t) => t.getAttribute('srclang')?.split('-')[0] === targetCode
        );
        const track = (langTrack || captionTracks[0]) as HTMLTrackElement;

        if (!track.src) return;

        // Within the iframe, fetch should work (same origin)
        const response = await win.fetch(track.src);
        if (!response.ok) return;

        const xml = await response.text();
        const segments = parseXmlCaptions(xml);

        if (segments.length === 0) return;

        if (!resolved) {
          resolved = true;
          clearInterval(intervalId);
          clearTimeout(timeoutId);
          cleanup();
          resolve({
            title: title.replace(/ - YouTube$/, '').trim(),
            segments,
            videoId,
            method: 'YouTube Captions'
          });
        }
      } catch {
        // ignore errors during polling
      }
    }, CHECK_MS);

    function cleanup() {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      delete (window as any).yt;
    }
  });
}

export async function fetchTranscript(videoUrl: string, lang: string = 'en'): Promise<FetchResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  console.log(`[Transcript] Fetching transcript for video: ${videoId}`);

  // Try iframe (user's home IP + same-origin access to captions)
  try {
    console.log(`[Transcript] Trying YouTube iframe (user's home IP)...`);
    const result = await fetchTranscriptFromIframe(videoId, lang);
    console.log(`[Transcript] Success from iframe! Got ${result.segments.length} segments`);
    return result;
  } catch (e) {
    console.log(`[Transcript] iframe failed:`, e);
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
