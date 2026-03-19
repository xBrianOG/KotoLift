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

async function getVideoInfo(videoId: string): Promise<{ title: string; captions: any[] }> {
  // Get video page to extract caption info
  const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  return new Promise((resolve) => {
    fetch(pageUrl, {
      mode: 'cors',
      credentials: 'omit'
    }).then(response => response.text()).then(html => {
      // Extract video title
      const titleMatch = html.match(/"title":"([^"]+)"/);
      const title = titleMatch ? titleMatch[1].replace(/\\u0026/g, '&') : `Video ${videoId}`;
      
      // Try to find caption tracks in the HTML
      const captionTracks: any[] = [];
      
      // Look for caption URLs in the HTML - simplified extraction
      const urlMatches = html.match(/baseUrl\\u0022\\u003A\\u0022([^"]+)"/g);
      const langMatches = html.match(/languageCode\\u0022\\u003A\\u0022([^"]+)"/g);
      const labelMatches = html.match(/displayName\\u0022\\u003A\\u0022simpleText\\u0022\\u003A\\u0022([^"]+)"/g);
      
      if (urlMatches) {
        for (let i = 0; i < urlMatches.length; i++) {
          const url = urlMatches[i].replace(/baseUrl\\u0022\\u003A\\u0022/, '').replace(/\\u002F/g, '/').replace(/\\u003F/g, '?');
          const lang = langMatches && langMatches[i] ? langMatches[i].replace(/languageCode\\u0022\\u003A\\u0022/, '') : 'en';
          const label = labelMatches && labelMatches[i] ? labelMatches[i].replace(/displayName\\u0022\\u003A\\u0022simpleText\\u0022\\u003A\\u0022/, '') : 'English';
          
          captionTracks.push({ url, languageCode: lang, label });
        }
      }
      
      resolve({ title, captions: captionTracks });
    }).catch(() => {
      resolve({ title: `Video ${videoId}`, captions: [] });
    });
  });
}

async function fetchCaption(url: string): Promise<string> {
  const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  return response.text();
}

export async function fetchTranscript(videoUrl: string, lang: string = 'en'): Promise<FetchResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  console.log(`[Transcript] Fetching transcript for video: ${videoId}`);

  try {
    // Get video info and caption tracks from YouTube page
    const { title, captions } = await getVideoInfo(videoId);
    console.log(`[Transcript] Got video info: ${title}`);
    console.log(`[Transcript] Found ${captions.length} caption tracks`);

    if (captions.length === 0) {
      // Try alternative method - direct transcript API
      console.log(`[Transcript] Trying direct transcript API...`);
      
      // Try YouTube's transcript endpoint
      const transcriptUrl = `https://youtube.com/api/timedtext?v=${videoId}&lang=${lang}`;
      try {
        const xml = await fetch(transcriptUrl, { mode: 'cors', credentials: 'omit' });
        const xmlText = await xml.text();
        if (xmlText && xmlText.includes('<text')) {
          const segments: TranscriptSegment[] = [];
          const matches = xmlText.matchAll(/<text[^>]*start="([^"]+)"[^>]*dur="([^"]+)"[^>]*>([^<]+)<\/text>/gi);
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
            return { title, segments, videoId, method: 'YouTube Captions' };
          }
        }
      } catch (e) {
        console.log(`[Transcript] Direct transcript API failed`);
      }
      
      throw new Error('No captions available for this video. Try a video with subtitles.');
    }

    // Find best matching caption
    const targetCaption = captions.find((c: any) => 
      c.languageCode === lang || c.label?.toLowerCase().includes(lang)
    ) || captions[0];

    // Fetch caption content
    console.log(`[Transcript] Fetching caption: ${targetCaption.label}`);
    const captionXml = await fetchCaption(targetCaption.url);

    // Parse XML captions
    const segments: TranscriptSegment[] = [];
    const matches = captionXml.matchAll(/<text[^>]*start="([^"]+)"[^>]*dur="([^"]+)"[^>]*>([^<]+)<\/text>/gi);

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

    if (segments.length === 0) {
      throw new Error('No captions available for this video. Try a video with subtitles.');
    }

    console.log(`[Transcript] Success! Got ${segments.length} segments`);
    return { title, segments, videoId, method: 'YouTube Captions' };

  } catch (error) {
    console.error(`[Transcript] Error:`, error);
    throw error;
  }
}
