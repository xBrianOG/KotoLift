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

export async function fetchTranscriptFromBrowser(videoId: string, lang = 'en'): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
    document.body.appendChild(container);

    const playerDiv = document.createElement('div');
    container.appendChild(playerDiv);

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(script);

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('YouTube player timed out'));
    }, 30000);

    function cleanup() {
      clearTimeout(timeout);
      const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (existingScript) existingScript.remove();
      if (container.parentNode) container.parentNode.removeChild(container);
      if ((window as any).YT) delete (window as any).YT;
    }

    (window as any).onYouTubeIframeAPIReady = async () => {
      try {
        const player = new (window as any).YT.Player(playerDiv, {
          videoId,
          height: '1',
          width: '1',
          playerVars: { 
            autoplay: 0, 
            rel: 0,
            modestbranding: 1
          },
          events: {
            onReady: async () => {
              try {
                const videoTitle = player.getVideoData()?.title || `Video ${videoId}`;
                const availableLangs = player.getAvailableTranslationLanguages();
                
                const track = availableLangs.find((l: any) => l.languageCode === lang)
                  || availableLangs[0];
                
                if (!track) {
                  cleanup();
                  reject(new Error('No caption tracks available'));
                  return;
                }

                const langCode = track.languageCode;
                const captionTracks = player.getOption('captions', 'tracklist') as any[];
                
                if (!captionTracks || captionTracks.length === 0) {
                  cleanup();
                  reject(new Error('No captions available for this video'));
                  return;
                }

                const activeTrack = captionTracks.find((t: any) => t.languageCode === langCode) || captionTracks[0];
                const baseUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&ei=${activeTrack.languageCode}&caps=asr&kind=asr&lang=${activeTrack.languageCode}`;

                const response = await fetch(baseUrl);
                const xml = await response.text();
                const segments = parseXmlCaptions(xml);

                player.destroy();
                cleanup();

                if (segments.length === 0) {
                  reject(new Error('Could not parse captions'));
                  return;
                }

                resolve({
                  title: videoTitle,
                  segments,
                  videoId,
                  method: 'YouTube Captions'
                });
              } catch (e) {
                cleanup();
                reject(e);
              }
            },
            onError: (e: any) => {
              cleanup();
              reject(new Error(`YouTube player error: ${e.data}`));
            }
          }
        });
      } catch (e) {
        cleanup();
        reject(e);
      }
    };
  });
}

export async function fetchTranscript(videoUrl: string, lang: string = 'en'): Promise<FetchResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  console.log(`[Transcript] Fetching transcript for video: ${videoId}`);

  // Try browser-side fetch first (uses user's home IP)
  try {
    console.log(`[Transcript] Trying browser-side fetch (user's home IP)...`);
    const result = await fetchTranscriptFromBrowser(videoId, lang);
    console.log(`[Transcript] Success from browser! Got ${result.segments.length} segments`);
    return result;
  } catch (e) {
    console.log(`[Transcript] Browser fetch failed:`, e);
  }

  // Fallback to Railway backend
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
      const err = await response.json();
      console.log(`[Transcript] Railway returned ${response.status}: ${err.error}`);
    }
  } catch (e) {
    console.error(`[Transcript] Railway backend failed:`, e);
  }

  throw new Error('Could not fetch transcript. Try a different video.');
}
