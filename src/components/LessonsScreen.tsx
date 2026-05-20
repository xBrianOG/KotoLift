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
  grammar_topic: string;
  xp_reward: number;
  estimated_minutes: number;
  content: any;
  exercises: any;
}

interface LessonsScreenProps {
  onBack: () => void;
}

const LESSON_TYPES = [
  { key: 'all', label: 'All' },
  { key: 'grammar', label: 'Grammar' },
  { key: 'vocabulary', label: 'Vocabulary' },
  { key: 'reading', label: 'Reading' },
  { key: 'listening', label: 'Listening' }
];

const LEVELS = [
  { key: 'all', label: 'All Levels' },
  { key: 'B1', label: 'B1' },
  { key: 'B2', label: 'B2' }
];

export function LessonsScreen({ onBack }: LessonsScreenProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async (level?: string, type?: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (level && level !== 'all') params.append('level', level);
      if (type && type !== 'all') params.append('type', type);
      params.append('limit', '50');

      const res = await fetch(`${API_BASE}/api/lessons?${params}`, {
        headers: { ...getAuthHeaders() }
      });

      const data = await res.json();
      setLessons(data.lessons || []);
    } catch (err) {
      setError('Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons(filterLevel !== 'all' ? filterLevel : undefined, filterType !== 'all' ? filterType : undefined);
  }, [filterLevel, filterType]);

  if (selectedLesson) {
    return (
      <LessonDetail lesson={selectedLesson} onBack={() => setSelectedLesson(null)} />
    );
  }

  return (
    <div className="screen animate-fade-in" style={{ padding: 'var(--space-xl)' }}>
      <div className="mb-lg">
        <h1 className="text-2xl font-bold mb-xs">Lessons</h1>
        <p className="text-secondary text-sm">B1-B2 English lessons</p>
      </div>

      <div className="flex gap-sm mb-lg" style={{ overflowX: 'auto', paddingBottom: 'var(--space-sm)' }}>
        {LEVELS.map(lvl => (
          <button
            key={lvl.key}
            className={`chip ${filterLevel === lvl.key ? 'active' : ''}`}
            onClick={() => setFilterLevel(lvl.key)}
          >
            {lvl.label}
          </button>
        ))}
      </div>

      <div className="flex gap-sm mb-lg" style={{ overflowX: 'auto', paddingBottom: 'var(--space-sm)' }}>
        {LESSON_TYPES.map(type => (
          <button
            key={type.key}
            className={`chip ${filterType === type.key ? 'active' : ''}`}
            onClick={() => setFilterType(type.key)}
          >
            {type.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center" style={{ padding: 'var(--space-xl)' }}>
          <p>Loading lessons...</p>
        </div>
      ) : error ? (
        <div className="text-center" style={{ padding: 'var(--space-xl)' }}>
          <p className="text-error">{error}</p>
          <button className="btn btn-secondary mt-md" onClick={fetchLessons}>Retry</button>
        </div>
      ) : lessons.length === 0 ? (
        <div className="text-center" style={{ padding: 'var(--space-xl)' }}>
          <p className="text-secondary">No lessons found</p>
          <p className="text-secondary text-sm mt-sm">Content coming soon!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          {lessons.map(lesson => (
            <div
              key={lesson.id}
              className="card card-clickable"
              onClick={() => setSelectedLesson(lesson)}
            >
              <div className="flex-between">
                <div style={{ flex: 1 }}>
                  <div className="flex gap-sm mb-xs">
                    <span className="chip">{lesson.level}</span>
                    <span className="chip chip--secondary">{lesson.type}</span>
                  </div>
                  <h3 className="font-semibold mb-xs">{lesson.title}</h3>
                  <p className="text-secondary text-sm">{lesson.description}</p>
                  {lesson.grammar_topic && (
                    <p className="text-secondary text-sm mt-xs">Grammar: {lesson.grammar_topic}</p>
                  )}
                </div>
                <div className="text-center" style={{ minWidth: 60 }}>
                  <div className="text-lg font-bold text-accent">+{lesson.xp_reward}</div>
                  <div className="text-xs text-secondary">{lesson.estimated_minutes} min</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface LessonDetailProps {
  lesson: Lesson;
  onBack: () => void;
}

function LessonDetail({ lesson, onBack }: LessonDetailProps) {
  const [completed, setCompleted] = useState(false);

  return (
    <div className="screen animate-fade-in" style={{ padding: 'var(--space-xl)' }}>
      <div className="flex-between mb-lg">
        <button onClick={onBack} className="btn btn-secondary">
          Back
        </button>
        <div className="text-center">
          <span className="chip">{lesson.level}</span>
          <span className="chip chip--secondary ml-sm">{lesson.type}</span>
        </div>
      </div>

      <div className="mb-lg">
        <h1 className="text-2xl font-bold mb-sm">{lesson.title}</h1>
        <p className="text-secondary">{lesson.description}</p>
      </div>

      {lesson.grammar_topic && (
        <div className="card mb-lg">
          <h2 className="font-semibold mb-sm">Grammar Focus</h2>
          <p className="text-secondary">{lesson.grammar_topic}</p>
        </div>
      )}

      <div className="card mb-lg" style={{ background: 'var(--bg-elevated)' }}>
        <h2 className="font-semibold mb-md">Lesson Content</h2>
        <div className="text-secondary" style={{ lineHeight: 1.8 }}>
          {lesson.content ? (
            typeof lesson.content === 'string' ? (
              <p>{lesson.content}</p>
            ) : (
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                {JSON.stringify(lesson.content, null, 2)}
              </pre>
            )
          ) : (
            <p>Content coming soon!</p>
          )}
        </div>
      </div>

      {lesson.exercises && (
        <div className="card mb-lg">
          <h2 className="font-semibold mb-md">Exercises</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 'var(--font-sm)' }}>
            {JSON.stringify(lesson.exercises, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex-between card mb-lg">
        <div>
          <div className="text-secondary text-sm">XP Reward</div>
          <div className="font-bold text-accent">+{lesson.xp_reward} XP</div>
        </div>
        <div>
          <div className="text-secondary text-sm">Duration</div>
          <div className="font-bold">{lesson.estimated_minutes} min</div>
        </div>
      </div>

      <button
        className="btn btn-primary btn-full"
        onClick={() => setCompleted(true)}
        disabled={completed}
      >
        {completed ? 'Completed!' : 'Mark as Complete'}
      </button>
    </div>
  );
}