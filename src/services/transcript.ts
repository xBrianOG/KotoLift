const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

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

async function tryFetch(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit'
    });
    if (response.ok) {
      return await response.text();
    }
  } catch (e) {
    console.log(`[Transcript] Fetch failed for ${url}`);
  }
  return null;
}

async function tryFetchWithProxy(url: string): Promise<string | null> {
  // Try multiple CORS proxies
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];
  
  for (const proxy of proxies) {
    try {
      const response = await fetch(proxy);
      if (response.ok) {
        return await response.text();
      }
    } catch (e) {
      console.log(`[Transcript] Proxy ${proxy} failed`);
    }
  }
  return null;
}

async function getCaptionsFromRetters(videoId: string, lang: string): Promise<{segments: TranscriptSegment[], title: string} | null> {
  // Try retters.com which has transcripts
  const url = `https://retters.com/api/transcript/${videoId}`;
  const text = await tryFetch(url);
  
  if (text) {
    try {
      const data = JSON.parse(text);
      if (data.transcript || data.captions) {
        const items = data.transcript || data.captions;
        const segments: TranscriptSegment[] = items.map((item: any, index: number) => ({
          id: `seg-${index + 1}`,
          startMs: (item.start || item.startTime || index * 3000),
          endMs: (item.end || item.endTime || (index + 1) * 3000),
          text: item.text || item.content || item.caption || ''
        })).filter((s: TranscriptSegment) => s.text.trim());
        
        return {
          segments,
          title: data.title || `Video ${videoId}`
        };
      }
    } catch (e) {
      console.log(`[Transcript] Retters parsing failed`);
    }
  }
  return null;
}

async function getCaptionsFromYouTubeSubtitles(videoId: string, lang: string): Promise<{segments: TranscriptSegment[], title: string} | null> {
  // Try youtube-subtitles.com
  const url = `https://www.youtube-subtitles.com/transcript/${videoId}`;
  const text = await tryFetch(url);
  
  if (text && text.includes('<text')) {
    const segments: TranscriptSegment[] = [];
    const matches = text.matchAll(/<text[^>]*start="([^"]+)"[^>]*dur="([^"]+)"[^>]*>([^<]+)<\/text>/gi);
    
    for (const match of matches) {
      segments.push({
        id: `seg-${segments.length + 1}`,
        startMs: Math.round(parseFloat(match[1]) * 1000),
        endMs: Math.round((parseFloat(match[1]) + parseFloat(match[2])) * 1000),
        text: match[3].trim()
      });
    }
    
    if (segments.length > 0) {
      return { segments, title: `Video ${videoId}` };
    }
  }
  return null;
}

async function getCaptionsFromInvidious(videoId: string, lang: string): Promise<{segments: TranscriptSegment[], title: string} | null> {
  // Try various invidious instances with proxy
  const instances = [
    'https://yewtu.be/api/v1',
    'https://invidious.privacyredirect.com/api/v1',
  ];
  
  for (const base of instances) {
    const url = `${base}/videos/${videoId}?format=json`;
    const text = await tryFetchWithProxy(url);
    
    if (text) {
      try {
        const data = JSON.parse(text);
        const title = data.title || `Video ${videoId}`;
        
        // Look for captions in various formats
        let captions = data.captions || data.subtitles || data.captionTracks || [];
        
        if (captions.length === 0 && data.playerResponse?.captions?.captionTracks) {
          captions = data.playerResponse.captions.captionTracks;
        }
        
        if (captions.length > 0) {
          // Find the best caption track
          const track = captions.find((c: any) => 
            c.languageCode === lang || c.language_code === lang
          ) || captions[0];
          
          if (track) {
            // Try to fetch the caption content
            const captionUrl = track.url || track.baseUrl;
            if (captionUrl) {
              const captionText = await tryFetchWithProxy(captionUrl);
              if (captionText && captionText.includes('<text')) {
                const segments: TranscriptSegment[] = [];
                const matches = captionText.matchAll(/<text[^>]*start="([^"]+)"[^>]*dur="([^"]+)"[^>]*>([^<]+)<\/text>/gi);
                
                for (const match of matches) {
                  segments.push({
                    id: `seg-${segments.length + 1}`,
                    startMs: Math.round(parseFloat(match[1]) * 1000),
                    endMs: Math.round((parseFloat(match[1]) + parseFloat(match[2])) * 1000),
                    text: match[3]
                      .replace(/&amp;/g, '&')
                      .replace(/&quot;/g, '"')
                      .replace(/&#39;/g, "'")
                      .trim()
                  });
                }
                
                if (segments.length > 0) {
                  return { segments, title };
                }
              }
            }
          }
        }
      } catch (e) {
        console.log(`[Transcript] Invidious ${base} parsing failed`);
      }
    }
  }
  return null;
}

export async function fetchTranscript(videoUrl: string, lang: string = 'en'): Promise<FetchResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  console.log(`[Transcript] Fetching transcript for video: ${videoId}`);

  // Try multiple sources
  const sources = [
    () => getCaptionsFromInvidious(videoId, lang),
    () => getCaptionsFromYouTubeSubtitles(videoId, lang),
    () => getCaptionsFromRetters(videoId, lang),
  ];

  for (const source of sources) {
    try {
      const result = await source();
      if (result && result.segments.length > 0) {
        console.log(`[Transcript] Success! Got ${result.segments.length} segments`);
        return {
          title: result.title,
          segments: result.segments,
          videoId,
          method: 'YouTube Captions'
        };
      }
    } catch (e) {
      console.log(`[Transcript] Source failed:`, e);
    }
  }

  throw new Error('No captions available for this video. Try a different video.');
}
