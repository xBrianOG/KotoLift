const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://invidious.privacyredirect.com',
  'https://vid.priv.au',
];

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

export async function fetchTranscript(videoUrl: string, lang: string = 'en'): Promise<FetchResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  // Try each Invidious instance
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`[Transcript] Trying ${instance}...`);
      
      // Get video info with captions
      const infoUrl = `${instance}/api/v1/videos/${videoId}?format=json`;
      const infoResponse = await fetch(infoUrl, {
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

      // Find caption tracks
      const captions = videoInfo.captions || [];
      if (captions.length === 0) {
        console.log(`[Transcript] No captions found on ${instance}`);
        continue;
      }

      // Find best matching caption track
      const targetCaption = captions.find((c: any) => c.label?.toLowerCase().includes(lang))
        || captions.find((c: any) => c.languageCode === lang)
        || captions.find((c: any) => c.languageCode?.startsWith(lang))
        || captions[0];

      if (!targetCaption || !targetCaption.url) {
        console.log(`[Transcript] No caption URL found on ${instance}`);
        continue;
      }

      // Fetch caption content
      const captionUrl = targetCaption.url.replace(/&format=json/, '') + '&format=json';
      const captionResponse = await fetch(captionUrl);

      if (!captionResponse.ok) {
        console.log(`[Transcript] Could not fetch caption URL from ${instance}`);
        continue;
      }

      const captionXml = await captionResponse.text();

      // Parse XML captions
      const segments: TranscriptSegment[] = [];
      const timeMatches = captionXml.matchAll(/<text start="([^"]+)"[^>]*dur="([^"]+)"[^>]*>([^<]+)<\/text>/g);

      for (const match of timeMatches) {
        const startTime = parseTimeToMs(match[1]);
        const duration = parseFloat(match[2]) * 1000;
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
            startMs: startTime,
            endMs: startTime + duration,
            text
          });
        }
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
