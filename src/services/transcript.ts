const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

// Cloudflare Worker proxy URL (you can deploy your own)
const CF_WORKER_URL = 'https://yt-transcript.briandejesus.workers.dev';

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
  return match ? match[4] : null;
}

export async function fetchTranscript(videoUrl: string, lang: string = 'en'): Promise<FetchResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  console.log(`[Transcript] Fetching transcript for video: ${videoId}`);

  // Method 1: Try Cloudflare Worker proxy (if deployed)
  try {
    console.log(`[Transcript] Trying Cloudflare Worker proxy...`);
    const response = await fetch(`${CF_WORKER_URL}/transcript/${videoId}?lang=${lang}`);
    if (response.ok) {
      const data = await response.json();
      if (data.segments && data.segments.length > 0) {
        console.log(`[Transcript] Success from CF Worker!`);
        return {
          title: data.title || `Video ${videoId}`,
          segments: data.segments,
          videoId,
          method: 'YouTube Captions'
        };
      }
    }
  } catch (e) {
    console.log(`[Transcript] CF Worker failed:`, e);
  }

  // Method 2: Direct fetch to working services
  const services = [
    {
      name: 'yewtu.be',
      url: (id: string) => `https://yewtu.be/api/v1/videos/${id}?format=json`
    },
    {
      name: 'vid.priv.au',
      url: (id: string) => `https://vid.priv.au/api/v1/videos/${id}?format=json`
    }
  ];

  for (const service of services) {
    try {
      console.log(`[Transcript] Trying ${service.name}...`);
      const response = await fetch(service.url(videoId), {
        mode: 'cors'
      });
      
      if (response.ok) {
        const data = await response.json();
        const title = data.title || `Video ${videoId}`;
        
        // Get captions from the response
        const captions = data.captions || data.subtitles || [];
        
        if (captions.length > 0) {
          const track = captions[0]; // Use first available track
          const captionUrl = track.url || track.baseUrl;
          
          if (captionUrl) {
            const captionResponse = await fetch(captionUrl, { mode: 'cors' });
            if (captionResponse.ok) {
              const xml = await captionResponse.text();
              
              if (xml.includes('<text')) {
                const segments: TranscriptSegment[] = [];
                const matches = xml.matchAll(/<text[^>]*start="([^"]+)"[^>]*dur="([^"]+)"[^>]*>([^<]+)<\/text>/gi);
                
                for (const match of matches) {
                  const startMs = Math.round(parseFloat(match[1]) * 1000);
                  const durMs = Math.round(parseFloat(match[2]) * 1000);
                  const text = match[3]
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
                
                if (segments.length > 0) {
                  console.log(`[Transcript] Success from ${service.name}!`);
                  return { title, segments, videoId, method: 'YouTube Captions' };
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.log(`[Transcript] ${service.name} failed:`, e);
    }
  }

  // If all methods fail, show helpful error
  throw new Error('Could not fetch transcript. This may be due to network restrictions. Try a different video.');
}
