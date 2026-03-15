import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'kotolift-dev-secret-change-in-prod';
const USERS_FILE = './data/email-users.json';

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

export default async function handler(req: any, res: any) {
  const path = (req.url || '/').split('?')[0];
  
  // Health check
  if (req.method === 'GET' && path === '/api/auth') {
    return res.status(200).json({ status: 'ok' });
  }

  // Register
  if (req.method === 'POST' && path === '/api/auth/register') {
    try {
      const { email, password, name } = req.body || {};
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

  // Login
  if (req.method === 'POST' && path === '/api/auth/login') {
    try {
      const { email, password } = req.body || {};
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

  return res.status(404).json({ error: 'Not found', path });
}
