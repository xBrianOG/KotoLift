/* React is only needed for JSX transform; no explicit import is required in modern tooling */
import { useState, useEffect } from 'react'

export function SettingsScreen({ onBack, onSignOut }: { onBack?: () => void; onSignOut?: () => void } = {}) {
  const [quizSize, setQuizSize] = useState(10)
  
  useEffect(() => {
    const saved = localStorage.getItem('settings.quizSize')
    if (saved) setQuizSize(parseInt(saved, 10))
  }, [])
  
  const handleQuizSizeChange = (size: number) => {
    setQuizSize(size)
    localStorage.setItem('settings.quizSize', String(size))
  }
  
  return (
    <div className="screen" style={{ padding: 'var(--space-xl)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {onBack && (
          <button 
            onClick={onBack} 
            style={{ 
              padding: 'var(--space-sm) var(--space-md)', 
              border: 'none', 
              background: 'transparent',
              color: 'var(--accent)',
              fontWeight: 600,
              fontSize: 'var(--font-base)'
            }}
          >
            ← Back
          </button>
        )}
        <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 700 }}>Settings</h1>
      </div>

      {/* Reminders Section */}
      <div className="settings-section">
        <div className="settings-section-title">Reminders</div>
        <div className="settings-group">
          <NotificationSettingsRow />
        </div>
      </div>

      {/* Quiz Section */}
      <div className="settings-section">
        <div className="settings-section-title">Quiz</div>
        <div className="settings-group">
          <div className="settings-row">
            <span className="settings-row-label">Questions per session</span>
            <div className="settings-row-value">
              {[5, 10, 15].map(size => (
                <button
                  key={size}
                  onClick={() => handleQuizSizeChange(size)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: quizSize === size ? 'var(--accent)' : 'var(--bg)',
                    color: quizSize === size ? 'white' : 'var(--text)',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600,
                    marginLeft: 4
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Data Section */}
      <div className="settings-section">
        <div className="settings-section-title">Data</div>
        <div className="settings-group">
          <div className="settings-row" style={{ opacity: 0.5 }}>
            <span className="settings-row-label">Export Cards</span>
            <span className="settings-row-value">Coming soon</span>
          </div>
          <div className="settings-row" style={{ opacity: 0.5 }}>
            <span className="settings-row-label">Import Cards</span>
            <span className="settings-row-value">Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function NotificationSettingsRow() {
  const [enabled, setEnabled] = useState(true)
  const [time, setTime] = useState('19:00')
  
  useEffect(() => {
    const e = localStorage.getItem('dailyQuiz.enabled')
    const t = localStorage.getItem('dailyQuiz.time') || '19:00'
    setEnabled(e !== 'false')
    setTime(t)
  }, [])
  
  useEffect(() => {
    localStorage.setItem('dailyQuiz.enabled', String(enabled))
    localStorage.setItem('dailyQuiz.time', time)
  }, [enabled, time])
  
  return (
    <>
      <div className="settings-row">
        <span className="settings-row-label">Daily Reminder</span>
        <button 
          onClick={() => setEnabled(!enabled)}
          style={{
            width: 50,
            height: 30,
            borderRadius: 15,
            border: 'none',
            background: enabled ? 'var(--accent)' : 'var(--border)',
            position: 'relative',
            cursor: 'pointer'
          }}
        >
          <span style={{
            position: 'absolute',
            top: 3,
            left: enabled ? 23 : 3,
            width: 24,
            height: 24,
            borderRadius: 12,
            background: 'white',
            transition: 'left 0.2s'
          }} />
        </button>
      </div>
      {enabled && (
        <div className="settings-row">
          <span className="settings-row-label">Reminder Time</span>
          <input 
            type="time" 
            value={time} 
            onChange={(e) => setTime(e.target.value)}
            style={{ 
              border: 'none', 
              background: 'transparent', 
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-base)',
              textAlign: 'right'
            }} 
          />
        </div>
      )}

      {/* Sign Out */}
      <div style={{ marginTop: 'var(--space-3xl)' }}>
        <button 
          onClick={() => {
            if (onSignOut) {
              onSignOut();
            } else {
              localStorage.removeItem('auth.token');
              localStorage.removeItem('auth.user');
              window.location.reload();
            }
          }}
          style={{ 
            width: '100%',
            padding: 'var(--space-md)',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 12,
            color: 'var(--text-secondary)',
            fontSize: 'var(--font-base)'
          }}
        >
          Sign Out
        </button>
      </div>
    </>
  )
}
