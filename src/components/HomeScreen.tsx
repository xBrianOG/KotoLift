import { useState, useEffect } from 'react';
import { getStats } from '../services/stats';

type HomeScreenProps = {
  onNavigate: (to: string) => void
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const [streak, setStreak] = useState(0);
  const [stars, setStars] = useState(0);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    getStats().then(stats => {
      setStreak(stats.streak);
      setStars(stats.stars);
      setLoading(false);
    });
  }, []);

  return (
    <div className="screen animate-fade-in" style={{ 
      display: 'flex', 
      flexDirection: 'column',
      paddingTop: 'var(--space-2xl)'
    }}>
      {/* Hero Section */}
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <p style={{ 
          fontSize: 'var(--font-sm)', 
          color: 'var(--text-secondary)',
          marginBottom: 'var(--space-xs)',
          fontWeight: 500,
          letterSpacing: '0.5px',
          textTransform: 'uppercase'
        }}>
          {greeting}
        </p>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: 700, 
          color: 'var(--text)',
          lineHeight: 1.1,
          letterSpacing: '-0.5px',
          marginBottom: 'var(--space-md)'
        }}>
          Ready to learn?
        </h1>
        
        {/* Streak indicator */}
        {!loading && streak > 0 && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            padding: 'var(--space-sm) var(--space-md)',
            background: 'var(--accent-light)',
            borderRadius: 'var(--radius-round)',
            color: 'var(--accent)'
          }}>
            <span style={{ fontSize: '1.25rem' }}>🔥</span>
            <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>
              {streak} day streak
            </span>
          </div>
        )}
      </div>

      {/* Primary CTA */}
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <button
          onClick={() => onNavigate('review')}
          style={{
            width: '100%',
            padding: 'var(--space-xl) var(--space-lg)',
            background: 'var(--sidebar-bg)',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ 
              fontSize: 'var(--font-xl)', 
              fontWeight: 600, 
              color: 'white',
              marginBottom: 'var(--space-xs)'
            }}>
              Start Review
            </div>
            <div style={{ 
              fontSize: 'var(--font-sm)', 
              color: 'var(--sidebar-text)'
            }}>
              5 cards ready to review
            </div>
          </div>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: 'var(--space-md)',
        marginBottom: 'var(--space-2xl)'
      }}>
        <div style={{
          padding: 'var(--space-lg)',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ 
            fontSize: 'var(--font-xs)', 
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 'var(--space-xs)'
          }}>
            Total Cards
          </div>
          <div style={{ 
            fontSize: '1.75rem', 
            fontWeight: 700, 
            color: 'var(--text)'
          }}>
            {loading ? '—' : '24'}
          </div>
        </div>
        
        <div style={{
          padding: 'var(--space-lg)',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ 
            fontSize: 'var(--font-xs)', 
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 'var(--space-xs)'
          }}>
            Stars Earned
          </div>
          <div style={{ 
            fontSize: '1.75rem', 
            fontWeight: 700, 
            color: 'var(--text)'
          }}>
            {loading ? '—' : stars}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 style={{ 
          fontSize: 'var(--font-sm)', 
          fontWeight: 600, 
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 'var(--space-md)'
        }}>
          Quick Actions
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <button
            onClick={() => onNavigate('add')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              padding: 'var(--space-md) var(--space-lg)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.2s ease, background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.background = 'var(--accent-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'var(--surface)';
            }}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)'
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 3V15M3 9H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 500, color: 'var(--text)' }}>Add New Card</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Create a custom flashcard</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('videoImport')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              padding: 'var(--space-md) var(--space-lg)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.2s ease, background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.background = 'var(--accent-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'var(--surface)';
            }}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)'
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7 7L11 9L7 11V7Z" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 500, color: 'var(--text)' }}>Import from Video</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Extract vocabulary from YouTube</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
