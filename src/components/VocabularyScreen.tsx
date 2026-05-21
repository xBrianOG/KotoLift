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
  { key: 'all', label: 'All' },
  { key: 'B1', label: 'B1' },
  { key: 'B2', label: 'B2' }
];

export function VocabularyScreen({ onBack }: VocabularyScreenProps) {
  const [vocabulary, setVocabulary] = useState<VocabularyWord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const LIMIT = 30;

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setPage(0);
    setVocabulary([]);
    setHasMore(true);
  }, [filterLevel, filterCategory]);

  useEffect(() => {
    fetchVocabulary(true);
  }, [filterLevel, filterCategory]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/categories`, { headers: { ...getAuthHeaders() } });
      const data = await res.json();
      setCategories(data.categories || []);
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
      if (filterLevel !== 'all') params.append('level', filterLevel);
      if (filterCategory !== 'all') params.append('category', filterCategory);
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

      {/* Search Bar */}
      <div className="flex gap-sm mb-md">
        <input
          type="text"
          className="input"
          placeholder="Search words..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={handleSearch}>Search</button>
      </div>

      {/* Filters */}
      <div className="flex gap-sm mb-lg" style={{ overflowX: 'auto', paddingBottom: 'var(--space-sm)' }}>
        {LEVELS.map(lvl => (
          <button
            key={lvl.key}
            className={`chip ${filterLevel === lvl.key ? 'active' : ''}`}
            onClick={() => setFilterLevel(lvl.key)}
          >
            {lvl.label}
          </button>
        ))}
        <span style={{ borderLeft: '1px solid var(--bg-secondary)', margin: '0 8px' }} />
        <button
          className={`chip ${filterCategory === 'all' ? 'active' : ''}`}
          onClick={() => setFilterCategory('all')}
        >
          All Categories
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`chip ${filterCategory === cat.name ? 'active' : ''}`}
            onClick={() => setFilterCategory(cat.name)}
            style={filterCategory === cat.name ? { background: cat.color, color: 'white' } : {}}
          >
            {cat.name}
          </button>
        ))}
        <button className="chip" onClick={() => setShowCategoryModal(true)}>+ Category</button>
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
                      {word.categories.map(cat => (
                        <span key={cat} className="chip chip--secondary" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>{cat}</span>
                      ))}
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
    
    // Update on backend
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
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`chip ${selectedCategories.includes(cat.name) ? 'active' : 'chip--secondary'}`}
              style={selectedCategories.includes(cat.name) ? { background: cat.color, color: 'white' } : {}}
              onClick={() => toggleCategory(cat.name)}
            >
              {cat.name}
            </button>
          ))}
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