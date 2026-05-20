import { useState, useEffect } from 'react';
import { getAuthHeaders } from '../services/auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://kotolift.onrender.com';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  level: string;
  explanation?: string;
}

interface QuizResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  suggestedLevel: string;
  b1Score: { correct: number; total: number };
  b2Score: { correct: number; total: number };
}

interface AssessmentScreenProps {
  onBack: () => void;
  onComplete?: (level: string) => void;
}

export function AssessmentScreen({ onBack, onComplete }: AssessmentScreenProps) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/assessment/quiz`, {
      headers: { ...getAuthHeaders() }
    })
      .then(res => res.json())
      .then(data => {
        setQuestions(data.questions || []);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load quiz');
        setLoading(false);
      });
  }, []);

  const handleSelect = (questionId: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      setError('Please answer all questions');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formattedAnswers = questions.map(q => ({
        questionId: q.id,
        answer: answers[q.id]
      }));

      const res = await fetch(`${API_BASE}/api/assessment/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ answers: formattedAnswers })
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError('Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="screen animate-fade-in" style={{ padding: 'var(--space-xl)' }}>
        <div className="text-center mb-xl">
          <h1 className="text-2xl font-bold mb-sm">Assessment Complete!</h1>
          <div className="text-5xl font-bold text-primary mb-sm">{result.percentage}%</div>
          <p className="text-secondary">You got {result.score} out of {result.totalQuestions} correct</p>
        </div>

        <div className="card mb-lg" style={{ textAlign: 'center' }}>
          <div className="text-lg font-semibold mb-sm">Suggested Level</div>
          <div className="text-3xl font-bold text-accent">{result.suggestedLevel}</div>
        </div>

        <div style={{ display: 'grid', gap: 'var(--space-md)' }} className="mb-xl">
          <div className="card">
            <div className="text-secondary text-sm mb-xs">B1 Questions</div>
            <div className="text-xl font-semibold">{result.b1Score.correct}/{result.b1Score.total}</div>
          </div>
          <div className="card">
            <div className="text-secondary text-sm mb-xs">B2 Questions</div>
            <div className="text-xl font-semibold">{result.b2Score.correct}/{result.b2Score.total}</div>
          </div>
        </div>

        <button className="btn btn-primary btn-full" onClick={onBack}>
          Done
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p>Loading quiz...</p>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  return (
    <div className="screen animate-fade-in" style={{ padding: 'var(--space-xl)' }}>
      <div className="mb-lg">
        <div className="flex-between mb-sm">
          <span className="text-secondary text-sm">Question {currentIndex + 1} of {questions.length}</span>
          <span className="chip">{currentQuestion?.level}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="card mb-lg">
        <p className="text-lg mb-xl" style={{ lineHeight: 1.6 }}>{currentQuestion?.question}</p>

        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          {currentQuestion?.options.map((option, idx) => (
            <button
              key={idx}
              className={`card card-clickable ${selectedAnswer === option ? 'selected' : ''}`}
              onClick={() => handleSelect(currentQuestion.id, option)}
              style={{ 
                textAlign: 'left', 
                padding: 'var(--space-md)',
                border: selectedAnswer === option ? '2px solid var(--accent)' : '2px solid transparent'
              }}
            >
              <span className="font-semibold" style={{ marginRight: 'var(--space-sm)', opacity: 0.6 }}>
                {String.fromCharCode(65 + idx)}.
              </span>
              {option}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-error mb-md">{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        <button 
          className="btn btn-secondary" 
          onClick={handlePrev}
          disabled={currentIndex === 0}
        >
          Previous
        </button>
        {currentIndex === questions.length - 1 ? (
          <button 
            className="btn btn-primary" 
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        ) : (
          <button 
            className="btn btn-secondary" 
            onClick={handleNext}
            disabled={!selectedAnswer}
          >
            Next
          </button>
        )}
      </div>

      <div className="mt-lg" style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {questions.map((_, idx) => (
          <div
            key={idx}
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: answers[questions[idx].id] 
                ? 'var(--accent)' 
                : idx === currentIndex 
                  ? 'var(--text-secondary)' 
                  : 'var(--border-light)',
              border: idx === currentIndex ? '2px solid var(--text)' : 'none'
            }}
          />
        ))}
      </div>
    </div>
  );
}