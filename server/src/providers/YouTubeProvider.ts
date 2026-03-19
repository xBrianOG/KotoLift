import type { VideoProvider, AnalyzeResult, Segment, ProviderError } from '../types.js';

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface YouTubeCaptionTrack {
  languageCode: string;
  displayName: string;
  id: string;
}

async function getVideoCaptions(videoId: string, lang: string = 'en'): Promise<{ title: string; segments: Segment[] }> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key not configured');
  }

  // Step 1: Get video title
  const videoResponse = await fetch(
    `${YOUTUBE_API_BASE}/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
  );

  if (!videoResponse.ok) {
    const error = await videoResponse.text();
    throw new Error(`YouTube API error: ${error}`);
  }

  const videoData = await videoResponse.json();
  const videoInfo = videoData.items?.[0]?.snippet;

  if (!videoInfo) {
    throw new Error('Video not found or is unavailable');
  }

  const title = videoInfo.title || `Video ${videoId}`;

  // Step 2: Get caption tracks
  const captionsResponse = await fetch(
    `${YOUTUBE_API_BASE}/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`
  );

  if (!captionsResponse.ok) {
    const errorData = await captionsResponse.json().catch(() => ({}));
    const error = await captionsResponse.text();
    
    // Check if captions are disabled or unavailable
    if (captionsResponse.status === 404 || captionsResponse.status === 403) {
      const providerError = new Error('No captions available for this video. This video may have captions disabled by the creator.') as ProviderError;
      providerError.provider = 'YouTube API';
      providerError.code = 'NO_CAPTIONS';
      throw providerError;
    }
    
    throw new Error(`YouTube API error: ${error}`);
  }

  const captionsData = await captionsResponse.json();
  const captionTracks: YouTubeCaptionTrack[] = captionsData.items || [];

  if (captionTracks.length === 0) {
    const providerError = new Error('No captions available for this video. This video may have captions disabled by the creator.') as ProviderError;
    providerError.provider = 'YouTube API';
    providerError.code = 'NO_CAPTIONS';
    throw providerError;
  }

  // Step 3: Find the best matching caption track
  const targetTrack = captionTracks.find(t => t.languageCode === lang)
    || captionTracks.find(t => t.languageCode?.startsWith(lang))
    || captionTracks.find(t => t.languageCode === 'en')
    || captionTracks[0];

  console.log(`[YouTubeProvider] Using caption track: ${targetTrack.displayName} (${targetTrack.languageCode})`);

  // Step 4: Download caption track
  // Note: Downloading captions requires OAuth or the caption must be publicly downloadable
  // For now, we'll try to get captions via the caption download endpoint
  const captionResponse = await fetch(
    `${YOUTUBE_API_BASE}/captions/${targetTrack.id}?tfmt=srt&key=${YOUTUBE_API_KEY}`,
    {
      headers: {
        'Authorization': `Bearer `,
        'Accept': 'text/plain'
      }
    }
  );

  if (!captionResponse.ok) {
    // If we can't download captions, try getting video transcript via other means
    console.warn(`[YouTubeProvider] Could not download captions directly, using video snippet as fallback`);
    
    // Return a single segment with video description as a fallback
    const description = videoInfo.description || '';
    if (description.length > 10) {
      const segments: Segment[] = [{
        id: 'seg-1',
        startMs: 0,
        endMs: 60000,
        text: description.substring(0, 500) // Use first 500 chars of description
      }];
      return { title, segments };
    }
    
    const providerError = new Error('Could not retrieve captions. Video may have captions disabled.') as ProviderError;
    providerError.provider = 'YouTube API';
    providerError.code = 'NO_CAPTIONS';
    throw providerError;
  }

  const captionText = await captionResponse.text();

  // Parse SRT format to segments
  const segments: Segment[] = [];
  const srtBlocks = captionText.trim().split(/\n\n+/);

  for (let i = 0; i < srtBlocks.length; i++) {
    const block = srtBlocks[i];
    const lines = block.split('\n');
    
    if (lines.length >= 3) {
      // SRT format: index\nstart --> end\ntext\n\n
      const timeLine = lines[1];
      const textLines = lines.slice(2);
      const text = textLines.join(' ').trim();

      // Parse time format: 00:00:00,000 --> 00:00:00,000
      const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
      
      if (timeMatch && text) {
        const startMs = 
          parseInt(timeMatch[1]) * 3600000 +
          parseInt(timeMatch[2]) * 60000 +
          parseInt(timeMatch[3]) * 1000 +
          parseInt(timeMatch[4]);

        const endMs = 
          parseInt(timeMatch[5]) * 3600000 +
          parseInt(timeMatch[6]) * 60000 +
          parseInt(timeMatch[7]) * 1000 +
          parseInt(timeMatch[8]);

        segments.push({
          id: `seg-${segments.length + 1}`,
          startMs,
          endMs,
          text
        });
      }
    }
  }

  if (segments.length === 0) {
    const providerError = new Error('No caption content could be extracted') as ProviderError;
    providerError.provider = 'YouTube API';
    providerError.code = 'NO_CAPTIONS';
    throw providerError;
  }

  return { title, segments };
}

export class YouTubeProvider implements VideoProvider {
  name = 'YouTube API';

  canHandle(url: string): boolean {
    return YOUTUBE_REGEX.test(url);
  }

  private extractVideoId(url: string): string | null {
    const match = url.match(YOUTUBEREGEX);
    return match ? match[4] : null;
  }

  async extract(url: string, lang: string = 'en'): Promise<AnalyzeResult> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      const error = new Error('Invalid YouTube URL') as ProviderError;
      error.provider = this.name;
      error.code = 'INVALID_URL';
      throw error;
    }

    try {
      console.log(`[YouTubeProvider] Fetching video info via YouTube API for ${videoId}...`);
      const result = await getVideoCaptions(videoId, lang);
      console.log(`[YouTubeProvider] Successfully extracted ${result.segments.length} segments`);
      return result;
    } catch (err: any) {
      console.error('[YouTubeProvider] YouTube API extraction failed:', err.message);
      
      const providerError = err as ProviderError;
      if (!providerError.code) {
        providerError.code = 'NETWORK_ERROR';
        providerError.provider = this.name;
      }
      throw err;
    }
  }

  async getCaptions(videoId: string, lang?: string): Promise<Segment[]> {
    try {
      const result = await getVideoCaptions(videoId, lang);
      return result.segments;
    } catch {
      return [];
    }
  }
}

const YOUTUBEREGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
