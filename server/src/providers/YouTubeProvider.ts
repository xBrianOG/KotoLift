import { YoutubeTranscript } from 'youtube-transcript';
import type { VideoProvider, AnalyzeResult, Segment, ProviderError } from '../types.js';

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export class YouTubeProvider implements VideoProvider {
  name = 'YouTube';

  canHandle(url: string): boolean {
    return YOUTUBE_REGEX.test(url);
  }

  async extract(url: string, lang: string = 'en'): Promise<AnalyzeResult> {
    const videoId = this.extractVideoId(url);
    if (!videoId) throw new Error('Invalid YouTube URL');

    try {
      console.log(`[YouTubeProvider] Resilient Scraping for ${videoId}...`);
      
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
          headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9'
          }
      });
      const html = await pageRes.text();

      const jsonStartKey = 'ytInitialPlayerResponse = ';
      const jsonStartIdx = html.indexOf(jsonStartKey);
      if (jsonStartIdx === -1) throw new Error('YouTube layout changed (Metadata missing)');
      
      const jsonBodyStart = jsonStartIdx + jsonStartKey.length;
      let jsonBodyEnd = html.indexOf(';var ', jsonBodyStart);
      if (jsonBodyEnd === -1) jsonBodyEnd = html.indexOf(';</script>', jsonBodyStart);
      
      const playerResponse = JSON.parse(html.substring(jsonBodyStart, jsonBodyEnd).trim());
      const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (!captionTracks || captionTracks.length === 0) {
        const error = new Error('No captions available for this video') as any;
        error.code = 'NO_CAPTIONS';
        throw error;
      }

      const targetTrack = captionTracks.find((t: any) => t.languageCode === lang) 
                         || captionTracks.find((t: any) => t.languageCode.startsWith(lang))
                         || captionTracks[0];

      const transcriptRes = await fetch(targetTrack.baseUrl);
      const transcriptXml = await transcriptRes.text();

      const segments: Segment[] = [];
      const matches = Array.from(transcriptXml.matchAll(/<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([^<]+)<\/text>/g));
      
      matches.forEach((match, i) => {
          const start = parseFloat(match[1]);
          const dur = parseFloat(match[2]);
          const text = match[3]
              .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
              .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

          segments.push({
              id: `seg-${i + 1}`,
              startMs: Math.round(start * 1000),
              endMs: Math.round((start + dur) * 1000),
              text: text.trim()
          });
      });

      return {
        segments,
        title: playerResponse.videoDetails?.title || `Video ${videoId}`
      };

    } catch (err: any) {
      console.error('[YouTubeProvider] Resilient Scraping failed:', err.message);
      if (err.code === 'NO_CAPTIONS') throw err;
      throw new Error(`YouTube Extraction failed: ${err.message}`);
    }
  }

  async getCaptions(videoId: string, lang?: string): Promise<Segment[]> {
    try {
      const result = await this.extract(`https://www.youtube.com/watch?v=${videoId}`, lang);
      return result.segments;
    } catch {
      return [];
    }
  }

  private extractVideoId(url: string): string | null {
    const match = url.match(YOUTUBE_REGEX);
    return match ? match[4] : null;
  }
}
