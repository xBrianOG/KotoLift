import { Router } from 'express';
import { YouTubeTranscriptApi } from 'youtube-transcript-api-js';

const router = Router();

router.get('/transcript/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const { lang = 'en' } = req.query;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  try {
    console.log(`[Transcript] Fetching transcript for ${videoId}`);
    const api = new YouTubeTranscriptApi();
    const result = await api.fetch(videoId, [lang as string]);

    const segments = result.snippets.map((snippet: any, i: number) => ({
      id: `seg-${i + 1}`,
      startMs: Math.round(snippet.start * 1000),
      endMs: Math.round((snippet.start + snippet.duration) * 1000),
      text: snippet.text
    }));

    return res.json({
      title: `Video ${videoId}`,
      segments,
      videoId,
      method: 'YouTube Captions'
    });
  } catch (e: any) {
    console.error(`[Transcript] Error:`, e.message);
    return res.status(500).json({ error: e.message || 'Failed to fetch transcript' });
  }
});

export default router;
