import React, { useState } from 'react'

type AppShellProps = {
  current: string
  onNavigate: (to: string) => void
  onBack?: () => void
  children: React.ReactNode
  userName?: string
}

const SidebarIcon = ({ name }: { name: string }) => {
  const icons: Record<string, React.ReactNode> = {
    home: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="sidebar-item-icon">
        <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
      </svg>
    ),
    review: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="sidebar-item-icon">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    drill: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="sidebar-item-icon">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    cards: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="sidebar-item-icon">
        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    add: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="sidebar-item-icon">
        <path d="M12 4v16m8-8H4" />
      </svg>
    ),
    vocabulary: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="sidebar-item-icon">
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    settings: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="sidebar-item-icon">
        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  }
  return icons[name] || icons.home
}

const navItems = [
  { key: 'home', label: 'Dashboard', icon: 'home' },
  { key: 'review', label: 'Review', icon: 'review' },
  { key: 'drill', label: 'Practice', icon: 'drill' },
  { key: 'cards', label: 'My Cards', icon: 'cards' },
  { key: 'add', label: 'Add Content', icon: 'add' },
]

const screenTitles: Record<string, string> = {
  home: 'Dashboard',
  review: 'Review Session',
  drill: 'Practice Mode',
  cards: 'My Cards',
  add: 'Add Content',
  settings: 'Settings',
  vocabulary: 'Vocabulary',
}

export function AppShell({ current, onNavigate, onBack, children, userName = 'User' }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const currentTitle = screenTitles[current] || 'KotoLift'
  const userInitial = userName.charAt(0).toUpperCase()
  
  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 28, height: 28 }}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            KotoLift
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">Main</div>
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`sidebar-item ${current === item.key ? 'active' : ''}`}
                onClick={() => {
                  onNavigate(item.key)
                  setSidebarOpen(false)
                }}
              >
                <SidebarIcon name={item.icon} />
                {item.label}
              </button>
            ))}
          </div>
          
          <div className="sidebar-section">
            <div className="sidebar-section-title">Library</div>
            <button
              className={`sidebar-item ${current === 'vocabulary' ? 'active' : ''}`}
              onClick={() => {
                onNavigate('vocabulary')
                setSidebarOpen(false)
              }}
            >
              <SidebarIcon name="vocabulary" />
              Vocabulary
            </button>
          </div>
        </nav>
        
        <div className="sidebar-footer">
          <div 
            className="sidebar-user"
            onClick={() => {
              onNavigate('settings')
              setSidebarOpen(false)
            }}
          >
            <div className="sidebar-avatar">{userInitial}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{userName}</div>
              <div className="sidebar-user-email">Settings</div>
            </div>
            <SidebarIcon name="settings" />
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <div className="main-content">
        <header className="main-header">
          <div className="flex-center gap-md">
            <button
              className="mobile-menu-btn btn-subtle"
              onClick={() => setSidebarOpen(true)}
              style={{ 
                padding: 8, 
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 24, height: 24 }}>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {onBack && (
              <button
                aria-label="Back"
                onClick={onBack}
                className="btn-subtle"
                style={{ 
                  padding: 8, 
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </button>
            )}
            <h1 className="main-header-title">{currentTitle}</h1>
          </div>
          <div className="main-header-actions">
            <button 
              className="btn-subtle"
              onClick={() => onNavigate('settings')}
              style={{ 
                padding: 8, 
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 22, height: 22 }}>
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
          </div>
        </header>
        
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
      
      {/* Mobile Bottom Tab - Only shown on mobile */}
      <nav className="bottom-tab" aria-label="Main navigation">
        {navItems.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${current === t.key ? 'active' : ''}`}
            onClick={() => onNavigate(t.key)}
            aria-label={t.label}
          >
            <SidebarIcon name={t.icon} />
            <span style={{ fontSize: 11, marginTop: 2 }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
