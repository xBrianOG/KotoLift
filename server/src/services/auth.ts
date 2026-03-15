import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import bcrypt from 'bcrypt';

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

export interface EmailUser {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: number;
}

const USERS_FILE = './data/users.json';
const EMAIL_USERS_FILE = './data/email-users.json';

function loadUsers(): Map<string, AppleUser> {
  try {
    if (existsSync(USERS_FILE)) {
      const data = JSON.parse(readFileSync(USERS_FILE, 'utf-8'));
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
    writeFileSync(USERS_FILE, JSON.stringify(Object.fromEntries(users), null, 2));
  } catch (e) {
    console.error('Failed to save users:', e);
  }
}

function loadEmailUsers(): Map<string, EmailUser> {
  try {
    if (existsSync(EMAIL_USERS_FILE)) {
      const data = JSON.parse(readFileSync(EMAIL_USERS_FILE, 'utf-8'));
      return new Map(Object.entries(data));
    }
  } catch (e) {
    console.error('Failed to load email users:', e);
  }
  return new Map();
}

function saveEmailUsers(users: Map<string, EmailUser>) {
  try {
    const dir = './data';
    if (!existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true });
    }
    writeFileSync(EMAIL_USERS_FILE, JSON.stringify(Object.fromEntries(users), null, 2));
  } catch (e) {
    console.error('Failed to save email users:', e);
  }
}

const usersDb = loadUsers();
const emailUsersDb = loadEmailUsers();

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

export async function registerEmailUser(email: string, password: string, name?: string): Promise<EmailUser> {
  const existing = emailUsersDb.get(email.toLowerCase());
  if (existing) {
    throw new Error('Email already registered');
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

  return user;
}

export async function verifyEmailUser(email: string, password: string): Promise<EmailUser> {
  const user = emailUsersDb.get(email.toLowerCase());
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  return user;
}

export function createEmailSessionToken(user: EmailUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, type: 'email' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}
