import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  ClipboardCheck,
  Zap,
  Layers,
  Plus,
  BookOpen,
  Settings,
  ChevronDown,
} from 'lucide-react'

type AppShellProps = {
  current: string
  onNavigate: (to: string) => void
  onBack?: () => void
  children: React.ReactNode
  userName?: string
}

const sidebarVariants = {
  open: { width: '15rem' },
  closed: { width: '3.5rem' },
}

const textVariants = {
  open: { opacity: 1, x: 0, display: 'block' },
  closed: { opacity: 0, x: -10, display: 'none' },
}

const transitionProps = {
  type: 'tween',
  ease: 'easeOut',
  duration: 0.2,
}

const navItems = [
  { key: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'review', label: 'Review', icon: ClipboardCheck },
  { key: 'drill', label: 'Practice', icon: Zap },
  { key: 'cards', label: 'My Cards', icon: Layers },
  { key: 'add', label: 'Add Content', icon: Plus },
]

const libraryItems = [
  { key: 'vocabulary', label: 'Vocabulary', icon: BookOpen },
]

export function AppShell({ current, onNavigate, children, userName = 'User' }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  
  const userInitial = userName.charAt(0).toUpperCase()

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      <div 
        className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
      
      {/* Sidebar */}
      <motion.aside
        className={`sidebar-wrapper ${mobileOpen ? 'mobile-open' : ''}`}
        initial={isCollapsed ? 'closed' : 'open'}
        animate={isCollapsed ? 'closed' : 'open'}
        variants={sidebarVariants}
        transition={transitionProps}
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
      >
        <div className="sidebar-inner">
          {/* Logo */}
          <div className="sidebar-header-minimal">
            <div className="sidebar-logo-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}>
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <motion.span 
              className="sidebar-logo-text"
              variants={textVariants}
              transition={transitionProps}
            >
              住友勉強
            </motion.span>
          </div>

          {/* Divider */}
          <div className="sidebar-divider" />

          {/* Main Nav */}
          <nav className="sidebar-nav-minimal">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = current === item.key
              return (
                <button
                  key={item.key}
                  className={`sidebar-item-minimal ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onNavigate(item.key)
                    setMobileOpen(false)
                  }}
                >
                  <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                  <motion.span
                    className="sidebar-item-text"
                    variants={textVariants}
                    transition={transitionProps}
                  >
                    {item.label}
                  </motion.span>
                </button>
              )
            })}

            {/* Divider */}
            <div className="sidebar-divider" />

            {/* Library section */}
            {libraryItems.map((item) => {
              const Icon = item.icon
              const isActive = current === item.key
              return (
                <button
                  key={item.key}
                  className={`sidebar-item-minimal ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onNavigate(item.key)
                    setMobileOpen(false)
                  }}
                >
                  <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                  <motion.span
                    className="sidebar-item-text"
                    variants={textVariants}
                    transition={transitionProps}
                  >
                    {item.label}
                  </motion.span>
                </button>
              )
            })}
          </nav>

          {/* Bottom section */}
          <div className="sidebar-footer-minimal">
            <div className="sidebar-divider" />
            
            <button
              className={`sidebar-item-minimal ${current === 'settings' ? 'active' : ''}`}
              onClick={() => {
                onNavigate('settings')
                setMobileOpen(false)
              }}
            >
              <Settings size={18} strokeWidth={1.5} />
              <motion.span
                className="sidebar-item-text"
                variants={textVariants}
                transition={transitionProps}
              >
                Settings
              </motion.span>
            </button>

            {/* User */}
            <div className="sidebar-user-minimal">
              <div className="sidebar-avatar-minimal">{userInitial}</div>
              <motion.div
                className="sidebar-user-info-minimal"
                variants={textVariants}
                transition={transitionProps}
              >
                <span className="sidebar-user-name-minimal">{userName}</span>
                <ChevronDown size={14} style={{ opacity: 0.5 }} />
              </motion.div>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="main-content-minimal">
        {/* Mobile header */}
        <header className="mobile-header">
          <button
            className="mobile-menu-trigger"
            onClick={() => setMobileOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 22, height: 22 }}>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="mobile-header-logo">KotoLift</span>
          <div style={{ width: 40 }} />
        </header>

        <main className="main-scroll">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab */}
      <nav className="bottom-tab" aria-label="Main navigation">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon
          const isActive = current === item.key
          return (
            <button
              key={item.key}
              className={`tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
              aria-label={item.label}
            >
              <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              <span style={{ fontSize: 10, marginTop: 2, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
