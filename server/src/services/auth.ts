import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';
const JWT_SECRET = process.env.JWT_SECRET || 'kotolift-dev-secret-change-in-prod';
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || 'com.kotolift.app';

const jwksClient = jwksRsa({
  jwksUri: APPLE_JWKS_URI,
  cache: true,
  cacheMaxAge: 600000
});

function getSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export interface AppleUser {
  id: string;
  email?: string;
  name?: string;
  createdAt: number;
}

const DB_FILE = './data/users.json';

function loadUsers(): Map<string, AppleUser> {
  try {
    if (existsSync(DB_FILE)) {
      const data = JSON.parse(readFileSync(DB_FILE, 'utf-8'));
      return new Map(Object.entries(data));
    }
  } catch (e) {
    console.error('Failed to load users:', e);
  }
  return new Map();
}

function saveUsers(users: Map<string, AppleUser>) {
  try {
    const dir = './data';
    if (!existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true });
    }
    writeFileSync(DB_FILE, JSON.stringify(Object.fromEntries(users), null, 2));
  } catch (e) {
    console.error('Failed to save users:', e);
  }
}

const usersDb = loadUsers();

export async function verifyAppleToken(identityToken: string): Promise<AppleUser> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      identityToken,
      getSigningKey,
      {
        issuer: 'https://appleid.apple.com',
        audience: APPLE_CLIENT_ID,
        algorithms: ['RS256']
      },
      (err, decoded) => {
        if (err) {
          reject(new Error(`Token verification failed: ${err.message}`));
          return;
        }

        const payload = decoded as any;
        const sub = payload.sub;
        const email = payload.email;

        if (!sub) {
          reject(new Error('Missing sub claim'));
          return;
        }

        let user = usersDb.get(sub);

        if (!user) {
          user = {
            id: sub,
            email,
            name: undefined,
            createdAt: Date.now()
          };
          usersDb.set(sub, user);
          saveUsers(usersDb);
        }

        resolve(user);
      }
    );
  });
}

export function createSessionToken(user: AppleUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifySessionToken(token: string): { sub: string; email?: string; name?: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}
