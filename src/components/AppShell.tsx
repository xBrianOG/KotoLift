import React from 'react'

type AppShellProps = {
  current: string
  onNavigate: (to: string) => void
  children: React.ReactNode
}

const TabIcon = ({ name, active }: { name: string; active: boolean }) => {
  const color = active ? 'var(--accent)' : 'var(--text-secondary)'
  const renderIcon = (key: string): React.ReactNode => {
    const icons: Record<string, React.ReactNode> = {
      home: <svg key="home" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" /></svg>,
      review: <svg key="review" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
      drill: <svg key="drill" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
      cards: <svg key="cards" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
      add: <svg key="add" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M12 4v16m8-8H4" /></svg>,
    }
    return icons[key] || icons.home
  }
  return <span className="tab-icon" style={{ width: 24, height: 24, display: 'flex' }}>{renderIcon(name)}</span>
}

export function AppShell({ current, onNavigate, children }: AppShellProps) {
  const isMainTab = ['home', 'review', 'drill', 'cards', 'add'].includes(current)
  
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <header className="flex-between" style={{ 
        padding: 'var(--space-md) var(--space-xl)', 
        borderBottom: '1px solid var(--border-light)', 
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div className="flex-center gap-sm">
          <span className="font-bold text-lg text-primary" style={{ letterSpacing: '-0.3px' }}>KotoLift</span>
        </div>
        {isMainTab && (
          <button 
            aria-label="Settings" 
            onClick={() => onNavigate('settings')} 
            style={{ 
              border: 'none', 
              background: 'var(--bg)', 
              padding: '8px', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5" style={{ width: 22, height: 22 }}>
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </header>
      
      <main style={{ flex: 1, paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        {children}
      </main>
      
      <nav className="bottom-tab" aria-label="Main navigation">
        {[
          { key: 'home', label: 'Home' },
          { key: 'review', label: 'Review' },
          { key: 'drill', label: 'Drill' },
          { key: 'cards', label: 'Cards' },
          { key: 'add', label: 'Add' },
        ].map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${current === t.key ? 'active' : ''}`}
            onClick={() => onNavigate(t.key)}
            aria-label={t.label}
            style={{ position: 'relative' }}
          >
            <TabIcon name={t.key} active={current === t.key} />
            <span style={{ fontSize: 'var(--font-xs)', marginTop: 2 }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
