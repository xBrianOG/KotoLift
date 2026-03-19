const YOUTUBE_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

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
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
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

export async function fetchTranscript(videoUrl: string, lang: string = 'en'): Promise<FetchResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  console.log(`[Transcript] Fetching transcript for video: ${videoId}`);

  try {
    console.log(`[Transcript] Fetching video page to get API key...`);
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const pageHtml = await pageRes.text();
    
    const apiKeyMatch = pageHtml.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    const apiKey = apiKeyMatch ? apiKeyMatch[1] : 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
    
    const titleMatch = pageHtml.match(/"title":"([^"]+)"/);
    const title = titleMatch ? titleMatch[1].replace(/\\u0026/g, '&') : `Video ${videoId}`;

    console.log(`[Transcript] Got API key, fetching player response...`);
    const playerRes = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: { clientName: 'ANDROID', clientVersion: '20.10.38' }
        },
        videoId
      })
    });
    
    if (!playerRes.ok) {
      throw new Error(`Player API failed: ${playerRes.status}`);
    }
    
    const playerData = await playerRes.json();
    const captionTracks = playerData.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    
    if (captionTracks.length === 0) {
      throw new Error('No captions available for this video');
    }
    
    const track = captionTracks.find((t: { languageCode: string }) => t.languageCode === lang) || captionTracks[0];
    console.log(`[Transcript] Found caption track: ${track.languageCode}`);
    
    const xmlRes = await fetch(track.baseUrl);
    const xml = await xmlRes.text();
    const segments = parseXmlCaptions(xml);
    
    console.log(`[Transcript] Got ${segments.length} segments`);
    
    return {
      title,
      segments,
      videoId,
      method: 'YouTube Captions'
    };
  } catch (e) {
    console.error(`[Transcript] Failed:`, e);
    throw new Error('Could not fetch transcript. Try a different video.');
  }
}
