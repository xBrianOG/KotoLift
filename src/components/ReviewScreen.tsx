import { useState, useEffect, useCallback, useRef } from 'react';
import { getDueReviewStates, rateReview, getMixedReviewStates } from '../services/review';
import { addStars, updateStreak } from '../services/stats';
import { ProgressBar } from './ProgressBar';
import { Stars } from './Stars';
import type { Card, ReviewState, Rating, Language, ReviewDirection } from '../types';
import { getCardSourceText, getCardTranslation } from '../types';

const DIRECTIONS: { value: ReviewDirection; label: string; from: Language; to: Language }[] = [
  { value: 'ja-en', label: 'JA→EN', from: 'ja', to: 'en' },
  { value: 'ja-es', label: 'JA→ES', from: 'ja', to: 'es' },
  { value: 'en-ja', label: 'EN→JA', from: 'en', to: 'ja' },
  { value: 'es-ja', label: 'ES→JA', from: 'es', to: 'ja' },
  { value: 'mixed', label: 'Mixed', from: 'ja', to: 'en' },
];

export const ReviewScreen: React.FC<{ onExplain?: (card: Card) => void; onNavigateHome?: ()=>void }>= ({ onExplain, onNavigateHome }) => {
  const [direction, setDirection] = useState<ReviewDirection>('ja-en');
  const [cards, setCards] = useState<Array<ReviewState & { card: Card }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState<number>(0);
  // Swipe handling refs
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const swipeCooldown = useRef(false);

  const loadCards = useCallback(async () => {
    setLoading(true);
    const dir = DIRECTIONS.find(d => d.value === direction)!;
    
    let dueCards: Array<ReviewState & { card: Card }>;
    if (direction === 'mixed') {
      dueCards = await getMixedReviewStates([
        { promptLang: 'ja', answerLang: 'en' },
        { promptLang: 'ja', answerLang: 'es' },
        { promptLang: 'en', answerLang: 'ja' },
        { promptLang: 'es', answerLang: 'ja' },
      ]);
    } else {
      dueCards = await getDueReviewStates(dir.from, dir.to);
    }
    
    setCards(dueCards);
    setCurrentIndex(0);
    setShowAnswer(false);
    setLoading(false);
  }, [direction]);

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

  // Swipe helpers
  const onTouchStart = (e: any) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const onTouchMove = (e: any) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const onTouchEnd = () => {
    if (swipeCooldown.current) return;
    const start = touchStartX.current;
    const end = (typeof touchEndX.current === 'number' ? touchEndX.current : start);
    if (start == null) return;
    const dx = (end as number) - (start as number);
    const SWIPE_THRESHOLD = 60; // px
    if (dx < -SWIPE_THRESHOLD) {
      // Swipe left => Again
      swipeCooldown.current = true;
      handleRate('again').finally(() => {
        // cooldown to avoid rapid multiple triggers
        setTimeout(() => { swipeCooldown.current = false; }, 200);
      });
    } else if (dx > SWIPE_THRESHOLD) {
      // Swipe right => Good
      swipeCooldown.current = true;
      handleRate('good').finally(() => {
        setTimeout(() => { swipeCooldown.current = false; }, 200);
      });
    }
  };

  const currentCard = cards[currentIndex];
  const dir = DIRECTIONS.find(d => d.value === direction)!;

  // End-of-lesson completion view
  if (completed) {
    const stars = Math.min(5, Math.max(1, Math.floor(score / 2) + 1));
    return (
      <div className="container flex-center animate-fade-in" style={{ minHeight: '100vh' }}>
        <div className="card text-center" style={{ width: '100%', padding: 'var(--space-2xl)' }}>
          <h2 className="text-3xl font-bold mb-xs">Nice!</h2>
          <div className="mb-md"><Stars count={stars} /></div>
          <p className="text-secondary mb-xl">You completed today's lesson.</p>
          <button className="btn btn-primary btn-full" onClick={onNavigateHome ?? (() => {})}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="empty-state animate-fade-in"><div className="empty-state-icon">⏳</div><div>Loading...</div></div>;
  }

  if (!currentCard) {
    return (
      <div className="screen animate-fade-in">
        <div className="mb-xl">
          <select 
            value={direction} 
            onChange={(e) => setDirection(e.target.value as ReviewDirection)}
          >
            {DIRECTIONS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">🎉</div>
          <p className="text-lg font-medium text-primary">No cards due for review!</p>
          <p className="text-secondary">
            Add some cards or come back later.
          </p>
        </div>
      </div>
    );
  }

  const promptText = getCardSourceText(currentCard.card) || getCardTranslation(currentCard.card, dir.from) || '';
  const answerText = getCardTranslation(currentCard.card, dir.to) || getCardSourceText(currentCard.card) || '';

  // Top area: direction selector and quick progress
  return (
    <div className="screen animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Progress bar at top of lesson */}
      {cards.length > 0 && (
        <div className="mb-md">
          <ProgressBar current={currentIndex + 1} total={cards.length} />
        </div>
      )}
      <div className="flex-between mb-xl">
        <select 
          value={direction} 
          onChange={(e) => setDirection(e.target.value as ReviewDirection)}
          style={{ width: 'auto', padding: 'var(--space-sm) var(--space-md)' }}
        >
          {DIRECTIONS.map(d => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <div className="progress">
          {cards.length - currentIndex} left today
        </div>
      </div>

      <div
        className="card card-clickable animate-slide-down"
        onClick={() => setShowAnswer(!showAnswer)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ 
          touchAction: 'pan-y', 
          display: 'flex', 
          flexDirection: 'column', 
          flex: 1,
          minHeight: 0,
          overflowY: 'hidden'
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0, gap: 'var(--space-md)' }}>
          {/* Prompt Section */}
          <div style={{ 
            flexShrink: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: showAnswer ? 'flex-end' : 'center', 
            minHeight: 0,
            flex: showAnswer ? 1 : '1 1 auto'
          }}>
            <span className="lang-badge mb-md">{dir.from}</span>
            <div style={{ overflowY: 'auto', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <p className="text-2xl font-medium text-center" style={{ lineHeight: 1.4, wordBreak: 'break-word', margin: 0 }}>
                {promptText}
              </p>
            </div>
          </div>
          
          {/* Answer Section */}
          {showAnswer && (
            <div className="animate-slide-down flex-col w-full" style={{ flexShrink: 1, flex: 1, alignItems: 'center', minHeight: 0, overflowY: 'auto' }}>
              <hr style={{ margin: '0 0 var(--space-md) 0', borderColor: 'var(--border-light)', width: '100%', flexShrink: 0 }} />
              <span className="lang-badge mb-md" style={{ flexShrink: 0 }}>{dir.to}</span>
              <p className="text-xl text-center mb-lg text-secondary" style={{ lineHeight: 1.5, wordBreak: 'break-word', width: '100%' }}>
                {answerText}
              </p>
              {currentCard.card.tags.length > 0 && (
                <div className="mb-md flex-center flex-wrap" style={{ flexShrink: 0 }}>
                  {currentCard.card.tags.map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {!showAnswer && (
            <p className="text-tertiary text-sm animate-pulse text-center mt-auto" style={{ paddingBottom: 'var(--space-md)' }}>
              Tap to reveal answer
            </p>
          )}
        </div>

        {onExplain && currentCard && showAnswer && (
          <div style={{ flexShrink: 0, width: '100%', marginTop: 'var(--space-sm)' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onExplain(currentCard.card); }}
              className="btn btn-secondary btn-full animate-fade-in"
            >
              Explain
            </button>
          </div>
        )}
      </div>

      {/* Actions container pinned to bottom */}
      {showAnswer ? (
        <div className="animate-slide-down mt-md" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', flexShrink: 0 }}>
          <button className="btn btn-danger btn-full" onClick={(e) => { e.stopPropagation(); handleRate('again'); }}>
            Again
          </button>
          <button className="btn btn-warning btn-full" onClick={(e) => { e.stopPropagation(); handleRate('good'); }}>
            Good
          </button>
          <button className="btn btn-success btn-full" onClick={(e) => { e.stopPropagation(); handleRate('easy'); }}>
            Easy
          </button>
        </div>
      ) : (
        <div style={{ minHeight: '52px', marginTop: 'var(--space-md)' }} /> /* Placeholder for buttons to prevent layout jump */
      )}
    </div>
  );
}
