import { useState, useEffect } from 'react';
import { getStats } from '../services/stats';
import { BookOpen, Plus, Video, ArrowRight, Lightbulb } from 'lucide-react';

type HomeScreenProps = {
  onNavigate: (to: string) => void
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    getStats().then(stats => {
      setStreak(stats.streak);
      setLoading(false);
    });
  }, []);

  return (
    <div className="screen animate-fade-in" style={{ 
      display: 'flex', 
      flexDirection: 'column',
      paddingTop: 'var(--space-3xl)',
      maxWidth: 640
    }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-3xl)' }}>
        <p style={{ 
          fontSize: 'var(--font-sm)', 
          color: 'var(--text-tertiary)',
          marginBottom: 'var(--space-sm)',
          fontWeight: 500
        }}>
          {greeting}
        </p>
        <h1 style={{ 
          fontSize: 'var(--font-3xl)', 
          fontWeight: 600, 
          color: 'var(--text)',
          lineHeight: 1.2,
          letterSpacing: '-0.5px'
        }}>
          Ready to learn?
        </h1>
      </div>

      {/* Primary Action */}
      <button
        onClick={() => onNavigate('review')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-lg)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          cursor: 'pointer',
          marginBottom: 'var(--space-lg)',
          transition: 'all 0.15s ease',
          width: '100%',
          textAlign: 'left'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)'
          }}>
            <BookOpen size={20} />
          </div>
          <div>
            <div style={{ 
              fontSize: 'var(--font-base)', 
              fontWeight: 500, 
              color: 'var(--text)'
            }}>
              Start Review
            </div>
            <div style={{ 
              fontSize: 'var(--font-sm)', 
              color: 'var(--text-tertiary)'
            }}>
              5 cards ready
            </div>
          </div>
        </div>
        <ArrowRight size={20} style={{ color: 'var(--text-tertiary)' }} />
      </button>

      {/* Stats */}
      <div style={{ 
        display: 'flex', 
        gap: 'var(--space-md)',
        marginBottom: 'var(--space-3xl)'
      }}>
        <div style={{
          flex: 1,
          padding: 'var(--space-lg)',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ 
            fontSize: 'var(--font-xs)', 
            color: 'var(--text-tertiary)',
            marginBottom: 'var(--space-xs)'
          }}>
            Total Cards
          </div>
          <div style={{ 
            fontSize: 'var(--font-2xl)', 
            fontWeight: 600, 
            color: 'var(--text)'
          }}>
            {loading ? '—' : '24'}
          </div>
        </div>
        
        <div style={{
          flex: 1,
          padding: 'var(--space-lg)',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ 
            fontSize: 'var(--font-xs)', 
            color: 'var(--text-tertiary)',
            marginBottom: 'var(--space-xs)'
          }}>
            Day Streak
          </div>
          <div style={{ 
            fontSize: 'var(--font-2xl)', 
            fontWeight: 600, 
            color: 'var(--text)'
          }}>
            {loading ? '—' : streak}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 style={{ 
          fontSize: 'var(--font-xs)', 
          fontWeight: 500, 
          color: 'var(--text-tertiary)',
          marginBottom: 'var(--space-md)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Quick Actions
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <button
            onClick={() => onNavigate('add')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              padding: 'var(--space-md)',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s ease',
              width: '100%'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Plus size={18} style={{ color: 'var(--text-tertiary)' }} />
            <span style={{ fontWeight: 500, color: 'var(--text)', fontSize: 'var(--font-sm)' }}>Add New Card</span>
          </button>

          <button
            onClick={() => onNavigate('explain')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              padding: 'var(--space-md)',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s ease',
              width: '100%'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Lightbulb size={18} style={{ color: 'var(--text-tertiary)' }} />
            <span style={{ fontWeight: 500, color: 'var(--text)', fontSize: 'var(--font-sm)' }}>Explain a Sentence</span>
          </button>

          <button
            onClick={() => onNavigate('videoImport')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              padding: 'var(--space-md)',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s ease',
              width: '100%'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Video size={18} style={{ color: 'var(--text-tertiary)' }} />
            <span style={{ fontWeight: 500, color: 'var(--text)', fontSize: 'var(--font-sm)' }}>Import from Video</span>
          </button>
        </div>
      </div>
    </div>
  )
}
