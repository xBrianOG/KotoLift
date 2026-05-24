import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getAllCards, deleteCard, updateCard, searchCards, getAllTags } from '../services/cards';
import type { Card } from '../types';
import { getCardSourceText, getCardTranslation } from '../types';
import { getAuthHeaders } from '../services/auth';
import { Search, ChevronDown, Edit2, Trash2, Info, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://kotolift.onrender.com';

function Dropdown({ 
  label, 
  options, 
  selected, 
  onChange, 
  multiple = false
}: { 
  label: string; 
  options: { key: string; label: string }[]; 
  selected: string[]; 
  onChange: (keys: string[]) => void;
  multiple?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSelect = (key: string) => {
    if (!multiple) {
      onChange([key]);
      setOpen(false);
      return;
    }
    // 'all' signals a clear — pass it up so parent can reset
    if (key === 'all') {
      onChange(['all']);
      return;
    }
    // Toggle the clicked key, stripping any stale 'all' entries
    const current = selected.filter(k => k !== 'all');
    if (current.includes(key)) {
      onChange(current.filter(k => k !== key));
    } else {
      onChange([...current, key]);
    }
  };

  const selectedLabels = options
    .filter(o => selected.includes(o.key))
    .map(o => o.label)
    .join(', ');

  useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setOpen(!open)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 'var(--space-sm)',
          padding: 'var(--space-xs) var(--space-md)'
        }}
      >
        <span style={{ fontSize: 'var(--font-sm)' }}>
          {label}: {selectedLabels || 'All'}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div style={{ 
          position: 'absolute', 
          top: 'calc(100% + 4px)', 
          left: 0, 
          zIndex: 1000, 
          minWidth: 180, 
          maxHeight: 250, 
          overflowY: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-xs)'
        }}>
          {options.map(opt => {
            const isSelected = selected.includes(opt.key);
            return (
              <button
                type="button"
                key={opt.key}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(opt.key);
                }}
                style={{
                  width: '100%',
                  padding: 'var(--space-sm) var(--space-md)',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  background: isSelected ? 'var(--bg)' : 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                  fontSize: 'var(--font-sm)',
                  textAlign: 'left',
                  color: isSelected ? 'var(--text)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 500 : 400,
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--bg)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                {multiple && (
                  <span style={{ 
                    width: 16, 
                    height: 16, 
                    border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, 
                    borderRadius: 3,
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 10,
                    flexShrink: 0
                  }}>
                    {isSelected && '✓'}
                  </span>
                )}
                {opt.label}
              </button>
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

  const handleEditSave = async () => {
    setEditingCard(null);
    loadCards();
  };

  return (
    <div className="screen animate-fade-in" style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 style={{ 
          fontSize: 'var(--font-xl)', 
          fontWeight: 600, 
          color: 'var(--text)',
          marginBottom: 'var(--space-xs)'
        }}>
          My Cards
        </h1>
        <p style={{ 
          fontSize: 'var(--font-sm)', 
          color: 'var(--text-tertiary)' 
        }}>
          {cards.length} cards
        </p>
      </div>

      {/* Search & Filters */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 'var(--space-sm)',
          padding: 'var(--space-sm) var(--space-md)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-md)'
        }}>
          <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cards..."
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              padding: 'var(--space-xs)',
              fontSize: 'var(--font-sm)',
              outline: 'none'
            }}
          />
        </div>

        {tags.length > 0 && (
          <Dropdown
            label="Category"
            options={[
              { key: 'all', label: 'All Categories' },
              ...tags.map(t => ({ key: t, label: t }))
            ]}
            selected={selectedTags}
            onChange={(newVals) => {
              // 'all' clears selection; otherwise toggle the clicked tag
              if (newVals.includes('all')) {
                setSelectedTags([]);
              } else {
                setSelectedTags(newVals);
              }
            }}
            multiple={true}
          />
        )}
      </div>

      {/* Card List */}
      {cards.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: 'var(--space-3xl)',
          color: 'var(--text-tertiary)'
        }}>
          <p style={{ fontSize: 'var(--font-base)' }}>No cards found</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {cards.map(card => {
            const langLabel = (card.sourceLang || 'ja').toUpperCase();
            const sourceText = getCardSourceText(card);
            const enText = getCardTranslation(card, 'en') || '';
            const esText = getCardTranslation(card, 'es') || '';
            const showEn = enText && card.sourceLang !== 'en';
            const showEs = esText && card.sourceLang !== 'es';

            return (
              <div 
                key={card.id} 
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: 'var(--space-md) var(--space-sm)',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.15s ease',
                  cursor: 'default'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                    <span className="lang-badge">{langLabel}</span>
                    <span style={{ 
                      fontWeight: 500, 
                      color: 'var(--text)',
                      fontSize: 'var(--font-base)'
                    }}>
                      {sourceText}
                    </span>
                  </div>
                  
                  {showEn && (
                    <p style={{ 
                      fontSize: 'var(--font-sm)', 
                      color: 'var(--text-secondary)',
                      marginBottom: 'var(--space-xs)'
                    }}>
                      {enText}
                    </p>
                  )}
                  
                  {showEs && (
                    <p style={{ 
                      fontSize: 'var(--font-sm)', 
                      color: 'var(--text-tertiary)'
                    }}>
                      {esText}
                    </p>
                  )}

                  {card.tags.length > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      gap: 'var(--space-xs)', 
                      marginTop: 'var(--space-sm)',
                      flexWrap: 'wrap'
                    }}>
                      {card.tags.map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 'var(--space-xs)',
                  marginLeft: 'var(--space-md)'
                }}>
                  {onExplain && (
                    <button
                      onClick={() => onExplain(card)}
                      className="btn btn-subtle"
                      style={{ padding: 'var(--space-xs)' }}
                      title="Explain"
                    >
                      <Info size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => setEditingCard(card)}
                    className="btn btn-subtle"
                    style={{ padding: 'var(--space-xs)' }}
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(card)}
                    className="btn btn-subtle"
                    style={{ padding: 'var(--space-xs)', color: 'var(--danger)' }}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingCard && (
        <EditCardModal
          card={editingCard}
          onSave={handleEditSave}
          onClose={() => setEditingCard(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0,0,0,0.4)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: 'var(--space-lg)', 
          zIndex: 100 
        }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: 'var(--space-xl)',
            maxWidth: 340,
            width: '100%',
            textAlign: 'center'
          }}>
            <h3 style={{ 
              fontWeight: 600, 
              fontSize: 'var(--font-lg)', 
              marginBottom: 'var(--space-sm)',
              color: 'var(--text)'
            }}>
              Delete card?
            </h3>
            <p style={{ 
              color: 'var(--text-secondary)', 
              fontSize: 'var(--font-sm)', 
              marginBottom: 'var(--space-xl)' 
            }}>
              "{getCardSourceText(deleteTarget)}"
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button
                className="btn btn-secondary btn-full"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger btn-full"
                onClick={() => handleDelete(deleteTarget)}
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
      jaText: sourceLang === 'ja' ? sourceText : (jaText || undefined),
      enText: sourceLang === 'en' ? sourceText : (enText || undefined),
      esText: sourceLang === 'es' ? sourceText : (esText || undefined),
      tags: tags.split(',').map(t => t.trim()).filter(t => t),
      notes: notes || undefined
    });
    onSave();
  };

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(0,0,0,0.4)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: 'var(--space-lg)', 
      zIndex: 100 
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: 'var(--space-xl)',
        maxWidth: 480,
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: 'var(--space-xl)'
        }}>
          <h2 style={{ fontWeight: 600, fontSize: 'var(--font-lg)' }}>Edit Card</h2>
          <button className="btn btn-subtle" onClick={onClose} style={{ padding: 'var(--space-xs)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: 'var(--font-xs)', 
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-xs)'
            }}>
              {sourceLang.toUpperCase()} (Source)
            </label>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={2}
              style={{ width: '100%' }}
            />
          </div>

          {sourceLang !== 'en' && (
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: 'var(--font-xs)', 
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-xs)'
              }}>
                EN
              </label>
              <textarea
                value={enText}
                onChange={(e) => setEnText(e.target.value)}
                rows={2}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {sourceLang !== 'es' && (
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: 'var(--font-xs)', 
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-xs)'
              }}>
                ES
              </label>
              <textarea
                value={esText}
                onChange={(e) => setEsText(e.target.value)}
                rows={2}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {sourceLang !== 'ja' && (
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: 'var(--font-xs)', 
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-xs)'
              }}>
                JA
              </label>
              <textarea
                value={jaText}
                onChange={(e) => setJaText(e.target.value)}
                rows={2}
                style={{ width: '100%' }}
              />
            </div>
          )}

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: 'var(--font-xs)', 
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-xs)'
            }}>
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="grammar, n5, verbs..."
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: 'var(--font-xs)', 
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-xs)'
            }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: 'var(--space-sm)', 
          marginTop: 'var(--space-xl)' 
        }}>
          <button className="btn btn-secondary btn-full" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary btn-full" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
