import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'kotolift-dev-secret-change-in-prod';
const DEV_AUTH = process.env.DEV_AUTH === 'true';

export interface SessionUser {
  sub: string;
  email?: string;
  name?: string;
  isDev?: boolean;
}

export function verifySessionToken(token: string): SessionUser | null {
  if (token.startsWith('dev-token-')) {
    return { sub: 'dev-user', isDev: true };
  }
  
  try {
    return jwt.verify(token, JWT_SECRET) as SessionUser;
  } catch {
    return null;
  }
}

export function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    if (DEV_AUTH) {
      console.warn('⚠️ DEV AUTH: Allowing request without auth');
      req.userId = 'dev-user';
      req.user = { sub: 'dev-user', isDev: true };
      return next();
    }
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  const payload = verifySessionToken(token);

  if (!payload) {
    if (DEV_AUTH && token.startsWith('dev-token-')) {
      req.userId = 'dev-user';
      req.user = payload;
      return next();
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = payload.sub;
  req.user = payload;
  next();
}
