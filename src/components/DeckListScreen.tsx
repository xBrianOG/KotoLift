import { type Deck } from '../types'

export function DeckListScreen({ 
  onBack
}: { 
  onBack?: () => void; 
  onSelectDeck?: (deck: Deck) => void;
  onImport?: () => void;
} = {}) {
  return (
    <div className="screen" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 'var(--space-xl)',
      textAlign: 'center'
    }}>
      <h1 style={{ 
        fontSize: 'var(--font-2xl)', 
        fontWeight: 700, 
        marginBottom: 'var(--space-md)',
        color: 'var(--text)'
      }}>
        Coming Soon
      </h1>
      <p style={{ 
        fontSize: 'var(--font-base)', 
        color: 'var(--text-secondary)',
        maxWidth: 300,
        marginBottom: 'var(--space-xl)'
      }}>
        We're working on bringing you deck import functionality. Stay tuned!
      </p>
      {onBack && (
        <button className="btn btn-primary" onClick={onBack}>
          Go Back
        </button>
      )}
    </div>
  )
}