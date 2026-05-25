const TOKEN_KEY = 'auth.token';
const USER_KEY = 'auth.user';

const DEV_AUTH = import.meta.env.VITE_DEV_AUTH === 'true';
const API_BASE = import.meta.env.VITE_API_BASE || 'https://kotolift.onrender.com';

if (DEV_AUTH) {
  console.warn('⚠️ Running in DEV AUTH mode – Authentication bypassed for testing');
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
  return DEV_AUTH;
}

export function getStoredToken(): string | null {
  if (DEV_AUTH) {
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
  if (DEV_AUTH) {
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

  const response = await fetch(`${API_BASE}/api/auth/apple`, {
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

export async function signInWithEmail(email: string, password: string, rememberMe?: boolean): Promise<AuthResult> {
  if (DEV_AUTH) {
    return devLogin();
  }

  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password, rememberMe })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(error.error || 'Login failed');
  }

  const authResult: AuthResult = await response.json();
  storeAuth(authResult);
  return authResult;
}

export async function registerWithEmail(email: string, password: string, name?: string, rememberMe?: boolean): Promise<AuthResult> {
  if (DEV_AUTH) {
    return devLogin();
  }

  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password, name, rememberMe })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Registration failed' }));
    throw new Error(error.error || 'Registration failed');
  }

  const authResult: AuthResult = await response.json();
  storeAuth(authResult);
  return authResult;
}

export async function signInWithGoogle(): Promise<AuthResult> {
  if (DEV_AUTH) {
    return devLogin();
  }

  try {
    // Get OAuth URL from backend
    const response = await fetch(`${API_BASE}/api/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Google sign in failed' }));
      throw new Error(error.error || 'Failed to start Google sign in');
    }

    const { authUrl } = await response.json();

    // Return a promise that resolves when the user completes auth
    // The frontend should open authUrl in a browser and handle the redirect
    // For now, we'll use a simple approach - open in same window (for web)
    // and check for token in URL after redirect
    
    return new Promise((resolve, reject) => {
      // Open Google OAuth in a popup or redirect
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const authWindow = window.open(
        authUrl, 
        'Google Sign In',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      );

      if (!authWindow) {
        reject(new Error('Popup blocked. Please allow popups for this site.'));
        return;
      }

      // Listen for messages from the popup
      const checkAuth = setInterval(() => {
        try {
          if (authWindow.closed) {
            clearInterval(checkAuth);
            // Try to check if there's a token in localStorage (set by the callback)
            const token = localStorage.getItem('google_auth_token');
            const userStr = localStorage.getItem('google_auth_user');
            
            if (token && userStr) {
              localStorage.removeItem('google_auth_token');
              localStorage.removeItem('google_auth_user');
              const user = JSON.parse(userStr);
              storeAuth({ token, user });
              resolve({ token, user });
            } else {
              reject(new Error('Sign in was cancelled'));
            }
          }
        } catch (e) {
          // Cross-origin access - ignore
        }
      }, 500);

      // Also check for token in current URL (fallback for redirect flow)
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('auth_token');
      const name = urlParams.get('auth_name');
      const email = urlParams.get('auth_email');
      const error = urlParams.get('auth_error');

      if (error) {
        clearInterval(checkAuth);
        authWindow.close();
        reject(new Error(decodeURIComponent(error)));
      }

      if (token) {
        clearInterval(checkAuth);
        authWindow.close();
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        const user: User = {
          id: `google-${Date.now()}`,
          email: email || undefined,
          name: name || undefined
        };
        
        storeAuth({ token, user });
        resolve({ token, user });
      }
    });
  } catch (err: any) {
    console.error('Google sign in error:', err);
    throw err;
  }
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
