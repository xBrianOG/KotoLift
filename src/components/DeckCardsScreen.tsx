import { useState, useEffect } from 'react'
import { getCardsByDeck, type Deck, type Card } from '../services/decks'

function AudioPlayer({ audioUrl }: { audioUrl: string }) {
  const [playing, setPlaying] = useState(false)
  const [audio] = useState(() => new Audio(audioUrl))
  
  useEffect(() => {
    audio.onended = () => setPlaying(false)
    return () => {
      audio.pause()
      audio.onended = undefined
    }
  }, [audio])
  
  const toggle = () => {
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play()
      setPlaying(true)
    }
  }
  
  return (
    <button
      onClick={toggle}
      className="flex-center"
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: playing ? 'var(--accent)' : 'var(--accent-light)',
        color: playing ? 'white' : 'var(--accent)',
        flexShrink: 0,
      }}
      title={playing ? 'Pause' : 'Play audio'}
    >
      {playing ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      )}
    </button>
  )
}

export function DeckCardsScreen({ 
  deck,
  onBack,
  onReview
}: { 
  deck: Deck;
  onBack?: () => void;
  onReview?: (cards: Card[]) => void;
} = {}) {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCards()
  }, [deck.id])

  const loadCards = async () => {
    setLoading(true)
    const c = await getCardsByDeck(deck.id)
    setCards(c)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="screen flex-center" style={{ minHeight: '60vh' }}>
        <p className="text-secondary">Loading cards...</p>
      </div>
    )
  }

  return (
    <div className="screen animate-fade-in" style={{ paddingBottom: '120px' }}>
      {/* Header */}
      <div className="flex-center mb-lg" style={{ justifyContent: 'flex-start' }}>
        {onBack && (
          <button
            onClick={onBack}
            className="btn-subtle"
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              marginRight: 'var(--space-sm)',
              borderRadius: 'var(--radius-round)'
            }}
          >
            ← Back
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold">{deck.name}</h1>
          <p className="text-sm text-secondary">{cards.length} cards</p>
        </div>
      </div>

      {/* Review Button */}
      {cards.length > 0 && (
        <button
          onClick={() => onReview?.(cards)}
          className="btn btn-primary btn-full mb-lg"
        >
          Practice This Deck
        </button>
      )}

      {/* Cards List */}
      <div className="flex-col gap-sm">
        {cards.map(card => (
          <div key={card.id} className="card p-md">
            <div className="flex items-start gap-sm">
              <div className="flex-1">
                <div className="font-medium mb-xs">{card.sourceText || card.jaText || card.enText}</div>
                <div className="text-secondary text-sm">
                  {card.translations?.en || card.enText || card.jaText}
                </div>
              </div>
              {card.audioUrl && <AudioPlayer audioUrl={card.audioUrl} />}
            </div>
            {card.tags && card.tags.length > 0 && (
              <div className="flex gap-xs mt-sm flex-wrap">
                {card.tags.map(tag => (
                  <span 
                    key={tag} 
                    className="px-sm py-xs text-xs rounded-full"
                    style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}