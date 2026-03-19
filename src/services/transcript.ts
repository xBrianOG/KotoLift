const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://invidious.privacyredirect.com',
  'https://vid.priv.au',
  'https://invidious.poast.org',
  'https://inv.nadeko.net',
];

const CORS_PROXY = 'https://corsproxy.io/?';

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

function parseTimeToMs(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600000 + parts[1] * 60000 + parts[2] * 1000;
  } else if (parts.length === 2) {
    return parts[0] * 60000 + parts[1] * 1000;
  }
  return 0;
}

async function tryFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Try direct first
  try {
    const response = await fetch(url, { ...options, mode: 'cors' });
    if (response.ok) return response;
  } catch (e) {
    console.log('[Transcript] Direct fetch failed, trying CORS proxy...');
  }
  
  // Try with CORS proxy
  const proxyUrl = CORS_PROXY + encodeURIComponent(url);
  return fetch(proxyUrl, options);
}

export async function fetchTranscript(videoUrl: string, lang: string = 'en'): Promise<FetchResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  console.log(`[Transcript] Fetching transcript for video: ${videoId}`);

  // Try each Invidious instance with CORS proxy
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`[Transcript] Trying ${instance}...`);
      
      // Get video info with captions via CORS proxy
      const infoUrl = `${instance}/api/v1/videos/${videoId}?format=json`;
      const infoResponse = await tryFetch(infoUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!infoResponse.ok) {
        console.log(`[Transcript] ${instance} returned ${infoResponse.status}`);
        continue;
      }

      const videoInfo = await infoResponse.json();
      const title = videoInfo.title || `Video ${videoId}`;
      console.log(`[Transcript] Got video info: ${title}`);

      // Check for subtitles/c captions in different formats
      let captions = videoInfo.subtitles || videoInfo.captions || [];
      
      // If no captions, try the captions endpoint
      if (captions.length === 0 && videoInfo.captionTracks) {
        captions = videoInfo.captionTracks;
      }

      if (captions.length === 0) {
        console.log(`[Transcript] No captions found on ${instance}`);
        
        // Try to get captions from a different endpoint
        try {
          const captionsUrl = `${instance}/api/v1/captions/${videoId}`;
          const captionsResponse = await tryFetch(captionsUrl, {
            headers: { 'Accept': 'application/json' }
          });
          if (captionsResponse.ok) {
            const captionsData = await captionsResponse.json();
            if (Array.isArray(captionsData)) {
              captions = captionsData;
            }
          }
        } catch (e) {
          console.log(`[Transcript] Captions endpoint failed: ${e}`);
        }
        
        if (captions.length === 0) {
          continue;
        }
      }

      console.log(`[Transcript] Found ${captions.length} caption tracks`);

      // Find best matching caption track
      const targetCaption = captions.find((c: any) => {
        const label = c.label?.toLowerCase() || '';
        const langCode = c.languageCode || '';
        return label.includes(lang) || langCode === lang || langCode.startsWith(lang);
      }) || captions[0];

      if (!targetCaption) {
        console.log(`[Transcript] No suitable caption track found`);
        continue;
      }

      console.log(`[Transcript] Using caption: ${targetCaption.label || targetCaption.languageCode}`);

      // Get caption URL
      let captionUrl = targetCaption.url || targetCaption.baseUrl;
      if (!captionUrl) {
        // Try constructing URL from video ID
        captionUrl = `${instance}/api/v1/captions/${videoId}?label=${encodeURIComponent(targetCaption.label || '')}`;
      }

      // Fetch caption content
      const captionResponse = await tryFetch(captionUrl);
      
      if (!captionResponse.ok) {
        console.log(`[Transcript] Could not fetch caption URL from ${instance}`);
        continue;
      }

      let captionXml = await captionResponse.text();
      
      // If we got JSON, try to extract the actual XML
      if (captionXml.startsWith('{') || captionXml.startsWith('[')) {
        console.log(`[Transcript] Got JSON response instead of XML, trying alternative...`);
        // Some Invidious instances return JSON captions
        try {
          const jsonCaptions = JSON.parse(captionXml);
          if (Array.isArray(jsonCaptions)) {
            const segments: TranscriptSegment[] = jsonCaptions.map((item: any, index: number) => ({
              id: `seg-${index + 1}`,
              startMs: Math.round((item.start || item.startMs || 0) * 1000),
              endMs: Math.round((item.end || item.endMs || item.start + item.duration || 0) * 1000),
              text: item.text || item.content || ''
            })).filter((s: TranscriptSegment) => s.text.trim());
            
            if (segments.length > 0) {
              console.log(`[Transcript] Success! Got ${segments.length} segments from JSON`);
              return {
                title,
                segments,
                videoId,
                method: 'YouTube Captions'
              };
            }
          }
        } catch (e) {
          console.log(`[Transcript] JSON parsing failed`);
        }
        continue;
      }

      // Parse XML captions
      const segments: TranscriptSegment[] = [];
      const timeMatches = captionXml.matchAll(/<text[^>]*start="([^"]+)"[^>]*>([^<]+)<\/text>/gi);

      let matchIndex = 0;
      for (const match of timeMatches) {
        const startTimeStr = match[1];
        const text = match[2]
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();

        if (text) {
          const startTime = parseTimeToMs(startTimeStr);
          // Estimate end time (usually 2-3 seconds per segment)
          const endTime = startTime + 3000;
          
          segments.push({
            id: `seg-${segments.length + 1}`,
            startMs: startTime,
            endMs: endTime,
            text
          });
        }
        matchIndex++;
      }

      if (segments.length === 0) {
        console.log(`[Transcript] No segments parsed from ${instance}`);
        continue;
      }

      console.log(`[Transcript] Success! Got ${segments.length} segments from ${instance}`);
      return {
        title,
        segments,
        videoId,
        method: 'YouTube Captions'
      };

    } catch (err) {
      console.log(`[Transcript] ${instance} failed:`, err);
      continue;
    }
  }

  throw new Error('Could not fetch transcript. Please try a different video.');
}
