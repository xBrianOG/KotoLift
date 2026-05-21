import { useState, useEffect } from 'react';
import { getAuthHeaders } from '../services/auth';

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
  options: { key: string; label: string; color?: string }[]; 
  selected: string[]; 
  onChange: (keys: string[]) => void;
  multiple?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const toggleOption = (key: string) => {
    if (!multiple) {
      onChange([key]);
      setOpen(false);
      return;
    }
    // For multiple selection, toggle the item
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  // Show selected labels or "All" if nothing selected
  const selectedLabels = options
    .filter(o => selected.includes(o.key) && o.key !== 'all')
    .map(o => o.label)
    .join(', ');

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setOpen(!open)}
        style={{ minWidth: 140, textAlign: 'left' }}
      >
        {label}: {selectedLabels || 'All'} ▼
      </button>
      {open && (
        <div className="card" style={{ 
          position: 'absolute', 
          top: '100%', 
          left: 0, 
          zIndex: 100, 
          minWidth: 180, 
          maxHeight: 250, 
          overflowY: 'auto',
          marginTop: 4,
          padding: 'var(--space-xs)'
        }}>
          {options.map(opt => {
            const isSelected = selected.includes(opt.key);
            return (
              <div
                key={opt.key}
                onClick={() => toggleOption(opt.key)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {multiple && (
                  <span style={{ 
                    width: 18, 
                    height: 18, 
                    border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`, 
                    borderRadius: 4,
                    background: isSelected ? 'var(--primary)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 12,
                    flexShrink: 0
                  }}>
                    {isSelected && '✓'}
                  </span>
                )}
                <span style={{ color: isSelected ? 'var(--primary)' : 'inherit', fontWeight: isSelected ? 500 : 400 }}>
                  {opt.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {open && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
          onClick={() => setOpen(false)}
        />
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
      // Always preserve existing categories and add new ones
      const newCats = data.categories || [];
      setCategories(prev => {
        const existingNames = prev.map(c => c.name);
        const merged = [...prev];
        newCats.forEach((c: any) => {
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
      
      // Handle level filter (exclude 'all')
      const levels = filterLevels.filter(l => l !== 'all');
      if (levels.length > 0 && !levels.includes('all')) {
        params.append('level', levels[0]); // API expects single level for now
      }
      
      // Handle category filter (exclude 'all')
      const cats = filterCategories.filter(c => c !== 'all');
      if (cats.length > 0 && !cats.includes('all')) {
        params.append('category', cats[0]); // API expects single category for now
      }
      
      // Search in both words and categories
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      
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

  // Build filter options - get from vocabulary in DB
  const vocabularyCategories = [...new Set(vocabulary.flatMap((w: VocabularyWord) => w.categories || []))];
  const levelOptions = [
    { key: 'all', label: 'All Levels' },
    ...LEVELS.filter(l => l.key !== 'all').map(l => ({ key: l.key, label: l.label }))
  ];
  
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
        onUpdate={fetchVocabulary}
      />
    );
  }

  return (
    <div className="screen animate-fade-in" style={{ padding: 'var(--space-xl)' }}>
      <div className="mb-lg">
        <h1 className="text-2xl font-bold mb-xs">Vocabulary</h1>
        <p className="text-secondary text-sm">B1-B2 English vocabulary</p>
      </div>

      {/* Search Bar - searches words AND categories */}
      <div className="flex gap-sm mb-md">
        <input
          type="text"
          className="input"
          placeholder="Search words or categories..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={handleSearch}>Search</button>
        <button className="btn btn-secondary" onClick={() => setShowCategoryModal(true)}>Manage</button>
      </div>

      {/* Filter Dropdowns */}
      <div className="flex gap-sm mb-lg" style={{ flexWrap: 'wrap' }}>
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
          selected={filterCategories.length === 0 || filterCategories.includes('all') ? ['all'] : filterCategories}
          onChange={(newVals) => {
            // If "All Categories" is clicked, clear selection
            if (newVals.includes('all') && !filterCategories.includes('all')) {
              setFilterCategories(['all']);
            } else {
              // Remove 'all' from selection and set the categories
              const withoutAll = newVals.filter(v => v !== 'all');
              setFilterCategories(withoutAll.length > 0 ? withoutAll : ['all']);
            }
          }}
          multiple={true}
        />
      </div>

      {/* Word List */}
      {loading && vocabulary.length === 0 ? (
        <div className="text-center" style={{ padding: 'var(--space-xl)' }}>
          <p>Loading vocabulary...</p>
        </div>
      ) : error ? (
        <div className="text-center" style={{ padding: 'var(--space-xl)' }}>
          <p className="text-error">{error}</p>
        </div>
      ) : vocabulary.length === 0 ? (
        <div className="text-center" style={{ padding: 'var(--space-xl)' }}>
          <p className="text-secondary">No vocabulary found</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
          {vocabulary.map(word => (
            <div
              key={word.id}
              className="card card-clickable"
              onClick={() => setSelectedWord(word)}
            >
              <div className="flex-between">
                <div>
                  <span className="font-semibold">{word.word}</span>
                  <span className="text-secondary text-sm ml-sm">({word.part_of_speech})</span>
                  {word.categories && word.categories.length > 0 && (
                    <div className="flex gap-xs mt-xs">
                      {word.categories.map(cat => {
                        const catData = categories.find(c => c.name === cat);
                        return (
                          <span 
                            key={cat} 
                            className="chip chip--secondary" 
                            style={{ 
                              fontSize: '0.7rem', 
                              padding: '2px 6px',
                              background: catData?.color || 'var(--bg-secondary)',
                              color: 'white'
                            }}
                          >
                            {cat}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <span className="chip">{word.level}</span>
              </div>
            </div>
          ))}
          {hasMore && (
            <button className="btn btn-secondary" onClick={() => { setPage(p => p + 1); fetchVocabulary(false); }}>
              Load More
            </button>
          )}
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100
        }}>
          <div className="card" style={{ margin: 'var(--space-lg)', maxWidth: 400, width: '100%' }}>
            <h2 className="font-bold mb-md">Manage Categories</h2>
            
            <div className="flex gap-sm mb-lg">
              <input
                type="text"
                className="input"
                placeholder="New category name..."
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createCategory()}
              />
              <button className="btn btn-primary" onClick={createCategory}>Add</button>
            </div>

            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {categories.map(cat => (
                <div key={cat.id} className="flex-between" style={{ padding: 'var(--space-sm)', borderBottom: '1px solid var(--bg-secondary)' }}>
                  <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color }} />
                    <span>{cat.name}</span>
                  </div>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => deleteCategory(cat.id)}>Delete</button>
                </div>
              ))}
            </div>

            <button className="btn btn-secondary mt-lg" onClick={() => setShowCategoryModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function WordDetail({ word, categories, onBack, onUpdate }: { word: VocabularyWord; categories: Category[]; onBack: () => void; onUpdate: () => void }) {
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
    <div className="screen animate-fade-in" style={{ padding: 'var(--space-xl)' }}>
      <div className="flex-between mb-lg">
        <button onClick={onBack} className="btn btn-secondary">Back</button>
        <span className="chip">{word.level}</span>
      </div>

      <div className="card mb-lg">
        <h1 className="text-2xl font-bold mb-sm">{word.word}</h1>
        <p className="text-secondary">({word.part_of_speech})</p>
      </div>

      <div className="card mb-lg">
        <h2 className="font-semibold mb-md">Categories</h2>
        <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
          {categories.map(cat => {
            const isSelected = selectedCategories.includes(cat.name);
            return (
              <button
                key={cat.id}
                className={`chip ${isSelected ? 'active' : 'chip--secondary'}`}
                style={isSelected ? { background: cat.color, color: 'white' } : {}}
                onClick={() => toggleCategory(cat.name)}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {word.example_sentences && word.example_sentences.length > 0 && (
        <div className="card mb-lg">
          <h2 className="font-semibold mb-md">Example Sentences</h2>
          {word.example_sentences.map((sent, idx) => (
            <p key={idx} className="text-secondary mb-sm" style={{ fontStyle: 'italic' }}>
              {typeof sent === 'string' ? sent : sent.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
