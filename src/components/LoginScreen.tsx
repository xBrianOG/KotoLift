import { useState, useEffect } from 'react';
import { signInWithApple, signInWithEmail, registerWithEmail, isDevMode, devLogin } from '../services/auth';

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState<'login' | 'register' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (isDevMode()) {
      devLogin().then(onLogin).catch(console.error);
    }
  }, [onLogin]);

  const handleAppleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      await signInWithApple();
      onLogin();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      
      if (message.includes('requires iOS')) {
        setError('Apple Sign-In requires an iOS build. Please run on iOS simulator or device.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (showEmailForm === 'register') {
        await registerWithEmail(email, password, name || undefined);
      } else {
        await signInWithEmail(email, password);
      }
      onLogin();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 'var(--space-xl)',
      paddingTop: 'calc(env(safe-area-inset-top) + var(--space-xl))',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--space-xl))'
    }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
        <h1 style={{ 
          fontSize: 'var(--font-3xl)', 
          fontWeight: 700, 
          marginBottom: 'var(--space-sm)',
          letterSpacing: -0.5 
        }}>
          住友勉強
        </h1>
        <p style={{ 
          color: 'var(--text-secondary)', 
          fontSize: 'var(--font-base)' 
        }}>
          多言語フラッシュカードで学ぼう
        </p>
      </div>

      {!showEmailForm ? (
        <>
          <button
            className="apple-sign-in-btn"
            onClick={handleAppleSignIn}
            disabled={loading}
            style={{
              width: '100%',
              maxWidth: 280,
              padding: '14px 24px',
              fontSize: 'var(--font-base)',
              fontWeight: 500,
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              opacity: loading ? 0.6 : 1,
              transition: 'transform 0.1s ease, opacity 0.1s ease'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            {loading ? 'Signing in...' : 'Sign in with Apple'}
          </button>

          <button
            onClick={() => setShowEmailForm('login')}
            style={{
              marginTop: 'var(--space-lg)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-sm)',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Or sign in with email / create account
          </button>
        </>
      ) : (
        <form onSubmit={handleEmailSubmit} style={{ width: '100%', maxWidth: 280 }}>
          {showEmailForm === 'register' && (
            <input
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                marginBottom: 'var(--space-md)',
                fontSize: 'var(--font-base)',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text)',
                outline: 'none'
              }}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '12px 16px',
              marginBottom: 'var(--space-md)',
              fontSize: 'var(--font-base)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text)',
              outline: 'none'
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              padding: '12px 16px',
              marginBottom: 'var(--space-lg)',
              fontSize: 'var(--font-base)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text)',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 24px',
              fontSize: 'var(--font-base)',
              fontWeight: 500,
              backgroundColor: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading 
              ? (showEmailForm === 'register' ? 'Creating account...' : 'Signing in...') 
              : (showEmailForm === 'register' ? 'Create Account' : 'Sign In')
            }
          </button>
          <button
            type="button"
            onClick={() => { setShowEmailForm(null); setError(null); }}
            style={{
              marginTop: 'var(--space-md)',
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-sm)',
              cursor: 'pointer'
            }}
          >
            Back
          </button>
          {showEmailForm === 'login' && (
            <p style={{ marginTop: 'var(--space-md)', textAlign: 'center', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setShowEmailForm('register'); setError(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-sm)',
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                Sign up
              </button>
            </p>
          )}
        </form>
      )}

      {error && (
        <p style={{ 
          marginTop: 'var(--space-lg)', 
          color: 'var(--error)', 
          fontSize: 'var(--font-sm)',
          textAlign: 'center'
        }}>
          {error}
        </p>
      )}
    </div>
  );
}
