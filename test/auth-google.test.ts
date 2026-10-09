// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStoredUser, signInWithGoogle, verifyGoogleAuthToken } from '../src/services/auth';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installMemoryStorage(): void {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  };
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
}

describe('Google auth verification', () => {
  beforeEach(() => {
    installMemoryStorage();
    localStorage.clear();
    window.history.replaceState({}, document.title, '/');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns the authenticated token subject from the verification endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      token: 'session-token',
      user: { id: 'real-google-user-id', email: 'user@example.com', name: 'User' },
    }));

    const result = await verifyGoogleAuthToken('session-token');

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/google/verify?token=session-token'));
    expect(result.user.id).toBe('real-google-user-id');
  });

  it('stores the verified user id for redirect fallback instead of generating a google timestamp id', async () => {
    window.history.replaceState({}, document.title, '/?auth_token=session-token&auth_name=Fallback&auth_email=fallback@example.com');
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      token: 'session-token',
      user: { id: 'real-google-user-id', email: 'user@example.com', name: 'User' },
    }));

    const result = await signInWithGoogle();

    expect(result.user.id).toBe('real-google-user-id');
    expect(getStoredUser()?.id).toBe('real-google-user-id');
    expect(getStoredUser()?.id).not.toMatch(/^google-\d+$/);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/google/verify?token=session-token'));
  });
});
