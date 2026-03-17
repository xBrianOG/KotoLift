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

    console.log(`[Video Analyze] Analyzing ${videoId}...`);

    // 1. Fetch video page metadata
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });
    const html = await pageRes.text();

    // 2. Pinpoint ytInitialPlayerResponse using substrings (safer than big regex)
    const jsonStartKey = 'ytInitialPlayerResponse = ';
    const jsonStartIdx = html.indexOf(jsonStartKey);
    if (jsonStartIdx === -1) throw new Error('YouTube changed their page layout (Player metadata missing)');
    
    const jsonBodyStart = jsonStartIdx + jsonStartKey.length;
    let jsonBodyEnd = html.indexOf(';var ', jsonBodyStart);
    if (jsonBodyEnd === -1) jsonBodyEnd = html.indexOf(';</script>', jsonBodyStart);
    
    const jsonStr = html.substring(jsonBodyStart, jsonBodyEnd).trim();
    const playerResponse = JSON.parse(jsonStr);
    
    const videoTitle = playerResponse.videoDetails?.title || `Video ${videoId}`;
    const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    // 3. Handle Captions Logic
    if (captionTracks && captionTracks.length > 0) {
        // Find specific lang or default
        const targetTrack = captionTracks.find((t: any) => t.languageCode === lang) 
                           || captionTracks.find((t: any) => t.languageCode.startsWith(lang))
                           || captionTracks[0];
        
        console.log(`[Video Analyze] Found captions: ${targetTrack.name.simpleText} (${targetTrack.languageCode})`);

        const transcriptRes = await fetch(targetTrack.baseUrl);
        const transcriptXml = await transcriptRes.text();

        const segments: any[] = [];
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

        return res.status(200).json({ 
            title: videoTitle, 
            segments, 
            languageDetected: targetTrack.languageCode 
        });
    }

    // 4. Whisper Fallback Check
    console.warn(`[Video Analyze] No captions found for ${videoId}.`);
    
    return res.status(400).json({ 
        error: 'No captions available for this video on YouTube.',
        recommendation: 'Good news! I can transcribe this for you using Whisper AI. However, since the Web version has a 60-second limit, please use the Desktop/Local version of KotoLift for this video.',
        details: 'Whisper transcription for Web is coming in the next update.'
    });

  } catch (err: any) {
    console.error('[Video Analyze] Failure:', err);
    return res.status(500).json({ 
      error: 'Failed to analyze video.',
      details: err.message || String(err)
    });
  }
}
