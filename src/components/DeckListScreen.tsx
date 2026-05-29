import { useState, useEffect } from 'react'
import { getAllDecks, deleteDeck, type Deck } from '../services/decks'

export function DeckListScreen({ 
  onBack, 
  onSelectDeck,
  onImport 
}: { 
  onBack?: () => void; 
  onSelectDeck?: (deck: Deck) => void;
  onImport?: () => void;
} = {}) {
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDecks()
  }, [])

  const loadDecks = async () => {
    setLoading(true)
    const d = await getAllDecks()
    setDecks(d)
    setLoading(false)
  }

  const handleDelete = async (deck: Deck, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete "${deck.name}" and all its cards?`)) return
    
    await deleteDeck(deck.id)
    await loadDecks()
  }

  if (loading) {
    return (
      <div className="screen flex-center" style={{ minHeight: '60vh' }}>
        <p className="text-secondary">Loading decks...</p>
      </div>
    )
  }

  return (
    <div className="screen animate-fade-in" style={{ paddingBottom: '120px' }}>
      {/* Header */}
      <div className="flex-center mb-xl" style={{ justifyContent: 'flex-start' }}>
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
        <h1 className="text-2xl font-bold">Decks</h1>
      </div>

      {/* Import Button */}
      <button
        onClick={onImport}
        className="btn btn-primary btn-full mb-lg"
      >
        + Import Deck
      </button>

      {/* Deck List */}
      {decks.length === 0 ? (
        <div className="card p-xl flex-center flex-col text-center">
          <p className="text-secondary mb-sm">No decks yet</p>
          <p className="text-secondary text-sm">
            Import a CSV file to get started
          </p>
        </div>
      ) : (
        <div className="flex-col gap-sm">
          {decks.map(deck => (
            <div
              key={deck.id}
              className="card p-md flex-between items-center"
              onClick={() => onSelectDeck?.(deck)}
              style={{ cursor: 'pointer' }}
            >
              <div>
                <h3 className="font-semibold">{deck.name}</h3>
                <p className="text-xs text-secondary">
                  {deck.cardCount} cards • {new Date(deck.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={(e) => handleDelete(deck, e)}
                className="btn btn-subtle p-sm"
                style={{ color: 'var(--danger)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}