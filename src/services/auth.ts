const TOKEN_KEY = 'auth.token';
const USER_KEY = 'auth.user';

const DEV_AUTH = import.meta.env.VITE_DEV_AUTH === 'true';
const API_BASE = import.meta.env.VITE_API_BASE || '';

// Force bypass auth for testing - always use dev login
const FORCE_AUTH_BYPASS = true;

if (DEV_AUTH || FORCE_AUTH_BYPASS) {
  console.warn('⚠️ Running in DEV/BYPASS AUTH mode – Authentication bypassed for testing');
}

export interface User {
  id: string;
  email?: string;
  name?: string;
  isDev?: boolean;
}

export interface AuthResult {
  token: string;
  user: User;
}

export function isDevMode(): boolean {
  return DEV_AUTH || FORCE_AUTH_BYPASS;
}

export function getStoredToken(): string | null {
  // Bypass: always return a token for testing
  if (FORCE_AUTH_BYPASS) {
    return 'bypass-dev-token';
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const userJson = localStorage.getItem(USER_KEY);
  if (userJson) {
    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  }
  return null;
}

export function isLoggedIn(): boolean {
  // Bypass: always return true for testing
  if (FORCE_AUTH_BYPASS) {
    return true;
  }
  return !!getStoredToken();
}

export function storeAuth(result: AuthResult): void {
  localStorage.setItem(TOKEN_KEY, result.token);
  localStorage.setItem(USER_KEY, JSON.stringify(result.user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function signInWithApple(): Promise<AuthResult> {
  // Bypass: always use dev login for testing
  if (FORCE_AUTH_BYPASS) {
    return devLogin();
  }

  if (DEV_AUTH) {
    return devLogin();
  }

  const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
  
  const result = await SignInWithApple.authorize({
    clientId: 'com.kotolift.app',
    redirectURI: 'https://kotolift.app/callback',
    scopes: 'email name'
  });

  const responseData = result.response;

  if (!responseData.identityToken) {
    throw new Error('No identity token received from Apple');
  }

  const response = await fetch(`${API_BASE}/auth/apple`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      identityToken: responseData.identityToken,
      authorizationCode: responseData.authorizationCode,
      user: responseData.user ? {
        id: responseData.user,
        email: responseData.email,
        fullName: `${responseData.givenName || ''} ${responseData.familyName || ''}`.trim()
      } : undefined
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Authentication failed' }));
    throw new Error(error.error || 'Authentication failed');
  }

  const authResult: AuthResult = await response.json();
  storeAuth(authResult);
  return authResult;
}

export async function devLogin(): Promise<AuthResult> {
  const devToken = 'dev-token-' + Date.now();
  const devUser: User = {
    id: 'dev-user',
    name: 'Dev User',
    isDev: true
  };
  
  storeAuth({ token: devToken, user: devUser });
  return { token: devToken, user: devUser };
}

export function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  if (token) {
    return {
      'Authorization': `Bearer ${token}`
    };
  }
  return {};
}

export async function signOut(): Promise<void> {
  clearAuth();
}
