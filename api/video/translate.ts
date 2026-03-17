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
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${apiKey}` 
      },
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
