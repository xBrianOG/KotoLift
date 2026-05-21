import { useState, useEffect, useCallback } from 'react';
import { getAllCards, deleteCard, updateCard, searchCards, getAllTags } from '../services/cards';
import type { Card } from '../types';
import { getCardSourceText, getCardTranslation } from '../types';
import { getAuthHeaders } from '../services/auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://kotolift.onrender.com';

function Dropdown({ 
  label, 
  options, 
  selected, 
  onChange, 
  multiple = false
}: { 
  label: string; 
  options: { key: string; label: string; color?: string }[]; 
  selected: string[]; 
  onChange: (keys: string[]) => void;
  multiple?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const handleSelect = (key: string) => {
    console.log('[v0] handleSelect called with key:', key);
    if (!multiple) {
      onChange([key]);
      setOpen(false);
      return;
    }
    // For multiple selection, toggle the item
    if (selected.includes(key)) {
      const newSelected = selected.filter(k => k !== key);
      console.log('[v0] Removing key, new selected:', newSelected);
      onChange(newSelected);
    } else {
      const newSelected = [...selected, key];
      console.log('[v0] Adding key, new selected:', newSelected);
      onChange(newSelected);
    }
  };

  // Show selected labels or "All" if nothing selected
  const selectedLabels = options
    .filter(o => selected.includes(o.key) && o.key !== 'all')
    .map(o => o.label)
    .join(', ');

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setOpen(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  return (
    <div className="dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setOpen(!open)}
        style={{ minWidth: 120, fontSize: '0.85rem', padding: '6px 12px' }}
      >
        {label}: {selectedLabels || 'All'} ▼
      </button>
      {open && (
        <div 
          className="card" 
          onClick={(e) => e.stopPropagation()}
          style={{ 
            position: 'absolute', 
            top: '100%', 
            left: 0, 
            zIndex: 1000, 
            minWidth: 180, 
            maxHeight: 250, 
            overflowY: 'auto',
            marginTop: 4,
            padding: '8px'
          }}>
          {options.map(opt => {
            const isSelected = selected.includes(opt.key);
            return (
              <div
                key={opt.key}
                role="button"
                tabIndex={0}
                onClick={() => {
                  console.log('[v0] Item clicked:', opt.key);
                  handleSelect(opt.key);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleSelect(opt.key);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderRadius: 6,
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: '0.9rem',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {multiple && (
                  <span style={{ 
                    width: 20, 
                    height: 20, 
                    border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`, 
                    borderRadius: 4,
                    background: isSelected ? 'var(--primary)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 14,
                    flexShrink: 0
                  }}>
                    {isSelected && '✓'}
                  </span>
                )}
                <span style={{ color: isSelected ? 'var(--primary)' : 'inherit', fontWeight: isSelected ? 600 : 400 }}>
                  {opt.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CardListScreen({ onExplain }: { onExplain?: (card: Card) => void } = {}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Card | null>(null);
  const [filterCategory, setFilterCategory] = useState<string[]>(['all']);
  const [categories, setCategories] = useState<{name: string}[]>([]);

  // Fetch categories from API
  useEffect(() => {
    fetch(`${API_BASE}/api/categories`, { headers: { ...getAuthHeaders() } })
      .then(res => res.json())
      .then(data => setCategories(data.categories || []))
      .catch(console.error);
  }, []);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadCards = useCallback(async () => {
    if (debouncedQuery || selectedTags.length > 0) {
      const results = await searchCards(debouncedQuery, selectedTags);
      setCards(results);
    } else {
      const allCards = await getAllCards();
      setCards(allCards);
    }
  }, [debouncedQuery, selectedTags]);

  useEffect(() => {
    loadCards();
    getAllTags().then(setTags);
  }, [loadCards]);

  const handleDelete = async (card: Card) => {
    await deleteCard(card.id);
    setDeleteTarget(null);
    loadCards();
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
    <div className="screen animate-fade-in" style={{ paddingBottom: '120px' }}>
      <div className="mb-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search cards..."
          className="mb-md"
          style={{ width: '100%' }}
        />

{/* Dropdown Filters */}
        <div className="flex gap-sm mb-md" style={{ flexWrap: 'wrap' }}>
          <Dropdown
            label="Category"
            options={[
              { key: 'all', label: 'All Categories' },
              ...tags.map(c => ({ key: c, label: c }))
            ]}
            selected={selectedTags.length === 0 ? ['all'] : selectedTags}
            onChange={(newVals) => {
              // If "All Categories" is clicked, clear selection
              if (newVals.includes('all') && !selectedTags.includes('all')) {
                setSelectedTags([]);
              } else {
                // Remove 'all' from selection and set the tags
                const withoutAll = newVals.filter(v => v !== 'all');
                setSelectedTags(withoutAll);
              }
            }}
            multiple={true}
          />
        </div>

        {tags.length > 0 && (
          <div className="flex-center flex-wrap gap-xs" style={{ justifyContent: 'flex-start' }}>
            {tags.map(tag => (
              <button
                key={tag}
                className={`tag ${selectedTags.includes(tag) ? 'active' : ''}`}
                onClick={() => toggleTag(tag)}
                style={{
                  cursor: 'pointer',
                  background: selectedTags.includes(tag) ? 'var(--text)' : 'var(--surface)',
                  color: selectedTags.includes(tag) ? 'white' : 'var(--text-secondary)',
                  borderColor: selectedTags.includes(tag) ? 'var(--text)' : 'var(--border)'
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
          <div className="empty-state-icon">📭</div>
          <p className="font-medium">No cards found</p>
        </div>
      ) : (
        <div className="flex-col gap-sm">
          {cards.map(card => {
            const langLabel = (card.sourceLang || 'ja').toUpperCase();
            const sourceText = getCardSourceText(card);
            const enText = getCardTranslation(card, 'en') || '';
            const esText = getCardTranslation(card, 'es') || '';
            const showEn = enText && card.sourceLang !== 'en';
            const showEs = esText && card.sourceLang !== 'es';

            return (
              <div key={card.id} className="card card-clickable" style={{ padding: 'var(--space-md) var(--space-lg)' }}>
                <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <span className="lang-badge" style={{ padding: '2px 6px' }}>{langLabel}</span>
                    <p className="font-medium mt-sm text-lg">{sourceText}</p>
                  </div>
                  <div className="flex-center gap-xs">
                    {onExplain && (
                      <button
                        onClick={() => onExplain(card)}
                        className="btn-subtle"
                        style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
                        title="Explain"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                          <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => setEditingCard(card)}
                      className="btn-subtle"
                      style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
                      title="Edit"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteTarget(card)}
                      className="btn-subtle"
                      style={{ padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--danger)' }}
                      title="Delete"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {showEn && (
                  <p className="text-secondary text-base mt-sm">
                    <span className="lang-badge" style={{ fontSize: '10px', marginRight: 6, padding: '2px 4px' }}>EN</span> {enText}
                  </p>
                )}
                {showEs && (
                  <p className="text-secondary text-base mt-xs">
                    <span className="lang-badge" style={{ fontSize: '10px', marginRight: 6, padding: '2px 4px' }}>ES</span> {esText}
                  </p>
                )}
                {card.tags.length > 0 && (
                  <div className="mt-md flex-center flex-wrap" style={{ justifyContent: 'flex-start' }}>
                    {card.tags.map(tag => (
                      <span key={tag} className="tag" style={{ margin: '0 6px 6px 0', padding: '2px 8px' }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingCard && (
        <EditCardModal
          card={editingCard}
          onSave={handleEditSave}
          onClose={() => setEditingCard(null)}
        />
      )}

      {/* Custom delete confirmation dialog */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}>
          <div className="card animate-slide-down" style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
            <h3 className="font-bold text-lg mb-sm">Delete this card?</h3>
            <p className="text-secondary text-sm mb-xl">"{getCardSourceText(deleteTarget)}"</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={() => handleDelete(deleteTarget)}
                style={{ flex: 1, background: 'var(--danger)', color: 'white', border: 'none' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
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
  const sourceLang = card.sourceLang || 'ja';

  // Initialize from flexible model, falling back to legacy fields
  const [sourceText, setSourceText] = useState(getCardSourceText(card));
  const [enText, setEnText] = useState(getCardTranslation(card, 'en') || '');
  const [esText, setEsText] = useState(getCardTranslation(card, 'es') || '');
  const [jaText, setJaText] = useState(getCardTranslation(card, 'ja') || '');
  const [tags, setTags] = useState(card.tags.join(', '));
  const [notes, setNotes] = useState(card.notes || '');

  const handleSave = async () => {
    const translationsUpdate: Record<string, string | undefined> = {};
    if (sourceLang !== 'en') translationsUpdate.en = enText || undefined;
    if (sourceLang !== 'es') translationsUpdate.es = esText || undefined;
    if (sourceLang !== 'ja') translationsUpdate.ja = jaText || undefined;

    await updateCard(card.id, {
      sourceText,
      translations: { ...card.translations, ...translationsUpdate },
      // Keep legacy fields in sync for backward compatibility
      jaText: sourceLang === 'ja' ? sourceText : (jaText || undefined),
      enText: sourceLang === 'en' ? sourceText : (enText || undefined),
      esText: sourceLang === 'es' ? sourceText : (esText || undefined),
      tags: tags.split(',').map(t => t.trim()).filter(t => t),
      notes: notes || undefined
    });
    onSave();
  };

  const fieldLabel = (lang: string) => lang.toUpperCase();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}>
      <div className="card animate-slide-down" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}>
        <h2 className="font-bold text-xl mb-lg">Edit Card</h2>

        <label className="block mb-xs text-sm font-semibold text-secondary">
          {fieldLabel(sourceLang)} (Source)
        </label>
        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          rows={2}
          style={{ width: '100%', marginBottom: 12 }}
        />

        {sourceLang !== 'en' && (
          <>
            <label className="block mb-xs text-sm font-semibold text-secondary">EN</label>
            <textarea
              value={enText}
              onChange={(e) => setEnText(e.target.value)}
              rows={2}
              style={{ width: '100%', marginBottom: 12 }}
            />
          </>
        )}

        {sourceLang !== 'es' && (
          <>
            <label className="block mb-xs text-sm font-semibold text-secondary">ES</label>
            <textarea
              value={esText}
              onChange={(e) => setEsText(e.target.value)}
              rows={2}
              style={{ width: '100%', marginBottom: 12 }}
            />
          </>
        )}

        {sourceLang !== 'ja' && (
          <>
            <label className="block mb-xs text-sm font-semibold text-secondary">JA</label>
            <textarea
              value={jaText}
              onChange={(e) => setJaText(e.target.value)}
              rows={2}
              style={{ width: '100%', marginBottom: 12 }}
            />
          </>
        )}

        <label className="block mb-xs text-sm font-semibold text-secondary">Tags</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="grammar, n5, verbs…"
          style={{ width: '100%', marginBottom: 12 }}
        />

        <label className="block mb-xs text-sm font-semibold text-secondary">Notes</label>
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
