import { useState, useEffect, useCallback, useRef } from 'react';
import { getDueReviewStates, rateReview, getMixedReviewStates, getPracticeReviewStates, getMixedPracticeReviewStates } from '../services/review';
import { addStars, updateStreak } from '../services/stats';
import { Stars } from './Stars';
import type { Card, ReviewState, Rating, Language, ReviewDirection } from '../types';
import { getCardSourceText, getCardTranslation } from '../types';
import { X, ChevronDown, RotateCcw, Check, Zap } from 'lucide-react';

const DIRECTIONS: { value: ReviewDirection; label: string; from: Language; to: Language }[] = [
  { value: 'ja-en', label: 'JA → EN', from: 'ja', to: 'en' },
  { value: 'ja-es', label: 'JA → ES', from: 'ja', to: 'es' },
  { value: 'en-ja', label: 'EN → JA', from: 'en', to: 'ja' },
  { value: 'es-ja', label: 'ES → JA', from: 'es', to: 'ja' },
  { value: 'mixed', label: 'Mixed', from: 'ja', to: 'en' },
];

export const ReviewScreen: React.FC<{ onExplain?: (card: Card) => void; onNavigateHome?: ()=>void }>= ({ onExplain, onNavigateHome }) => {
  const [direction, setDirection] = useState<ReviewDirection>((localStorage.getItem('review.direction') as ReviewDirection) || 'ja-en');
  const [practiceMode, setPracticeMode] = useState(false);
  const [cards, setCards] = useState<Array<ReviewState & { card: Card }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState<number>(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const swipeCooldown = useRef(false);

  const loadCards = useCallback(async () => {
    setLoading(true);
    const dir = DIRECTIONS.find(d => d.value === direction)!;
    
    let dueCards: Array<ReviewState & { card: Card }>;
    if (direction === 'mixed') {
      dueCards = practiceMode
        ? await getMixedPracticeReviewStates([
            { promptLang: 'ja', answerLang: 'en' },
            { promptLang: 'ja', answerLang: 'es' },
            { promptLang: 'en', answerLang: 'ja' },
            { promptLang: 'es', answerLang: 'ja' },
          ])
        : await getMixedReviewStates([
            { promptLang: 'ja', answerLang: 'en' },
            { promptLang: 'ja', answerLang: 'es' },
            { promptLang: 'en', answerLang: 'ja' },
            { promptLang: 'es', answerLang: 'ja' },
          ]);
    } else {
      dueCards = practiceMode
        ? await getPracticeReviewStates(dir.from, dir.to)
        : await getDueReviewStates(dir.from, dir.to);
    }
    
    setCards(dueCards);
    setCurrentIndex(0);
    setShowAnswer(false);
    setLoading(false);
  }, [direction, practiceMode]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleRate = async (rating: Rating) => {
    const current = cards[currentIndex];
    if (!current) return;

    await rateReview(rating, current);
    setShowAnswer(false);
    const delta = rating === 'easy' ? 2 : rating === 'good' ? 1 : 0;
    const newScore = score + delta;
    setScore(newScore);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      await updateStreak();
      const starsEarned = Math.floor(newScore / 2);
      await addStars(starsEarned);
      setCompleted(true);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const onTouchEnd = () => {
    if (swipeCooldown.current) return;
    const start = touchStartX.current;
    const end = (typeof touchEndX.current === 'number' ? touchEndX.current : start);
    if (start == null) return;
    const dx = (end as number) - (start as number);
    const SWIPE_THRESHOLD = 60;
    if (dx < -SWIPE_THRESHOLD) {
      swipeCooldown.current = true;
      handleRate('again').finally(() => {
        setTimeout(() => { swipeCooldown.current = false; }, 200);
      });
    } else if (dx > SWIPE_THRESHOLD) {
      swipeCooldown.current = true;
      handleRate('good').finally(() => {
        setTimeout(() => { swipeCooldown.current = false; }, 200);
      });
    }
  };

  const currentCard = cards[currentIndex];
  const dir = DIRECTIONS.find(d => d.value === direction)!;

  // Completion screen
  if (completed) {
    const stars = Math.min(5, Math.max(1, Math.floor(score / 2) + 1));
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200
      }}>
        <div style={{ 
          textAlign: 'center', 
          padding: 'var(--space-xl)',
          maxWidth: 360
        }}>
          <h2 style={{ 
            fontSize: 'var(--font-2xl)', 
            fontWeight: 600, 
            marginBottom: 'var(--space-md)',
            color: 'var(--text)'
          }}>
            Session Complete
          </h2>
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <Stars count={stars} />
          </div>
          <p style={{ 
            color: 'var(--text-secondary)', 
            marginBottom: 'var(--space-xl)',
            fontSize: 'var(--font-sm)'
          }}>
            {practiceMode ? 'Great practice session!' : 'You reviewed all due cards.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <button 
              className="btn btn-primary btn-lg btn-full" 
              onClick={() => { 
                setCompleted(false); 
                setCurrentIndex(0); 
                setShowAnswer(false); 
                setScore(0); 
                loadCards(); 
              }}
            >
              Continue Learning
            </button>
            <button 
              className="btn btn-secondary btn-lg btn-full" 
              onClick={onNavigateHome ?? (() => {})}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200
      }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  // No cards state
  if (!currentCard) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 200
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-lg)',
          borderBottom: '1px solid var(--border)'
        }}>
          <button 
            className="btn btn-subtle"
            onClick={onNavigateHome ?? (() => {})}
          >
            <X size={20} />
          </button>
          <select 
            value={direction} 
            onChange={(e) => { 
              const val = e.target.value as ReviewDirection; 
              setDirection(val); 
              localStorage.setItem('review.direction', val); 
            }}
            style={{ 
              padding: 'var(--space-sm) var(--space-md)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              fontSize: 'var(--font-sm)'
            }}
          >
            {DIRECTIONS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Empty state */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-xl)'
        }}>
          <div style={{ textAlign: 'center', maxWidth: 280 }}>
            <p style={{ 
              fontSize: 'var(--font-lg)', 
              fontWeight: 500, 
              color: 'var(--text)',
              marginBottom: 'var(--space-sm)'
            }}>
              All caught up!
            </p>
            <p style={{ 
              color: 'var(--text-tertiary)', 
              fontSize: 'var(--font-sm)',
              marginBottom: 'var(--space-lg)'
            }}>
              No cards due for review right now.
            </p>
            <button
              className="btn btn-secondary"
              onClick={() => setPracticeMode(true)}
            >
              Practice Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  const promptText = getCardSourceText(currentCard.card) || getCardTranslation(currentCard.card, dir.from) || '';
  const answerText = getCardTranslation(currentCard.card, dir.to) || getCardSourceText(currentCard.card) || '';
  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 200
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-md) var(--space-lg)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)'
      }}>
        <button 
          className="btn btn-subtle"
          onClick={onNavigateHome ?? (() => {})}
          style={{ padding: 'var(--space-sm)' }}
        >
          <X size={20} />
        </button>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 'var(--space-md)' 
        }}>
          <span style={{ 
            fontSize: 'var(--font-sm)', 
            color: 'var(--text-secondary)' 
          }}>
            {currentIndex + 1} / {cards.length}
          </span>
          
          <select 
            value={direction} 
            onChange={(e) => { 
              const val = e.target.value as ReviewDirection; 
              setDirection(val); 
              localStorage.setItem('review.direction', val); 
            }}
            style={{ 
              padding: 'var(--space-xs) var(--space-sm)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
              fontSize: 'var(--font-xs)',
              color: 'var(--text-secondary)'
            }}
          >
            {DIRECTIONS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>

          <button
            className={`btn ${practiceMode ? 'btn-accent' : 'btn-subtle'}`}
            onClick={() => setPracticeMode(p => !p)}
            style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--font-xs)' }}
          >
            Practice
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ 
        height: 2, 
        background: 'var(--border)',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${progress}%`,
          background: 'var(--accent)',
          transition: 'width 0.3s ease'
        }} />
      </div>

      {/* Card area */}
      <div
        onClick={() => setShowAnswer(!showAnswer)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-xl)',
          cursor: 'pointer',
          touchAction: 'pan-y',
          overflow: 'hidden'
        }}
      >
        <div style={{ 
          maxWidth: 480, 
          width: '100%',
          textAlign: 'center'
        }}>
          {/* Prompt */}
          <div style={{ marginBottom: showAnswer ? 'var(--space-xl)' : 0 }}>
            <span className="lang-badge" style={{ marginBottom: 'var(--space-md)', display: 'inline-block' }}>
              {dir.from.toUpperCase()}
            </span>
            <p style={{
              fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
              fontWeight: 500,
              color: 'var(--text)',
              lineHeight: 1.3,
              wordBreak: 'break-word'
            }}>
              {promptText}
            </p>
          </div>

          {/* Answer */}
          {showAnswer && (
            <div className="animate-fade-in" style={{ 
              paddingTop: 'var(--space-xl)',
              borderTop: '1px solid var(--border)'
            }}>
              <span className="lang-badge" style={{ marginBottom: 'var(--space-md)', display: 'inline-block' }}>
                {dir.to.toUpperCase()}
              </span>
              <p style={{
                fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
                wordBreak: 'break-word'
              }}>
                {answerText}
              </p>

              {currentCard.card.tags.length > 0 && (
                <div style={{ 
                  marginTop: 'var(--space-lg)',
                  display: 'flex',
                  gap: 'var(--space-xs)',
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  {currentCard.card.tags.map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              )}

              {onExplain && (
                <button
                  onClick={(e) => { e.stopPropagation(); onExplain(currentCard.card); }}
                  className="btn btn-subtle"
                  style={{ marginTop: 'var(--space-lg)' }}
                >
                  Explain
                </button>
              )}
            </div>
          )}

          {!showAnswer && (
            <p style={{ 
              marginTop: 'var(--space-xl)',
              color: 'var(--text-tertiary)',
              fontSize: 'var(--font-sm)'
            }}>
              Tap to reveal
            </p>
          )}
        </div>
      </div>

      {/* Rating buttons */}
      {showAnswer && (
        <div 
          className="animate-fade-in"
          style={{ 
            padding: 'var(--space-lg)',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)'
          }}
        >
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: 'var(--space-sm)',
            maxWidth: 400,
            margin: '0 auto'
          }}>
            <button 
              className="btn btn-danger btn-lg" 
              onClick={(e) => { e.stopPropagation(); handleRate('again'); }}
            >
              <RotateCcw size={18} />
              Again
            </button>
            <button 
              className="btn btn-warning btn-lg" 
              onClick={(e) => { e.stopPropagation(); handleRate('good'); }}
            >
              <Check size={18} />
              Good
            </button>
            <button 
              className="btn btn-success btn-lg" 
              onClick={(e) => { e.stopPropagation(); handleRate('easy'); }}
            >
              <Zap size={18} />
              Easy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
