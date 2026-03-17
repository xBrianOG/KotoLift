import { YoutubeTranscript } from 'youtube-transcript';

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, lang } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL is required' });
    if (!YOUTUBE_REGEX.test(url)) return res.status(400).json({ error: 'Invalid YouTube URL' });
    
    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ error: 'Could not extract video ID' });
    
    console.log(`[Video Analyze] Starting analysis for ${videoId} with lang: ${lang || 'auto'}`);
    
    let transcripts;
    try {
      // Attempt 1: Requested language
      transcripts = await YoutubeTranscript.fetchTranscript(videoId, { lang: lang || 'en' });
      console.log(`[Video Analyze] Success with initial fetch (${lang || 'en'})`);
    } catch (err: any) {
      console.warn(`[Video Analyze] First attempt failed (${err.message}). Trying fallback...`);
      try {
        // Attempt 2: No language specified (YouTube default)
        transcripts = await YoutubeTranscript.fetchTranscript(videoId);
        console.log('[Video Analyze] Success with default fallback');
      } catch (err2: any) {
        console.error('[Video Analyze] Both attempts failed:', err2);
        return res.status(400).json({ 
          error: 'YouTube captions are unavailable or blocked in this environment.',
          details: `Error 1: ${err.message} | Error 2: ${err2.message}`,
          recommendation: 'Please use the desktop/local version of KotoLift to analyze this video using AI Whisper.'
        });
      }
    }

    if (!transcripts || transcripts.length === 0) {
      return res.status(400).json({ 
        error: 'YouTube captions are unavailable for this video.',
        recommendation: 'Try the desktop version for high-fidelity AI transcription.'
      });
    }
    
    const segments = transcripts.map((item: any, index: number) => ({
      id: `seg-${index + 1}`,
      startMs: Math.round(item.offset * 1000),
      endMs: Math.round(item.offset * 1000) + Math.round(item.duration * 1000),
      text: item.text
    }));
    
    return res.status(200).json({ 
      title: `YouTube Video ${videoId}`, 
      segments, 
      languageDetected: lang || 'en' 
    });
  } catch (err: any) {
    console.error('[Video Analyze] Fatal crash:', err);
    return res.status(500).json({ 
      error: 'Analysis crashed unexpectedly.',
      details: err.message || String(err)
    });
  }
}
