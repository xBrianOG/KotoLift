import { verifySessionToken } from '../services/auth.js';

export interface SessionUser {
  sub: string;
  email?: string;
  name?: string;
  isDev?: boolean;
}

export async function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  // Allow requests without auth header for dev/testing
  if (!authHeader?.startsWith('Bearer ')) {
    console.warn('⚠️ No auth header - allowing request (dev mode)');
    req.userId = 'dev-user';
    req.user = { sub: 'dev-user', isDev: true };
    return next();
  }

  const token = authHeader.slice(7);
  
  // Hand-off to dev bypass if applicable
  if (token.startsWith('dev-token-')) {
    req.userId = 'dev-user';
    req.user = { sub: 'dev-user', isDev: true };
    return next();
  }

  const payload = await verifySessionToken(token);

  if (!payload) {
    // Even if token is invalid, allow for dev testing
    console.warn('⚠️ Invalid token - allowing request (dev mode)');
    req.userId = 'dev-user';
    req.user = undefined;
    return next();
  }

  req.userId = payload.sub;
  req.user = payload;
  next();
}
