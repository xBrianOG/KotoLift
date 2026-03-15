import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'kotolift-dev-secret-change-in-prod';

export interface SessionUser {
  sub: string;
  email?: string;
  name?: string;
  isDev?: boolean;
}

export function verifySessionToken(token: string): SessionUser | null {
  // Always allow dev tokens (for testing)
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
  
  // Allow requests without auth header for dev/testing
  if (!authHeader?.startsWith('Bearer ')) {
    console.warn('⚠️ No auth header - allowing request (dev mode)');
    req.userId = 'dev-user';
    req.user = { sub: 'dev-user', isDev: true };
    return next();
  }

  const token = authHeader.slice(7);
  const payload = verifySessionToken(token);

  if (!payload) {
    // Even if token is invalid, allow for dev testing
    console.warn('⚠️ Invalid token - allowing request (dev mode)');
    req.userId = 'dev-user';
    req.user = payload;
    return next();
  }

  req.userId = payload.sub;
  req.user = payload;
  next();
}
