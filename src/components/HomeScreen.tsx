// React is only used for JSX transform in this file; modern tooling may not require an explicit React import
import { useState, useEffect } from 'react';
import { getStats } from '../services/stats';

type HomeScreenProps = {
  onNavigate: (to: string) => void
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const [streak, setStreak] = useState(0);
  const [stars, setStars] = useState(0);

  useEffect(() => {
    const stats = getStats();
    setStreak(stats.streak);
    setStars(stats.stars);
  }, []);
  return (
    <div className="screen" style={{ padding: 'var(--space-xl)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 style={{ fontSize: 'var(--font-3xl)', fontWeight: 700, marginBottom: 4, letterSpacing: -0.5 }}>Today</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-base)' }}>Ready to practice?</p>
      </div>
      
      {/* Stats chips - smaller and refined */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-xl)' }}>
        <span className="chip" style={{ fontSize: 'var(--font-xs)', padding: '4px 10px' }}>🔥 {streak} days</span>
        <span className="chip" style={{ fontSize: 'var(--font-xs)', padding: '4px 10px' }}>⭐ {stars}</span>
      </div>
      
      {/* Main CTA Card - elevated */}
      <div className="card card--elevated" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-lg)', textAlign: 'center', cursor: 'pointer' }} onClick={() => onNavigate('review')}>
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, marginBottom: 'var(--space-xs)' }}>Daily Quiz</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', fontSize: 'var(--font-sm)' }}>5 questions • ~2 min</p>
        <button className="primaryButton" onClick={(e) => { e.stopPropagation(); onNavigate('review') }}>
          Start Quiz
        </button>
      </div>
      
      {/* Secondary Actions - clean cards without extra borders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
        <div className="card" style={{ padding: 'var(--space-lg)', textAlign: 'center', cursor: 'pointer', border: 'none' }} onClick={() => onNavigate('cards')}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>📚</div>
          <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>My Cards</div>
        </div>
        
        <div className="card" style={{ padding: 'var(--space-lg)', textAlign: 'center', cursor: 'pointer', border: 'none' }} onClick={() => onNavigate('add')}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>➕</div>
          <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>Add New</div>
        </div>

        <div className="card" style={{ padding: 'var(--space-lg)', textAlign: 'center', cursor: 'pointer', border: 'none' }} onClick={() => onNavigate('videoImport')}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>🎬</div>
          <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>Import</div>
        </div>
      </div>
    </div>
  )
}
