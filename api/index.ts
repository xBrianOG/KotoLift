import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { YoutubeTranscript } from 'youtube-transcript';

const JWT_SECRET = process.env.JWT_SECRET || 'kotolift-dev-secret-change-in-prod';
const USERS_FILE = './data/email-users.json';
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

interface EmailUser {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: number;
}

function loadEmailUsers(): Map<string, EmailUser> {
  try {
    const fs = require('fs');
    if (fs.existsSync(USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      return new Map(Object.entries(data));
    }
  } catch (e) {
    console.error('Failed to load email users:', e);
  }
  return new Map();
}

function saveEmailUsers(users: Map<string, EmailUser>) {
  try {
    const fs = require('fs');
    const dir = './data';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(Object.fromEntries(users), null, 2));
  } catch (e) {
    console.error('Failed to save email users:', e);
  }
}

const emailUsersDb = loadEmailUsers();

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = (req.url || '/').split('?')[0];
  const body = req.body || {};

  // Auth: Register
  if (req.method === 'POST' && path === '/api/auth/register') {
    try {
      const { email, password, name } = body;
      if (!email || !password || password.length < 6) {
        return res.status(400).json({ error: 'Invalid email or password (min 6 chars)' });
      }
      const existing = emailUsersDb.get(email.toLowerCase());
      if (existing) {
        return res.status(401).json({ error: 'Email already registered' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user: EmailUser = {
        id: `email-${Date.now()}`,
        email: email.toLowerCase(),
        passwordHash,
        name,
        createdAt: Date.now()
      };
      emailUsersDb.set(email.toLowerCase(), user);
      saveEmailUsers(emailUsersDb);
      const token = jwt.sign({ sub: user.id, email: user.email, name: user.name, type: 'email' }, JWT_SECRET, { expiresIn: '30d' });
      return res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Registration failed' });
    }
  }

  // Auth: Login
  if (req.method === 'POST' && path === '/api/auth/login') {
    try {
      const { email, password } = body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }
      const user = emailUsersDb.get(email.toLowerCase());
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const token = jwt.sign({ sub: user.id, email: user.email, name: user.name, type: 'email' }, JWT_SECRET, { expiresIn: '30d' });
      return res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Login failed' });
    }
  }

  // Video: Analyze
  if (req.method === 'POST' && path === '/api/video/analyze') {
    try {
      const { url, lang } = body;
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

  // Video: Translate
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
