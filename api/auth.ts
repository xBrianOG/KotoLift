import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import fs from 'fs';

const JWT_SECRET = process.env.JWT_SECRET || 'kotolift-dev-secret-change-in-prod';
const USERS_FILE = '/tmp/email-users.json'; // Use /tmp for limited persistence in serverless

interface EmailUser {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: number;
}

// In-memory cache for the "hot" instance
const internalDb = new Map<string, EmailUser>();

function loadFromTmp() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      Object.entries(data).forEach(([email, user]: [string, any]) => {
        internalDb.set(email, user);
      });
    }
  } catch (e) {
    // ignore
  }
}

function saveToTmp() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(Object.fromEntries(internalDb), null, 2));
  } catch (e) {
    // ignore
  }
}

// Initial load
loadFromTmp();

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url = '' } = req;
  const method = req.method;

  // Manual routing within the function
  if (method === 'POST' && url.includes('/register')) {
    return handleRegister(req, res);
  } else if (method === 'POST' && url.includes('/login')) {
    return handleLogin(req, res);
  }

  return res.status(404).json({ error: 'Not found' });
}

async function handleRegister(req: any, res: any) {
  try {
    const { email, password, name } = req.body || {};
    
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Invalid email or password (min 6 chars)' });
    }
    
    if (internalDb.has(email.toLowerCase())) {
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
    
    internalDb.set(email.toLowerCase(), user);
    saveToTmp();
    
    const token = jwt.sign({ sub: user.id, email: user.email, name: user.name, type: 'email' }, JWT_SECRET, { expiresIn: '30d' });
    
    return res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
}

async function handleLogin(req: any, res: any) {
  try {
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    
    const user = internalDb.get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password (User not found in memory)' });
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
