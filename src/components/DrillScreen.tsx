import { useState, useEffect, useCallback } from 'react';
import { getAllCards } from '../services/cards';
import type { Card, Language } from '../types';

export function DrillScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [direction, setDirection] = useState<'random' | 'ja-en' | 'ja-es' | 'en-ja' | 'es-ja'>('random');

  const loadCards = useCallback(async () => {
    const allCards = await getAllCards();
    setCards(allCards.sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setShowAnswer(false);
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleResult = async (_gotIt: boolean) => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
    } else {
      loadCards();
    }
  };

  const currentCard = cards[currentIndex];

  if (cards.length === 0) {
    return (
      <div className="empty-state">
        <p>No cards to drill!</p>
        <p style={{ marginTop: 8, fontSize: '0.875rem' }}>
          Add some cards first.
        </p>
      </div>
    );
  }

  let fromLang: Language, toLang: Language;
  
  if (direction === 'random') {
    const langs: Language[] = ['ja', 'en', 'es'];
    // Pick a random source language from the available options
    fromLang = langs[Math.floor(Math.random() * langs.length)];
    // Pick a random target language that is not the same as the source
    const others = langs.filter(l => l !== fromLang);
    toLang = others[Math.floor(Math.random() * others.length)];
  } else {
    const parts = direction.split('-') as [Language, Language];
    [fromLang, toLang] = parts;
  }

  const promptText = currentCard[`${fromLang}Text` as keyof Card] as string;
  const answerText = currentCard[`${toLang}Text` as keyof Card] as string;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <select 
          value={direction} 
          onChange={(e) => setDirection(e.target.value as typeof direction)}
          style={{ width: '100%' }}
        >
          <option value="random">Random</option>
          <option value="ja-en">JA→EN</option>
          <option value="ja-es">JA→ES</option>
          <option value="en-ja">EN→JA</option>
          <option value="es-ja">ES→JA</option>
        </select>
        <div className="progress" style={{ marginTop: 12 }}>
          {currentIndex + 1} / {cards.length}
        </div>
      </div>

      <div className="card" onClick={() => setShowAnswer(!showAnswer)}>
        <span className="lang-badge">{fromLang}</span>
        <p style={{ fontSize: '1.5rem', marginTop: 16, textAlign: 'center' }}>
          {promptText}
        </p>
        
        {showAnswer && (
          <>
            <hr style={{ margin: '24px 0', borderColor: 'var(--border)' }} />
            <span className="lang-badge">{toLang}</span>
            <p style={{ fontSize: '1.5rem', marginTop: 16, textAlign: 'center' }}>
              {answerText}
            </p>
          </>
        )}
        
        {!showAnswer && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 24 }}>
            Tap to reveal
          </p>
        )}
      </div>

      {showAnswer && (
        <div className="btn-group">
          <button className="btn btn-danger" onClick={() => handleResult(false)}>
            Missed it
          </button>
          <button className="btn btn-success" onClick={() => handleResult(true)}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
