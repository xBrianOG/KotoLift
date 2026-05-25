import { useState, useEffect } from 'react';
import { signInWithEmail, registerWithEmail, isDevMode, devLogin, signInWithGoogle } from '../services/auth';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

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
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    if (isDevMode()) {
      devLogin().then(onLogin).catch(console.error);
    }
  }, [onLogin]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      await signInWithGoogle();
      onLogin();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign in failed';
      setError(message);
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
        await registerWithEmail(email, password, name || undefined, rememberMe);
      } else {
        await signInWithEmail(email, password, rememberMe);
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
    <div 
      className="screen animate-fade-in" 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 'var(--space-xl)',
        paddingTop: 'calc(env(safe-area-inset-top) + var(--space-xl))',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--space-xl))'
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
          <h1 style={{ 
            fontSize: 'var(--font-3xl)', 
            fontWeight: 700, 
            marginBottom: 'var(--space-sm)',
            letterSpacing: -0.5,
            color: 'var(--text)'
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

        {/* Login Card */}
        <div 
          className="card"
          style={{ 
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-xl)'
          }}
        >
          {!showEmailForm ? (
            <>
              {/* Google Sign In */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="btn btn-secondary btn-full"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-sm)',
                  padding: '14px 24px',
                  fontSize: 'var(--font-base)',
                  fontWeight: 500,
                  marginBottom: 'var(--space-lg)'
                }}
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Continue with Google
              </button>

              {/* Divider */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 'var(--space-md)',
                marginBottom: 'var(--space-lg)'
              }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              {/* Email/Password Link */}
              <button
                onClick={() => setShowEmailForm('login')}
                className="btn btn-primary btn-full"
                style={{
                  padding: '14px 24px',
                  fontSize: 'var(--font-base)',
                  fontWeight: 500
                }}
              >
                Continue with Email
              </button>
            </>
          ) : (
            <form onSubmit={handleEmailSubmit}>
              <h2 style={{ 
                fontSize: 'var(--font-xl)', 
                fontWeight: 600, 
                marginBottom: 'var(--space-lg)',
                textAlign: 'center',
                color: 'var(--text)'
              }}>
                {showEmailForm === 'register' ? 'Create Account' : 'Welcome Back'}
              </h2>

              {showEmailForm === 'register' && (
                <div className="mb-md">
                  <input
                    type="text"
                    placeholder="Name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                  />
                </div>
              )}

              <div className="mb-md">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input"
                />
              </div>

              <div className="mb-lg">
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input"
                />
              </div>

              <label 
                className="flex-center gap-sm mb-lg cursor-pointer" 
                style={{ justifyContent: 'flex-start', marginBottom: 'var(--space-lg)' }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="checkbox"
                />
                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                  Remember me
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-full"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-sm)'
                }}
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    {showEmailForm === 'register' ? 'Create Account' : 'Sign In'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setShowEmailForm(null); setError(null); }}
                className="btn btn-subtle btn-full mt-md"
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
            <div 
              className="mt-md"
              style={{ 
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--danger-light)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger)',
                fontSize: 'var(--font-sm)',
                textAlign: 'center'
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Back to options (when in email form) */}
        {showEmailForm && (
          <button
            onClick={() => { setShowEmailForm(null); setError(null); }}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 'var(--space-lg)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-sm)',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            ← Back to other options
          </button>
        )}
      </div>
    </div>
  );
}