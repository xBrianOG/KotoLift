import { YoutubeTranscript } from 'youtube-transcript';

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, lang } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL is required' });
    if (!YOUTUBE_REGEX.test(url)) return res.status(400).json({ error: 'Invalid YouTube URL' });
    
    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ error: 'Could not extract video ID' });
    
    const transcripts = await YoutubeTranscript.fetchTranscript(videoId, { lang: lang || 'en' });
    if (!transcripts || transcripts.length === 0) {
      return res.status(400).json({ error: 'No captions available for this video' });
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
    return res.status(500).json({ error: err.message || 'Failed to analyze video' });
  }
}
