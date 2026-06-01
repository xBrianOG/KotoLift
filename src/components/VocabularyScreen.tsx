import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getAuthHeaders } from '../services/auth';
import { Search, ChevronDown, ChevronLeft, X, Plus } from 'lucide-react';
import { AudioControls } from './AudioControls';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://kotolift.onrender.com';

interface VocabularyWord {
  id: string;
  word: string;
  level: string;
  part_of_speech: string;
  translations: string[];
  phonetic: string;
  frequency: number;
  example_sentences: string[];
  collocations: string[];
  categories?: string[];
}

interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
}

interface VocabularyScreenProps {
  onBack: () => void;
}

const LEVELS = [
  { key: 'all', label: 'All Levels' },
  { key: 'B1', label: 'B1' },
  { key: 'B2', label: 'B2' }
];

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
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  const selectedLabels = options
    .filter(o => selected.includes(o.key) && o.key !== 'all')
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
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
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
                onMouseDown={(e) => {
                  e.preventDefault();
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

export function VocabularyScreen({ onBack }: VocabularyScreenProps) {
  const [vocabulary, setVocabulary] = useState<VocabularyWord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevels, setFilterLevels] = useState<string[]>(['all']);
  const [filterCategories, setFilterCategories] = useState<string[]>(['all']);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const LIMIT = 30;

  useEffect(() => {
    fetchCategories();
    fetchVocabulary(true);
  }, []);

  useEffect(() => {
    setPage(0);
    setVocabulary([]);
    setHasMore(true);
  }, [filterLevels.join(','), filterCategories.join(',')]);

  useEffect(() => {
    fetchVocabulary(true);
  }, [filterLevels.join(','), filterCategories.join(',')]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/categories`, { headers: { ...getAuthHeaders() } });
      const data = await res.json();
      const newCats = data.categories || [];
      setCategories(prev => {
        const existingNames = prev.map(c => c.name);
        const merged = [...prev];
        newCats.forEach((c: Category) => {
          if (!existingNames.includes(c.name)) {
            merged.push(c);
          }
        });
        return merged;
      });
    } catch (err) {
      console.error('Failed to load categories');
    }
  };

  const fetchVocabulary = async (reset = false) => {
    if (!hasMore && !reset && !searchQuery) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      const levels = filterLevels.filter(l => l !== 'all');
      if (levels.length > 0) params.append('level', levels[0]);
      const cats = filterCategories.filter(c => c !== 'all');
      if (cats.length > 0) params.append('category', cats[0]);
      if (searchQuery) params.append('search', searchQuery);
      params.append('limit', String(LIMIT));
      params.append('offset', String(reset ? 0 : page * LIMIT));

      const res = await fetch(`${API_BASE}/api/vocabulary?${params}`, {
        headers: { ...getAuthHeaders() }
      });
      const data = await res.json();
      const newWords = data.vocabulary || [];

      if (reset) {
        setVocabulary(newWords);
      } else {
        setVocabulary(prev => [...prev, ...newWords]);
      }
      setHasMore(newWords.length === LIMIT);
    } catch (err) {
      setError('Failed to load vocabulary');
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/categories`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName })
      });
      const data = await res.json();
      setCategories([...categories, data.category]);
      setNewCategoryName('');
    } catch (err) {
      console.error('Failed to create category');
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/categories/${id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() }
      });
      setCategories(categories.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete category');
    }
  };

  const handleSearch = async () => {
    setPage(0);
    fetchVocabulary(true);
  };

  const vocabularyCategories = [...new Set(vocabulary.flatMap((w: VocabularyWord) => w.categories || []))];
  const levelOptions = LEVELS.map(l => ({ key: l.key, label: l.label }));
  const categoryOptions = [
    { key: 'all', label: 'All Categories' },
    ...vocabularyCategories.map((name: string) => ({ key: name, label: name }))
  ];

  if (selectedWord) {
    return (
      <WordDetail 
        word={selectedWord} 
        categories={categories}
        onBack={() => setSelectedWord(null)} 
        onUpdate={() => fetchVocabulary(true)}
      />
    );
  }

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
          Vocabulary
        </h1>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>
          B1-B2 English vocabulary
        </p>
      </div>

      {/* Search */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: 'var(--space-sm)',
        marginBottom: 'var(--space-md)'
      }}>
        <div style={{ 
          flex: 1,
          display: 'flex', 
          alignItems: 'center',
          gap: 'var(--space-sm)',
          padding: 'var(--space-sm) var(--space-md)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)'
        }}>
          <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search words..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
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
        <button className="btn btn-primary" onClick={handleSearch}>Search</button>
        <button className="btn btn-secondary" onClick={() => setShowCategoryModal(true)}>Manage</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        <Dropdown
          label="Level"
          options={levelOptions}
          selected={filterLevels}
          onChange={setFilterLevels}
          multiple={false}
        />
        <Dropdown
          label="Category"
          options={categoryOptions}
          selected={filterCategories.includes('all') ? ['all'] : filterCategories}
          onChange={(newVals) => {
            if (newVals.includes('all') && !filterCategories.includes('all')) {
              setFilterCategories(['all']);
            } else {
              const withoutAll = newVals.filter(v => v !== 'all');
              setFilterCategories(withoutAll.length > 0 ? withoutAll : ['all']);
            }
          }}
          multiple={true}
        />
      </div>

      {/* Word List */}
      {loading && vocabulary.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-tertiary)' }}>
          Loading...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--danger)' }}>
          {error}
        </div>
      ) : vocabulary.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-tertiary)' }}>
          No vocabulary found
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {vocabulary.map(word => (
            <div
              key={word.id}
              onClick={() => setSelectedWord(word)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-md) var(--space-sm)',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text)' }}>{word.word}</span>
                  <AudioControls text={word.word} lang="en" showPractice={false} />
                </div>
                <span style={{ 
                  fontSize: 'var(--font-sm)', 
                  color: 'var(--text-tertiary)',
                  marginLeft: 'var(--space-sm)'
                }}>
                  {word.part_of_speech}
                </span>
                {word.categories && word.categories.length > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-xs)' }}>
                    {word.categories.map(cat => (
                      <span key={cat} className="tag">{cat}</span>
                    ))}
                  </div>
                )}
              </div>
              <span className="chip">{word.level}</span>
            </div>
          ))}
          {hasMore && (
            <button 
              className="btn btn-secondary" 
              onClick={() => { setPage(p => p + 1); fetchVocabulary(false); }}
              style={{ marginTop: 'var(--space-lg)', alignSelf: 'center' }}
            >
              Load More
            </button>
          )}
        </div>
      )}

