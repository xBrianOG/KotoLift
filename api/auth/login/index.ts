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

const emailUsersDb = loadEmailUsers();

export default async function handler(req: any, res: any) {
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
