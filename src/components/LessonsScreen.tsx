import { useState, useEffect } from 'react';
import { getAuthHeaders } from '../services/auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://kotolift.onrender.com';

interface Lesson {
  id: string;
  title: string;
  description: string;
  level: string;
  type: string;
  vocabulary_ids: string[];
  xp_reward: number;
  content: any;
}

interface LessonContent {
  exercises?: Array<any>;
}

interface LessonsScreenProps {
  onBack: () => void;
  onNavigate?: (to: string) => void;
}

const LEVELS = [
  { key: 'all', label: 'All' },
  { key: 'B1', label: 'B1' },
  { key: 'B2', label: 'B2' }
];

export function LessonsScreen({ onBack }: LessonsScreenProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [filterLevel, setFilterLevel] = useState('all');

  const fetchLessons = async (level?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (level && level !== 'all') params.append('level', level);
      params.append('limit', '50');
      const res = await fetch(`${API_BASE}/api/lessons?${params}`, { headers: { ...getAuthHeaders() } });
      const data = await res.json();
      setLessons(data.lessons || []);
    } catch (err) {
      console.error('Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLessons(); }, []);
  useEffect(() => { fetchLessons(filterLevel !== 'all' ? filterLevel : undefined); }, [filterLevel]);

  if (selectedLesson) {
    return <LessonPlayer lesson={selectedLesson} onBack={() => setSelectedLesson(null)} />;
  }

  return (
    <div className="screen animate-fade-in" style={{ padding: 'var(--space-xl)' }}>
      <div className="mb-lg">
        <h1 className="text-2xl font-bold mb-xs">Lessons</h1>
        <p className="text-secondary text-sm">Master B1-B2 vocabulary</p>
      </div>

      {/* My Decks Section */}
      <div className="card p-md mb-lg" style={{ cursor: 'pointer' }} onClick={() => onNavigate?.('deckList')}>
        <div className="flex-center gap-md">
          <div className="flex-center" style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-light)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 className="font-semibold">My Decks</h3>
            <p className="text-xs text-secondary">Import and review your flashcard decks</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      <div className="flex gap-sm mb-lg" style={{ overflowX: 'auto' }}>
        {LEVELS.map(lvl => (
          <button key={lvl.key} className={`chip ${filterLevel === lvl.key ? 'active' : ''}`} onClick={() => setFilterLevel(lvl.key)}>
            {lvl.label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center p-xl"><p>Loading...</p></div>
      : lessons.length === 0 ? <div className="text-center p-xl"><p className="text-secondary">No lessons found</p></div>
      : (
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          {lessons.map(lesson => (
            <div key={lesson.id} className="card card-clickable" onClick={() => setSelectedLesson(lesson)}>
              <div className="flex-between">
                <div style={{ flex: 1 }}>
                  <div className="flex gap-sm mb-xs">
                    <span className="chip">{lesson.level}</span>
                  </div>
                  <h3 className="font-semibold mb-xs">{lesson.title}</h3>
                  <p className="text-secondary text-sm">{lesson.description}</p>
                </div>
                <div className="text-center" style={{ minWidth: 50 }}>
                  <div className="text-lg font-bold text-accent">+{lesson.xp_reward}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LessonPlayer({ lesson, onBack }: { lesson: Lesson; onBack: () => void }) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [completed, setCompleted] = useState(false);

  const content: LessonContent = typeof lesson.content === 'string' ? JSON.parse(lesson.content) : lesson.content;
  const exercises = content?.exercises || [];
  const ex = exercises[current];

  const handleAnswer = (answer: string) => {
    setSelected(answer);
    setShowResult(true);
  };

  const next = () => {
    if (current < exercises.length - 1) {
      setCurrent(c => c + 1);
      setSelected(null);
      setShowResult(false);
    } else {
      setCompleted(true);
    }
  };

  if (!ex) {
    return (
      <div className="screen animate-fade-in" style={{ padding: 'var(--space-xl)' }}>
        <button onClick={onBack} className="btn btn-secondary mb-lg">← Back</button>
        <p>No exercises available.</p>
      </div>
    );
  }

  const isCorrect = selected === ex.correctAnswer;
  const options = ex.options || [];

  return (
    <div className="screen animate-fade-in" style={{ padding: 'var(--space-lg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="flex-between mb-md">
        <button onClick={onBack} className="btn btn-secondary" style={{ padding: '8px 12px' }}>✕</button>
        <span className="chip">{lesson.level}</span>
      </div>

      {/* Progress */}
      <div style={{ background: 'var(--bg-secondary)', height: 6, borderRadius: 3, marginBottom: 'var(--space-md)' }}>
        <div style={{ background: 'var(--success)', height: '100%', borderRadius: 3, width: `${((current + 1) / exercises.length) * 100}%`, transition: 'width 0.3s' }} />
      </div>
      <p className="text-center text-secondary text-sm mb-lg">{current + 1} / {exercises.length}</p>

      {/* Main Card */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'var(--space-xl)' }}>
        
        {/* 1. FILL-IN-THE-BLANK SENTENCE - at the TOP */}
        <div className="mb-lg" style={{ padding: 'var(--space-lg)', background: 'var(--bg-elevated)', borderRadius: 12 }}>
          <p className="text-secondary text-sm mb-xs">Complete the sentence:</p>
          <p className="font-medium" style={{ fontSize: '1.2rem', lineHeight: 1.6 }}>{ex.sentence}</p>
        </div>

        {/* 2. Part of Speech */}
        <div className="text-center mb-md">
          <div className="text-secondary">{ex.partOfSpeech}</div>
        </div>

        {/* 3. MEANING - English + Japanese (shown BEFORE answering as hints) */}
        {!showResult && (
          <div className="mb-lg" style={{ padding: 'var(--space-md)', background: 'var(--bg-secondary)', borderRadius: 8 }}>
            <p className="text-secondary text-sm mb-xs">Hint (meaning):</p>
            <p className="font-medium" style={{ fontSize: '1rem', marginBottom: 12 }}>{ex.english}</p>
            <p className="text-secondary text-sm mb-xs">意味：</p>
            <p className="font-medium" style={{ fontSize: '1rem' }}>{ex.japanese}</p>
          </div>
        )}

        {/* 4. Answer Options */}
        {!showResult ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p className="text-center text-secondary mb-md">Choose the correct word:</p>
            <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
              {options.map((opt: string, idx: number) => (
                <button
                  key={idx}
                  className="btn btn-secondary"
                  style={{ padding: 'var(--space-md)', fontSize: '1rem', textAlign: 'left' }}
                  onClick={() => handleAnswer(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* After answering - show result */
          <div style={{ flex: 1 }}>
            <div className={`text-center mb-lg`} style={{ 
              padding: 'var(--space-lg)', 
              borderRadius: 12,
              background: isCorrect ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>{isCorrect ? '✓' : '✗'}</div>
              <p className={`font-bold ${isCorrect ? 'text-success' : 'text-error'}`} style={{ fontSize: '1.2rem' }}>
                {isCorrect ? 'Correct!' : `The answer was: ${ex.correctAnswer}`}
              </p>
            </div>

            <button className="btn btn-primary btn-full" onClick={next} style={{ padding: 'var(--space-md)' }}>
              {current < exercises.length - 1 ? 'Continue' : 'See Results'}
            </button>
          </div>
        )}
      </div>

      {/* Completion Screen */}
      {completed && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 'var(--space-xl)'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)' }}>🎉</div>
          <h2 className="text-xl font-bold mb-sm">Lesson Complete!</h2>
          <p className="text-secondary mb-xl">You've mastered these words</p>
          <div className="text-accent font-bold mb-xl" style={{ fontSize: '2.5rem' }}>+{lesson.xp_reward} XP</div>
          <button className="btn btn-primary" onClick={onBack} style={{ padding: 'var(--space-md) var(--space-xl)' }}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}