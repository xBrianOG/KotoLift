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

  const path = req.url?.split('?')[0] || '/';
  const body = req.body || {};

  if (req.method === 'POST' && path === '/api/video/analyze') {
    try {
      const { url, lang } = body;

      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      if (!YOUTUBE_REGEX.test(url)) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
      }

      const videoId = extractVideoId(url);
      if (!videoId) {
        return res.status(400).json({ error: 'Could not extract video ID' });
      }

      const transcripts = await YoutubeTranscript.fetchTranscript(videoId, { lang: lang || 'en' });

      if (!transcripts || transcripts.length === 0) {
        return res.status(400).json({ error: 'No captions available for this video' });
      }

      const segments = transcripts.map((item: any, index: number) => {
        const startMs = Math.round(item.offset * 1000);
        const durationMs = Math.round(item.duration * 1000);
        return {
          id: `seg-${index + 1}`,
          startMs,
          endMs: startMs + durationMs,
          text: item.text
        };
      });

      return res.status(200).json({
        title: `YouTube Video ${videoId}`,
        segments,
        languageDetected: lang || 'en'
      });
    } catch (err: any) {
      console.error('Video analyze error:', err);
      return res.status(500).json({ error: err.message || 'Failed to analyze video' });
    }
  }

  if (req.method === 'POST' && path === '/api/video/translate') {
    try {
      const { text, sourceLang, targetLang } = body;

      if (!text || !sourceLang || !targetLang) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Translate from ${sourceLang} to ${targetLang}. Return only the translation, no explanations.`
            },
            {
              role: 'user',
              content: text
            }
          ],
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return res.status(500).json({ error: 'Translation failed', details: error });
      }

      const data = await response.json();
      const translation = data.choices[0]?.message?.content || '';

      return res.status(200).json({ translation });
    } catch (err: any) {
      console.error('Translation error:', err);
      return res.status(500).json({ error: err.message || 'Translation failed' });
    }
  }

  return res.status(404).json({ error: 'Not found' });
}
