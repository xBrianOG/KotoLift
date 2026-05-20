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
}

interface VocabularyScreenProps {
  onBack: () => void;
}

const LEVELS = [
  { key: 'all', label: 'All' },
  { key: 'B1', label: 'B1' },
  { key: 'B2', label: 'B2' }
];

const PARTS_OF_SPEECH = ['all', 'noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction'];

export function VocabularyScreen({ onBack }: VocabularyScreenProps) {
  const [vocabulary, setVocabulary] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterPos, setFilterPos] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const LIMIT = 30;

  useEffect(() => {
    setPage(0);
    setVocabulary([]);
    setHasMore(true);
  }, [filterLevel, filterPos]);

  useEffect(() => {
    fetchVocabulary(true);
  }, [filterLevel, filterPos]);

  const fetchVocabulary = async (reset = false) => {
    if (!hasMore && !reset) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filterLevel !== 'all') params.append('level', filterLevel);
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchVocabulary(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('q', searchQuery);
      if (filterLevel !== 'all') params.append('level', filterLevel);

      const res = await fetch(`${API_BASE}/api/vocabulary/search?${params}`, {
        headers: { ...getAuthHeaders() }
      });

      const data = await res.json();
      setVocabulary(data.vocabulary || []);
      setHasMore(false);
    } catch (err) {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  if (selectedWord) {
    return (
      <WordDetail word={selectedWord} onBack={() => setSelectedWord(null)} />
    );
  }

  return (
    <div className="screen animate-fade-in" style={{ padding: 'var(--space-xl)' }}>
      <div className="mb-lg">
        <h1 className="text-2xl font-bold mb-xs">Vocabulary</h1>
        <p className="text-secondary text-sm">B1-B2 English vocabulary</p>
      </div>

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
        <button className="btn btn-primary" onClick={handleSearch}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

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
      </div>

      <div className="flex gap-sm mb-lg" style={{ overflowX: 'auto', paddingBottom: 'var(--space-sm)' }}>
        {PARTS_OF_SPEECH.map(pos => (
          <button
            key={pos}
            className={`chip ${filterPos === pos ? 'active' : ''}`}
            onClick={() => setFilterPos(pos)}
            style={{ fontSize: 'var(--font-xs)' }}
          >
            {pos === 'all' ? 'All' : pos.charAt(0).toUpperCase() + pos.slice(1)}
          </button>
        ))}
      </div>

      {loading && vocabulary.length === 0 ? (
        <div className="text-center" style={{ padding: 'var(--space-xl)' }}>
          <p>Loading vocabulary...</p>
        </div>
      ) : error ? (
        <div className="text-center" style={{ padding: 'var(--space-xl)' }}>
          <p className="text-error">{error}</p>
          <button className="btn btn-secondary mt-md" onClick={() => fetchVocabulary(true)}>Retry</button>
        </div>
      ) : vocabulary.length === 0 ? (
        <div className="text-center" style={{ padding: 'var(--space-xl)' }}>
          <p className="text-secondary">No words found</p>
          <p className="text-secondary text-sm mt-sm">Try a different search or filter</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
            {vocabulary.map(word => (
              <div
                key={word.id}
                className="card card-clickable"
                onClick={() => setSelectedWord(word)}
                style={{ padding: 'var(--space-md)' }}
              >
                <div className="flex-between">
                  <div style={{ flex: 1 }}>
                    <div className="flex gap-sm mb-xs">
                      <span className="font-semibold">{word.word}</span>
                      {word.phonetic && (
                        <span className="text-secondary text-sm">{word.phonetic}</span>
                      )}
                    </div>
                    <div className="flex gap-sm">
                      <span className="chip chip--small">{word.level}</span>
                      <span className="chip chip--small chip--secondary">{word.part_of_speech}</span>
                    </div>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" style={{ width: 20, height: 20 }}>
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-lg">
              <button
                className="btn btn-secondary"
                onClick={() => { setPage(p => p + 1); fetchVocabulary(false); }}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface WordDetailProps {
  word: VocabularyWord;
  onBack: () => void;
}

function WordDetail({ word, onBack }: WordDetailProps) {
  return (
    <div className="screen animate-fade-in" style={{ padding: 'var(--space-xl)' }}>
      <div className="flex-between mb-lg">
        <button onClick={onBack} className="btn btn-secondary">
          Back
        </button>
        <div className="flex gap-sm">
          <span className="chip">{word.level}</span>
          <span className="chip chip--secondary">{word.part_of_speech}</span>
        </div>
      </div>

      <div className="text-center mb-lg">
        <h1 className="text-3xl font-bold mb-sm">{word.word}</h1>
        {word.phonetic && (
          <p className="text-secondary text-lg">{word.phonetic}</p>
        )}
      </div>

      <div className="card mb-lg">
        <h2 className="font-semibold mb-md">Translations</h2>
        <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
          {word.translations?.map((t, i) => (
            <span key={i} className="chip">{t}</span>
          )) || <span className="text-secondary">No translations available</span>}
        </div>
      </div>

      {word.example_sentences && word.example_sentences.length > 0 && (
        <div className="card mb-lg">
          <h2 className="font-semibold mb-md">Example Sentences</h2>
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            {word.example_sentences.map((sentence, i) => (
              <div key={i} className="text-secondary" style={{ lineHeight: 1.6 }}>
                "{sentence}"
              </div>
            ))}
          </div>
        </div>
      )}

      {word.collocations && word.collocations.length > 0 && (
        <div className="card mb-lg">
          <h2 className="font-semibold mb-md">Collocations</h2>
          <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
            {word.collocations.map((c, i) => (
              <span key={i} className="chip chip--secondary">{c}</span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="text-secondary text-sm">Frequency Rank</div>
        <div className="font-semibold">#{word.frequency || 'N/A'}</div>
      </div>
    </div>
  );
}