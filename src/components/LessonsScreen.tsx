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

interface LessonContent {
  type?: string;
  vocabulary?: Array<{ id: string; word: string; partOfSpeech: string; example: string }>;
  exercises?: Array<{
    id: string;
    type: string;
    question?: string;
    sentence?: string;
    correctAnswer: string;
    options?: Array<{ word: string; partOfSpeech?: string }>;
    pairs?: Array<{ word: string; partOfSpeech: string }>;
  }>;
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
  const isCorrect = selectedAnswer === exercise?.correctAnswer;

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

  return (
    <div className="screen animate-fade-in" style={{ padding: 'var(--space-xl)' }}>
      <div className="flex-between mb-lg">
        <button onClick={onBack} className="btn btn-secondary">Back</button>
        <div className="text-center">
          <span className="chip">{lesson.level}</span>
          <span className="chip chip--secondary ml-sm">{lesson.type}</span>
        </div>
      </div>

      <div className="mb-lg">
        <h1 className="text-2xl font-bold mb-sm">{lesson.title}</h1>
        <p className="text-secondary">{lesson.description}</p>
        <p className="text-sm text-secondary mt-sm">Exercise {currentExercise + 1} of {exercises.length}</p>
      </div>

      {content?.vocabulary && currentExercise === 0 && (
        <div className="card mb-lg" style={{ background: 'var(--bg-elevated)' }}>
          <h2 className="font-semibold mb-md">Vocabulary</h2>
          <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
            {content.vocabulary.map((word, idx) => (
              <div key={idx} className="flex-between" style={{ padding: 'var(--space-sm)', background: 'var(--bg-primary)', borderRadius: 8 }}>
                <div>
                  <span className="font-semibold">{word.word}</span>
                  <span className="text-secondary text-sm ml-sm">({word.partOfSpeech})</span>
                  {word.example && <p className="text-secondary text-sm mt-xs">"{word.example}"</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {exercise && (
        <div className="card mb-lg">
          <h2 className="font-semibold mb-md">
            {exercise.type === 'multiple_choice' ? 'Multiple Choice' : 
             exercise.type === 'fill_blank' ? 'Fill in the Blank' : 'Match Pairs'}
          </h2>
          
          {exercise.type === 'multiple_choice' && (
            <div>
              <p className="mb-md font-medium">{exercise.question}</p>
              <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                {exercise.options?.map((opt, idx) => {
                  const isSelected = selectedAnswer === opt.word;
                  const isExerciseCorrect = opt.word === exercise.correctAnswer;
                  let btnStyle = {};
                  if (showResult) {
                    if (isExerciseCorrect) btnStyle = { background: 'var(--success)', color: 'white' };
                    else if (isSelected && !isExerciseCorrect) btnStyle = { background: 'var(--error)', color: 'white' };
                  }
                  return (
                    <button
                      key={idx}
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ ...btnStyle, textAlign: 'left' }}
                      onClick={() => !showResult && handleAnswer(opt.word)}
                      disabled={showResult}
                    >
                      {opt.word} <span className="text-secondary">({opt.partOfSpeech})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {exercise.type === 'fill_blank' && (
            <div>
              <p className="mb-md font-medium">{exercise.sentence}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
                {exercise.options?.map((opt, idx) => {
                  const isSelected = selectedAnswer === opt;
                  const isExerciseCorrect = opt === exercise.correctAnswer;
                  let btnStyle = {};
                  if (showResult) {
                    if (isExerciseCorrect) btnStyle = { background: 'var(--success)', color: 'white' };
                    else if (isSelected && !isExerciseCorrect) btnStyle = { background: 'var(--error)', color: 'white' };
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
            </div>
          )}

          {exercise.type === 'match' && (
            <div>
              <p className="mb-md text-secondary">Match the words with their parts of speech:</p>
              <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                {exercise.pairs?.map((pair, idx) => (
                  <div key={idx} className="flex-between" style={{ padding: 'var(--space-sm)', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                    <span className="font-semibold">{pair.word}</span>
                    <span className="chip chip--secondary">{pair.partOfSpeech}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showResult && (
            <div className="mt-lg">
              <div className={`card ${isCorrect ? '' : ''}`} style={{ background: isCorrect ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)', padding: 'var(--space-md)' }}>
                <p className={`font-semibold ${isCorrect ? 'text-success' : 'text-error'}`}>
                  {isCorrect ? '✓ Correct!' : `✗ The answer is: ${exercise.correctAnswer}`}
                </p>
              </div>
              <button className="btn btn-primary btn-full mt-md" onClick={nextExercise}>
                {currentExercise < exercises.length - 1 ? 'Next Exercise' : 'Complete Lesson'}
              </button>
            </div>
          )}
        </div>
      )}

      {!completed && !exercise && (
        <button
          className="btn btn-primary btn-full"
          onClick={() => setCompleted(true)}
        >
          Start Lesson
        </button>
      )}

      {completed && (
        <div className="card text-center" style={{ background: 'var(--bg-elevated)', padding: 'var(--space-xl)' }}>
          <h2 className="text-xl font-bold text-success mb-sm">Lesson Complete!</h2>
          <p className="text-secondary mb-md">You've completed this lesson</p>
          <div className="font-bold text-accent text-lg mb-md">+{lesson.xp_reward} XP</div>
          <button className="btn btn-primary" onClick={onBack}>Back to Lessons</button>
        </div>
      )}
    </div>
  );
}