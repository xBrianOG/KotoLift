const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { url, lang = 'en' } = req.body || {};
    if (!url || !YOUTUBE_REGEX.test(url)) return res.status(400).json({ error: 'Invalid YouTube URL' });
    
    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ error: 'Could not extract video ID' });

    console.log(`[Video Analyze] Manually scraping ${videoId}...`);

    // 1. Fetch video page to find transcript metadata
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    const html = await pageRes.text();

    // 2. Extract ytInitialPlayerResponse
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!playerResponseMatch) throw new Error('Could not find player metadata on YouTube');

    const playerResponse = JSON.parse(playerResponseMatch[1]);
    const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      return res.status(400).json({ 
        error: 'No captions found for this video.',
        recommendation: 'Try the desktop version for high-fidelity AI transcription.'
      });
    }

    // 3. Find the best track (match lang or first available)
    const targetTrack = captionTracks.find((t: any) => t.languageCode === lang) || captionTracks[0];
    console.log(`[Video Analyze] Found track: ${targetTrack.name.simpleText} (${targetTrack.languageCode})`);

    // 4. Fetch the XML transcript
    const transcriptRes = await fetch(targetTrack.baseUrl);
    const transcriptXml = await transcriptRes.text();

    // 5. Barebones XML parsing (no library)
    const segments: any[] = [];
    const textMatch = Array.from(transcriptXml.matchAll(/<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([^<]+)<\/text>/g));
    
    textMatch.forEach((match, i) => {
        const start = parseFloat(match[1]);
        const dur = parseFloat(match[2]);
        const text = match[3]
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');

        segments.push({
            id: `seg-${i + 1}`,
            startMs: Math.round(start * 1000),
            endMs: Math.round((start + dur) * 1000),
            text: text.trim()
        });
    });

    return res.status(200).json({ 
      title: playerResponse.videoDetails?.title || `YouTube Video ${videoId}`, 
      segments, 
      languageDetected: targetTrack.languageCode
    });

  } catch (err: any) {
    console.error('[Video Analyze] Extraction failure:', err);
    return res.status(500).json({ 
      error: 'Failed to extract transcript.',
      details: err.message || String(err)
    });
  }
}
