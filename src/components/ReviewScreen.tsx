import { useState, useEffect, useCallback } from 'react';
import { getDueReviewStates, rateReview, getMixedReviewStates } from '../services/review';
import type { Card, ReviewState, Rating, Language, ReviewDirection } from '../types';

const DIRECTIONS: { value: ReviewDirection; label: string; from: Language; to: Language }[] = [
  { value: 'ja-en', label: 'JA→EN', from: 'ja', to: 'en' },
  { value: 'ja-es', label: 'JA→ES', from: 'ja', to: 'es' },
  { value: 'en-ja', label: 'EN→JA', from: 'en', to: 'ja' },
  { value: 'es-ja', label: 'ES→JA', from: 'es', to: 'ja' },
  { value: 'mixed', label: 'Mixed', from: 'ja', to: 'en' },
];

export function ReviewScreen() {
  const [direction, setDirection] = useState<ReviewDirection>('ja-en');
  const [cards, setCards] = useState<Array<ReviewState & { card: Card }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);

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
    
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      loadCards();
    }
  };

  const currentCard = cards[currentIndex];
  const dir = DIRECTIONS.find(d => d.value === direction)!;

  if (loading) {
    return <div className="empty-state">Loading...</div>;
  }

  if (!currentCard) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <select 
            value={direction} 
            onChange={(e) => setDirection(e.target.value as ReviewDirection)}
            style={{ width: '100%', marginBottom: 16 }}
          >
            {DIRECTIONS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="empty-state">
          <p>No cards due for review!</p>
          <p style={{ marginTop: 8, fontSize: '0.875rem' }}>
            Add some cards or come back later.
          </p>
        </div>
      </div>
    );
  }

  const promptText = currentCard.card[`${dir.from}Text` as keyof Card] as string;
  const answerText = currentCard.card[`${dir.to}Text` as keyof Card] as string;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <select 
          value={direction} 
          onChange={(e) => setDirection(e.target.value as ReviewDirection)}
          style={{ width: '100%', marginBottom: 16 }}
        >
          {DIRECTIONS.map(d => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <div className="progress">
          {currentIndex + 1} / {cards.length}
        </div>
      </div>

      <div className="card" onClick={() => setShowAnswer(!showAnswer)}>
        <span className="lang-badge">{dir.from}</span>
        <p style={{ fontSize: '1.5rem', marginTop: 16, textAlign: 'center' }}>
          {promptText}
        </p>
        
        {showAnswer && (
          <>
            <hr style={{ margin: '24px 0', borderColor: 'var(--border)' }} />
            <span className="lang-badge">{dir.to}</span>
            <p style={{ fontSize: '1.5rem', marginTop: 16, textAlign: 'center' }}>
              {answerText}
            </p>
            {currentCard.card.tags.length > 0 && (
              <div style={{ marginTop: 16 }}>
                {currentCard.card.tags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            )}
          </>
        )}
        
        {!showAnswer && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 24 }}>
            Tap to reveal answer
          </p>
        )}
      </div>

      {showAnswer && (
        <div className="btn-group">
          <button className="btn btn-danger" onClick={() => handleRate('again')}>
            Again
          </button>
          <button className="btn btn-warning" onClick={() => handleRate('good')}>
            Good
          </button>
          <button className="btn btn-success" onClick={() => handleRate('easy')}>
            Easy
          </button>
        </div>
      )}
    </div>
  );
}
