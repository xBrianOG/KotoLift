import * as jose from 'jose';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import bcrypt from 'bcryptjs';

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';
const JWT_SECRET = process.env.JWT_SECRET || 'kotolift-dev-secret-change-in-prod';
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || 'com.kotolift.app';

const JWKS = jose.createRemoteJWKSet(new URL(APPLE_JWKS_URI));

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

const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const EMAIL_USERS_FILE = path.join(DATA_DIR, 'email-users.json');

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
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
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
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(EMAIL_USERS_FILE, JSON.stringify(Object.fromEntries(users), null, 2));
  } catch (e) {
    console.error('Failed to save email users:', e);
  }
}

const usersDb = loadUsers();
const emailUsersDb = loadEmailUsers();

export async function verifyAppleToken(identityToken: string): Promise<AppleUser> {
  try {
    const { payload } = await jose.jwtVerify(identityToken, JWKS, {
      issuer: 'https://appleid.apple.com',
      audience: APPLE_CLIENT_ID,
      algorithms: ['RS256']
    });

    const sub = payload.sub;
    const email = payload.email as string | undefined;

    if (!sub) {
      throw new Error('Missing sub claim');
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

    return user;
  } catch (err: any) {
    throw new Error(`Token verification failed: ${err.message}`);
  }
}

export async function createSessionToken(user: AppleUser): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new jose.SignJWT({ sub: user.id, email: user.email, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<{ sub: string; email?: string; name?: string } | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as any;
  } catch {
    return null;
  }
}

export async function registerEmailUser(email: string, password: string, name?: string): Promise<EmailUser> {
  const existing = emailUsersDb.get(email.toLowerCase());
  if (existing) {
    throw new Error('Email already registered');
  }

  console.log(`[Auth] Registering new user: ${email}`);
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

  console.log(`[Auth] Verifying user: ${email}`);
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  return user;
}

export async function createEmailSessionToken(user: EmailUser): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new jose.SignJWT({ sub: user.id, email: user.email, name: user.name, type: 'email' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}
