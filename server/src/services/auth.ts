import * as jose from 'jose';
import bcrypt from 'bcryptjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';
const JWT_SECRET = process.env.JWT_SECRET || 'kotolift-dev-secret-change-in-prod';
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || 'com.kotolift.app';

const JWKS = jose.createRemoteJWKSet(new URL(APPLE_JWKS_URI));

const SUPABASE_URL = process.env.SUPABASE_URL || '';
// Prefer service role key for server-side operations (bypasses RLS safely)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

// File-based storage fallback (used when Supabase is not configured)
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'email-users.json');

let supabase: SupabaseClient | null = null;

function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

function getSupabaseClient(): SupabaseClient {
  if (!supabase && isSupabaseConfigured()) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log('[Auth] Connected to Supabase');
  }
  if (!supabase) {
    throw new Error('Supabase not configured');
  }
  return supabase;
}

// --- File-based fallback storage ---

interface FileEmailUser {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: number;
}

function readUsersFile(): Record<string, FileEmailUser> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Auth] Failed to read users file:', err);
  }
  return {};
}

function writeUsersFile(users: Record<string, FileEmailUser>): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// --- Exported types ---

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

// --- Apple auth ---

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

    return {
      id: sub,
      email,
      name: undefined,
      createdAt: Date.now()
    };
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

// --- Email auth (Supabase with file-based fallback) ---

export async function registerEmailUser(email: string, password: string, name?: string): Promise<EmailUser> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name?.trim() || undefined;

  console.log(`[Auth] Registering user: ${cleanEmail} (via ${isSupabaseConfigured() ? 'Supabase' : 'file'})`);

  const passwordHash = await bcrypt.hash(password.trim(), 10);

  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();

      const { data: existing } = await client
        .from('email_users')
        .select('id')
        .eq('email', cleanEmail)
        .single();

      if (existing) {
        throw new Error('Email already registered');
      }

      const { data, error } = await client
        .from('email_users')
        .insert({ email: cleanEmail, password_hash: passwordHash, name: cleanName || null })
        .select()
        .single();

      if (error) {
        console.error('[Auth] Supabase insert error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log(`[Auth] Registered via Supabase: ${cleanEmail}`);
      return {
        id: data.id,
        email: data.email,
        passwordHash: data.password_hash,
        name: data.name,
        createdAt: new Date(data.created_at).getTime()
      };
    } catch (err: any) {
      if (err.message === 'Email already registered') throw err;
      console.error('[Auth] Supabase registration error:', err);
      // Fall through to file-based on Supabase failure
      console.warn('[Auth] Falling back to file-based storage');
    }
  }

  // File-based storage
  const users = readUsersFile();
  if (users[cleanEmail]) {
    throw new Error('Email already registered');
  }

  const user: FileEmailUser = {
    id: `email-${Date.now()}`,
    email: cleanEmail,
    passwordHash,
    name: cleanName,
    createdAt: Date.now()
  };
  users[cleanEmail] = user;
  writeUsersFile(users);

  console.log(`[Auth] Registered via file: ${cleanEmail}`);
  return user;
}

export async function verifyEmailUser(email: string, password: string): Promise<EmailUser> {
  const cleanEmail = email.trim().toLowerCase();

  console.log(`[Auth] Verifying user: ${cleanEmail} (via ${isSupabaseConfigured() ? 'Supabase' : 'file'})`);

  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();
      console.log('[Auth] Querying Supabase for:', cleanEmail);

      const { data, error } = await client
        .from('email_users')
        .select('id, email, password_hash, name, created_at')
        .eq('email', cleanEmail)
        .single();

      console.log('[Auth] Supabase result:', { error, data, cleanEmail });

      // Handle case where .single() returns "no rows" error vs actual error
      const isNotFoundError = error?.message?.includes('No rows');
      
      if (!error && data) {
        const valid = await bcrypt.compare(password.trim(), data.password_hash);
        if (!valid) {
          throw new Error('Invalid email or password');
        }
        console.log(`[Auth] Verified via Supabase: ${cleanEmail}`);
        return {
          id: data.id,
          email: data.email,
          passwordHash: data.password_hash,
          name: data.name,
          createdAt: new Date(data.created_at).getTime()
        };
      }

      // User not found in Supabase — fall through to check file store
      console.warn(`[Auth] User not in Supabase, checking file store: ${cleanEmail}`);
    } catch (err: any) {
      if (err.message === 'Invalid email or password') throw err;
      console.error('[Auth] Supabase login error:', err);
      // Fall through to file-based
    }
  }

  // File-based storage
  const users = readUsersFile();
  const user = users[cleanEmail];
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(password.trim(), user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  console.log(`[Auth] Verified via file: ${cleanEmail}`);
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
