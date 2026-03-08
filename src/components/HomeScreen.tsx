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
    <div className="screen animate-fade-in">
      {/* Header */}
      <div className="mb-xl">
        <h1 className="text-3xl font-bold mb-xs">Today</h1>
        <p className="text-secondary text-base">Ready to practice?</p>
      </div>
      
      {/* Stats chips */}
      <div className="flex-center gap-sm mb-xl" style={{ justifyContent: 'flex-start' }}>
        <span className="chip">🔥 {streak} days</span>
        <span className="chip">⭐ {stars}</span>
      </div>
      
      {/* Main CTA Card */}
      <div 
        className="card card--elevated card-clickable mb-lg text-center" 
        onClick={() => onNavigate('review')}
      >
        <h2 className="text-xl font-semibold mb-sm text-primary">Daily Quiz</h2>
        <p className="text-secondary text-sm mb-xl">5 questions • ~2 min</p>
        <button className="btn btn-primary btn-full animate-pulse delay-200" onClick={(e) => { e.stopPropagation(); onNavigate('review') }}>
          Start Quiz
        </button>
      </div>
      
      {/* Secondary Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
        <div className="card card-clickable text-center" style={{ padding: 'var(--space-lg)' }} onClick={() => onNavigate('cards')}>
          <div className="mb-xs" style={{ fontSize: 28 }}>📚</div>
          <div className="font-semibold text-sm text-primary">My Cards</div>
        </div>
        
        <div className="card card-clickable text-center" style={{ padding: 'var(--space-lg)' }} onClick={() => onNavigate('add')}>
          <div className="mb-xs" style={{ fontSize: 28 }}>➕</div>
          <div className="font-semibold text-sm text-primary">Add New</div>
        </div>

        <div className="card card-clickable text-center" style={{ padding: 'var(--space-lg)' }} onClick={() => onNavigate('videoImport')}>
          <div className="mb-xs" style={{ fontSize: 28 }}>🎬</div>
          <div className="font-semibold text-sm text-primary">Import</div>
        </div>
      </div>
    </div>
  )
}
