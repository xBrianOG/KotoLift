import { useState, useEffect, useCallback } from 'react';
import { getAllCards, deleteCard, searchCards, getAllTags } from '../services/cards';
import type { Card } from '../types';

export function CardListScreen({ onExplain }: { onExplain?: (card: any) => void } = {}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  const loadCards = useCallback(async () => {
    if (searchQuery || selectedTags.length > 0) {
      const results = await searchCards(searchQuery, selectedTags);
      setCards(results);
    } else {
      const allCards = await getAllCards();
      setCards(allCards);
    }
  }, [searchQuery, selectedTags]);

  useEffect(() => {
    loadCards();
    getAllTags().then(setTags);
  }, [loadCards]);

  const handleDelete = async (id: string) => {
    if (confirm('Delete this card?')) {
      await deleteCard(id);
      loadCards();
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleEditSave = async () => {
    setEditingCard(null);
    loadCards();
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search cards..."
          style={{ width: '100%', marginBottom: 12 }}
        />
        
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tags.map(tag => (
              <button
                key={tag}
                className={`tag ${selectedTags.includes(tag) ? 'active' : ''}`}
                onClick={() => toggleTag(tag)}
                style={{ 
                  cursor: 'pointer',
                  background: selectedTags.includes(tag) ? 'var(--accent)' : 'var(--border)',
                  border: 'none'
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="empty-state">
          <p>No cards found</p>
        </div>
      ) : (
        cards.map(card => (
          <div key={card.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="lang-badge">JA</span>
                <p style={{ marginTop: 8 }}>{card.jaText}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => setEditingCard(card)}
                  style={{ background: 'none', color: 'var(--text-secondary)', padding: 4 }}
                >
                  ✏️
                </button>
                <button 
                  onClick={() => handleDelete(card.id)}
                  style={{ background: 'none', color: 'var(--danger)', padding: 4 }}
                >
                  🗑️
                </button>
              </div>
              {onExplain && (
                <button
                  onClick={() => onExplain(card)}
                  style={{ width: '100%', marginTop: 6, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                >
                  Explain
                </button>
              )}
              
            </div>
            <p style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
              <span className="lang-badge" style={{ fontSize: '0.6rem' }}>EN</span> {card.enText}
            </p>
            <p style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
              <span className="lang-badge" style={{ fontSize: '0.6rem' }}>ES</span> {card.esText}
            </p>
            {card.tags.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {card.tags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      {editingCard && (
        <EditCardModal 
          card={editingCard} 
          onSave={handleEditSave}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
}

interface EditCardModalProps {
  card: Card;
  onSave: () => void;
  onClose: () => void;
}

function EditCardModal({ card, onSave, onClose }: EditCardModalProps) {
  const [jaText, setJaText] = useState(card.jaText);
  const [enText, setEnText] = useState(card.enText);
  const [esText, setEsText] = useState(card.esText);
  const [tags, setTags] = useState(card.tags.join(', '));
  const [notes, setNotes] = useState(card.notes || '');

  const handleSave = async () => {
    const { updateCard } = await import('../services/cards');
    await updateCard(card.id, {
      jaText,
      enText,
      esText,
      tags: tags.split(',').map(t => t.trim()).filter(t => t),
      notes: notes || undefined
    });
    onSave();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      zIndex: 100
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}>
        <h2 style={{ marginBottom: 16 }}>Edit Card</h2>
        
        <label style={{ display: 'block', marginBottom: 8 }}>JA</label>
        <textarea
          value={jaText}
          onChange={(e) => setJaText(e.target.value)}
          rows={2}
          style={{ width: '100%', marginBottom: 12 }}
        />

        <label style={{ display: 'block', marginBottom: 8 }}>EN</label>
        <textarea
          value={enText}
          onChange={(e) => setEnText(e.target.value)}
          rows={2}
          style={{ width: '100%', marginBottom: 12 }}
        />

        <label style={{ display: 'block', marginBottom: 8 }}>ES</label>
        <textarea
          value={esText}
          onChange={(e) => setEsText(e.target.value)}
          rows={2}
          style={{ width: '100%', marginBottom: 12 }}
        />

        <label style={{ display: 'block', marginBottom: 8 }}>Tags</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          style={{ width: '100%', marginBottom: 12 }}
        />

        <label style={{ display: 'block', marginBottom: 8 }}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          style={{ width: '100%', marginBottom: 16 }}
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }}>
            Save
          </button>
          <button className="btn" onClick={onClose} style={{ flex: 1, background: 'var(--border)' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
