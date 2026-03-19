import * as jose from 'jose';
import bcrypt from 'bcryptjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';
const JWT_SECRET = process.env.JWT_SECRET || 'kotolift-dev-secret-change-in-prod';
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || 'com.kotolift.app';

const JWKS = jose.createRemoteJWKSet(new URL(APPLE_JWKS_URI));

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[Auth] Connected to Supabase');
  }
  if (!supabase) {
    throw new Error('Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  }
  return supabase;
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

export async function registerEmailUser(email: string, password: string, name?: string): Promise<EmailUser> {
  const cleanEmail = email.trim().toLowerCase();
  
  console.log(`[Auth] Registering new user: ${cleanEmail}`);
  
  const passwordHash = await bcrypt.hash(password.trim(), 10);
  
  try {
    const client = getSupabaseClient();
    
    // Check if user already exists
    const { data: existing } = await client
      .from('email_users')
      .select('id')
      .eq('email', cleanEmail)
      .single();
    
    if (existing) {
      throw new Error('Email already registered');
    }
    
    // Insert new user
    const { data, error } = await client
      .from('email_users')
      .insert({
        email: cleanEmail,
        password_hash: passwordHash,
        name: name?.trim() || null
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Auth] Supabase insert error:', error);
      throw new Error('Failed to create user');
    }
    
    console.log(`[Auth] User registered successfully: ${cleanEmail}`);
    
    return {
      id: data.id,
      email: data.email,
      passwordHash: data.password_hash,
      name: data.name,
      createdAt: new Date(data.created_at).getTime()
    };
  } catch (err: any) {
    if (err.message === 'Email already registered' || err.message === 'Supabase not configured') {
      throw err;
    }
    console.error('[Auth] Registration error:', err);
    throw new Error('Failed to register user');
  }
}

export async function verifyEmailUser(email: string, password: string): Promise<EmailUser> {
  const cleanEmail = email.trim().toLowerCase();
  
  console.log(`[Auth] Verifying user: ${cleanEmail}`);
  
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('email_users')
      .select('id, email, password_hash, name, created_at')
      .eq('email', cleanEmail)
      .single();
    
    if (error || !data) {
      console.warn(`[Auth] Login failed: User not found (${cleanEmail})`);
      throw new Error('Invalid email or password');
    }
    
    const valid = await bcrypt.compare(password.trim(), data.password_hash);
    if (!valid) {
      console.warn(`[Auth] Login failed: Invalid password for ${cleanEmail}`);
      throw new Error('Invalid email or password');
    }
    
    console.log(`[Auth] User verified successfully: ${cleanEmail}`);
    
    return {
      id: data.id,
      email: data.email,
      passwordHash: data.password_hash,
      name: data.name,
      createdAt: new Date(data.created_at).getTime()
    };
  } catch (err: any) {
    if (err.message === 'Invalid email or password' || err.message === 'Supabase not configured') {
      throw err;
    }
    console.error('[Auth] Verification error:', err);
    throw new Error('Invalid email or password');
  }
}

export async function createEmailSessionToken(user: EmailUser): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new jose.SignJWT({ sub: user.id, email: user.email, name: user.name, type: 'email' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}
