import { YoutubeTranscript } from 'youtube-transcript';

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default async function handler(req: any, res: any) {
  const path = req.url || '/';

  // Analyze video
  if (req.method === 'POST' && path.includes('/analyze')) {
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
      return res.status(200).json({ title: `YouTube Video ${videoId}`, segments, languageDetected: lang || 'en' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to analyze video' });
    }
  }

  // Translate
  if (req.method === 'POST' && path.includes('/translate')) {
    try {
      const { text, sourceLang, targetLang } = req.body || {};
      if (!text || !sourceLang || !targetLang) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `Translate from ${sourceLang} to ${targetLang}. Return only the translation.` },
            { role: 'user', content: text }
          ],
          max_tokens: 1000
        })
      });
      if (!response.ok) {
        return res.status(500).json({ error: 'Translation failed' });
      }
      const data = await response.json();
      return res.status(200).json({ translation: data.choices[0]?.message?.content || '' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Translation failed' });
    }
  }

  return res.status(404).json({ error: 'Not found' });
}
