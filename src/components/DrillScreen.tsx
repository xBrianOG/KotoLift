import { useState, useEffect, useCallback } from 'react';
import { getAllCards } from '../services/cards';
import { getFrontBack } from '../services/learningDirection';
import type { Card } from '../types';
import { AudioControls } from './AudioControls';

type DrillScreenProps = {
  cards?: Card[];
};

export function DrillScreen({ cards: initialCards }: DrillScreenProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const loadCards = useCallback(async () => {
    // Use provided cards or fetch from server
    if (initialCards && initialCards.length > 0) {
      setCards(initialCards.sort(() => Math.random() - 0.5));
    } else {
      const allCards = await getAllCards();
      setCards(allCards.sort(() => Math.random() - 0.5));
    }
    setCurrentIndex(0);
    setShowAnswer(false);
  }, [initialCards]);

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

  const { front, back, backLang, frontLang, jaContent, enContent, esContent } = getFrontBack(currentCard);
  const langMap: Record<string, string> = {
    'en': 'en',
    'ja': 'ja',
    'es': 'es',
  };
  const ttsLang = langMap[backLang || frontLang || 'en'] || 'en';
  const backFirst = back.split('\n\n').find(line => line && !line.startsWith('(no ')) || '';
  const ttsText = backFirst || front.split('\n\n').find(line => line && !line.startsWith('(no ')) || '';

  return (
    <div>
      <div className="progress" style={{ marginBottom: 24 }}>
        {currentIndex + 1} / {cards.length}
      </div>

      <div className="card" onClick={() => setShowAnswer(!showAnswer)}>
        <p style={{ fontSize: '1.5rem', marginTop: 16, textAlign: 'center', whiteSpace: 'pre-wrap' }}>
          {front}
        </p>
        
        {showAnswer && (
          <>
            <hr style={{ margin: '24px 0', borderColor: 'var(--border)' }} />
            <p style={{ fontSize: '1.5rem', marginTop: 16, textAlign: 'center', whiteSpace: 'pre-wrap' }}>
              {back}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-md)' }}>
              <AudioControls
                text={ttsText}
                lang={ttsLang}
                showPractice={true}
                jaContent={jaContent}
                enContent={enContent}
                esContent={esContent}
              />
            </div>
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