{/* Category Modal */}
      {showCategoryModal && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 100,
          padding: 'var(--space-lg)',
          paddingTop: 'calc(env(safe-area-inset-top) + var(--space-lg))',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--space-lg))',
          overflowY: 'auto'
        }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: 'var(--space-xl)',
            maxWidth: 400,
            width: '100%',
            marginTop: 'var(--space-xl)',
            marginBottom: 'var(--space-xl)'
          }}>
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-lg)'
            }}>
              <h2 style={{ fontWeight: 600, fontSize: 'var(--font-lg)' }}>Manage Categories</h2>
              <button 
                className="btn btn-subtle" 
                onClick={() => setShowCategoryModal(false)}
                style={{ padding: 'var(--space-xs)' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
              <input
                type="text"
                placeholder="New category..."
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => e.keyDown === 'Enter' && createCategory()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={createCategory}>
                <Plus size={16} />
              </button>
            </div>

            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {categories.map(cat => (
                <div 
                  key={cat.id} 
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-sm)',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <div style={{ 
                      width: 10, 
                      height: 10, 
                      borderRadius: '50%', 
                      background: cat.color 
                    }} />
                    <span style={{ fontSize: 'var(--font-sm)' }}>{cat.name}</span>
                  </div>
                  <button 
                    className="btn btn-subtle" 
                    style={{ padding: 'var(--space-xs)', color: 'var(--danger)' }}
                    onClick={() => deleteCategory(cat.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function WordDetail({ 
  word, 
  categories, 
  onBack, 
  onUpdate 
}: { 
  word: VocabularyWord; 
  categories: Category[]; 
  onBack: () => void; 
  onUpdate: () => void 
}) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(word.categories || []);

  const toggleCategory = async (catName: string) => {
    const newCategories = selectedCategories.includes(catName)
      ? selectedCategories.filter(c => c !== catName)
      : [...selectedCategories, catName];
    
    setSelectedCategories(newCategories);
    
    try {
      await fetch(`${API_BASE}/api/vocabulary/${word.id}/categories`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: catName })
      });
      onUpdate();
    } catch (err) {
      console.error('Failed to update category');
    }
  };

  return (
    <div className="screen animate-fade-in" style={{ maxWidth: 560 }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 'var(--space-xl)'
      }}>
        <button onClick={onBack} className="btn btn-subtle" style={{ padding: 'var(--space-xs)' }}>
          <ChevronLeft size={20} />
          <span>Back</span>
        </button>
        <span className="chip">{word.level}</span>
      </div>

      <div style={{ 
        padding: 'var(--space-xl)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 'var(--space-lg)'
      }}>
        <h1 style={{ 
          fontSize: 'var(--font-2xl)', 
          fontWeight: 600, 
          marginBottom: 'var(--space-xs)',
          color: 'var(--text)'
        }}>
          {word.word}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>
            {word.part_of_speech}
          </p>
          <AudioControls text={word.word} lang="en" showPractice={false} />
        </div>
      </div>

      <div style={{ 
        padding: 'var(--space-lg)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 'var(--space-lg)'
      }}>
        <h2 style={{ 
          fontSize: 'var(--font-sm)', 
          fontWeight: 500, 
          color: 'var(--text-secondary)',
          marginBottom: 'var(--space-md)'
        }}>
          Categories
        </h2>
        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
          {categories.map(cat => {
            const isSelected = selectedCategories.includes(cat.name);
            return (
              <button
                key={cat.id}
                className={`tag ${isSelected ? 'active' : ''}`}
                style={isSelected ? { background: cat.color, borderColor: cat.color, color: 'white' } : {}}
                onClick={() => toggleCategory(cat.name)}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {word.example_sentences && word.example_sentences.length > 0 && (
        <div style={{ 
          padding: 'var(--space-lg)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <h2 style={{ 
            fontSize: 'var(--font-sm)', 
            fontWeight: 500, 
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-md)'
          }}>
            Examples
          </h2>
          {word.example_sentences.map((sent, idx) => (
            <p 
              key={idx} 
              style={{ 
                color: 'var(--text-secondary)', 
                fontSize: 'var(--font-sm)',
                fontStyle: 'italic',
                marginBottom: idx < word.example_sentences.length - 1 ? 'var(--space-sm)' : 0
              }}
            >
              {typeof sent === 'string' ? sent : (sent as any).text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
