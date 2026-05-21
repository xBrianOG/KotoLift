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

interface LessonContent {
  type?: string;
  words?: Array<{ id: string; word: string; partOfSpeech: string; definition: string }>;
  exercises?: Array<any>;
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
  const [currentExercise, setCurrentExercise] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const content: LessonContent = typeof lesson.content === 'string' 
    ? JSON.parse(lesson.content) 
    : lesson.content;

  const exercises = content?.exercises || [];
  const exercise = exercises[currentExercise];
  const isCorrect = selectedAnswer === exercise?.correctAnswer || 
    (exercise?.correctAnswer === "true" && selectedAnswer === "true") ||
    (exercise?.correctAnswer === "false" && selectedAnswer === "false");

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer);
    setShowResult(true);
  };

  const nextExercise = () => {
    if (currentExercise < exercises.length - 1) {
      setCurrentExercise(c => c + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setCompleted(true);
    }
  };

  if (!exercises || exercises.length === 0) {
    return (
      <div className="screen animate-fade-in" style={{ padding: 'var(--space-xl)' }}>
        <div className="flex-between mb-lg">
          <button onClick={onBack} className="btn btn-secondary">Back</button>
          <span className="chip">{lesson.level}</span>
        </div>
        <h1 className="text-2xl font-bold mb-sm">{lesson.title}</h1>
        <p className="text-secondary mb-lg">{lesson.description}</p>
        <p>No exercises available yet.</p>
      </div>
    );
  }

  const getExerciseTypeLabel = (type: string) => {
    switch(type) {
      case 'multiple_choice_meaning': return 'What does it mean?';
      case 'multiple_choice_word': return 'Which word?';
      case 'fill_blank': return 'Complete the sentence';
      case 'true_false': return 'True or False';
      default: return 'Exercise';
    }
  };

  return (
    <div className="screen animate-fade-in" style={{ padding: 'var(--space-xl)' }}>
      {/* Header */}
      <div className="flex-between mb-lg">
        <button onClick={onBack} className="btn btn-secondary">✕</button>
        <div className="flex gap-sm">
          <span className="chip">{lesson.level}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: 'var(--bg-secondary)', height: 8, borderRadius: 4, marginBottom: 'var(--space-lg)' }}>
        <div 
          style={{ 
            background: 'var(--success)', 
            height: '100%', 
            borderRadius: 4,
            width: `${((currentExercise + 1) / exercises.length) * 100}%`,
            transition: 'width 0.3s ease'
          }} 
        />
      </div>

      <p className="text-sm text-secondary mb-lg">{currentExercise + 1} / {exercises.length}</p>

      {exercise && (
        <div className="card mb-lg" style={{ padding: 'var(--space-xl)' }}>
          {/* Word highlight for context */}
          {exercise.word && (
            <div className="text-center mb-lg">
              <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>{exercise.word}</span>
              <p className="text-secondary text-sm">
                {content?.words?.find(w => w.word === exercise.word)?.definition || ''}
              </p>
            </div>
          )}

          <h2 className="font-semibold mb-md text-center">
            {exercise.question || getExerciseTypeLabel(exercise.type)}
          </h2>

          {/* Sentence for fill_blank */}
          {exercise.sentence && (
            <p className="mb-lg text-lg font-medium text-center" style={{ fontStyle: 'italic' }}>
              {exercise.sentence}
            </p>
          )}

          {/* Multiple choice - meaning */}
          {exercise.type === 'multiple_choice_meaning' && (
            <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
              {exercise.options?.map((opt: string, idx: number) => {
                const isSelected = selectedAnswer === opt;
                const isExerciseCorrect = opt === exercise.correctAnswer;
                let btnStyle: any = { padding: 'var(--space-md)', fontSize: '1rem' };
                if (showResult) {
                  if (isExerciseCorrect) btnStyle.background = 'var(--success)';
                  else if (isSelected && !isExerciseCorrect) btnStyle.background = 'var(--error)';
                }
                return (
                  <button
                    key={idx}
                    className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    style={btnStyle}
                    onClick={() => !showResult && handleAnswer(opt)}
                    disabled={showResult}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Multiple choice - word */}
          {exercise.type === 'multiple_choice_word' && (
            <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
              {exercise.options?.map((opt: string, idx: number) => {
                const isSelected = selectedAnswer === opt;
                const isExerciseCorrect = opt === exercise.correctAnswer;
                let btnStyle: any = { padding: 'var(--space-md)', fontSize: '1.1rem', fontWeight: 'bold' };
                if (showResult) {
                  if (isExerciseCorrect) btnStyle.background = 'var(--success)';
                  else if (isSelected && !isExerciseCorrect) btnStyle.background = 'var(--error)';
                }
                return (
                  <button
                    key={idx}
                    className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    style={btnStyle}
                    onClick={() => !showResult && handleAnswer(opt)}
                    disabled={showResult}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Fill in the blank */}
          {exercise.type === 'fill_blank' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
              {exercise.options?.map((opt: string, idx: number) => {
                const isSelected = selectedAnswer === opt;
                const isExerciseCorrect = opt === exercise.correctAnswer;
                let btnStyle: any = { padding: 'var(--space-md)', fontSize: '1.1rem' };
                if (showResult) {
                  if (isExerciseCorrect) btnStyle.background = 'var(--success)';
                  else if (isSelected && !isExerciseCorrect) btnStyle.background = 'var(--error)';
                }
                return (
                  <button
                    key={idx}
                    className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    style={btnStyle}
                    onClick={() => !showResult && handleAnswer(opt)}
                    disabled={showResult}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* True/False */}
          {exercise.type === 'true_false' && (
            <div>
              {exercise.sentence && (
                <p className="mb-lg text-lg font-medium text-center" style={{ fontStyle: 'italic' }}>
                  {exercise.sentence}
                </p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <button
                  className={`btn ${selectedAnswer === 'true' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: 'var(--space-lg)', fontSize: '1.2rem' }}
                  onClick={() => !showResult && handleAnswer('true')}
                  disabled={showResult}
                >
                  ✓ True
                </button>
                <button
                  className={`btn ${selectedAnswer === 'false' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: 'var(--space-lg)', fontSize: '1.2rem' }}
                  onClick={() => !showResult && handleAnswer('false')}
                  disabled={showResult}
                >
                  ✗ False
                </button>
              </div>
            </div>
          )}

          {/* Result feedback */}
          {showResult && (
            <div className="mt-lg">
              <div 
                style={{ 
                  padding: 'var(--space-md)', 
                  borderRadius: 8,
                  background: isCorrect ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                  textAlign: 'center'
                }}
              >
                <p className={`font-bold ${isCorrect ? 'text-success' : 'text-error'}`} style={{ fontSize: '1.2rem' }}>
                  {isCorrect ? '✓ Correct!' : `✗ Wrong. The answer is: ${exercise.correctAnswer}`}
                </p>
              </div>
              <button 
                className="btn btn-primary btn-full mt-md" 
                onClick={nextExercise}
                style={{ padding: 'var(--space-md)' }}
              >
                {currentExercise < exercises.length - 1 ? 'Continue' : 'Finish Lesson'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Completion screen */}
      {completed && (
        <div 
          className="card text-center" 
          style={{ 
            background: 'var(--bg-elevated)', 
            padding: 'var(--space-xl)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)' }}>🎉</div>
          <h2 className="text-xl font-bold mb-sm">Lesson Complete!</h2>
          <p className="text-secondary mb-lg">You've finished all exercises</p>
          <div className="font-bold text-accent text-lg mb-xl" style={{ fontSize: '2rem' }}>
            +{lesson.xp_reward} XP
          </div>
          <button className="btn btn-primary" onClick={onBack} style={{ padding: 'var(--space-md) var(--space-xl)' }}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}