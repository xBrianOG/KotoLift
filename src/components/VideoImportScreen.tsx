import { useState } from 'react';
import { analyzeVideo, VideoSegment } from '../services/api';
import { createCard } from '../services/cards';
import { ensureReviewStates } from '../services/review';

interface VideoImportScreenProps {
  onComplete: (createdCount: number) => void;
  onCancel: () => void;
  onViewTranscript?: (data: { url: string; title: string; segments: VideoSegment[] }) => void;
}

export function VideoImportScreen({ onComplete, onCancel, onViewTranscript }: VideoImportScreenProps) {
  const [url, setUrl] = useState('');
  const [lang, setLang] = useState('ja');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Please enter a video URL');
      return;
    }

    setLoading(true);
    setError(null);
    setSegments([]);
    setSelected(new Set());

    try {
      const result = await analyzeVideo(url, lang);
      setSegments(result.segments);
      setTitle(result.title || 'Video');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewTranscript = () => {
    if (onViewTranscript && segments.length > 0) {
      onViewTranscript({ url, title, segments });
    }
  };

  const toggleSegment = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleAll = () => {
    if (selected.size === segments.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(segments.map(s => s.id)));
    }
  };

  const handleCreateCards = async () => {
    if (selected.size === 0) {
      setError('Please select at least one segment');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const selectedSegments = segments.filter(s => selected.has(s.id));
      let createdCount = 0;

      for (const seg of selectedSegments) {
        const card = await createCard(
          seg.text,
          '',
          '',
          ['imported'],
          `Imported from video`
        );
        await ensureReviewStates(card);
        createdCount++;
      }

      onComplete(createdCount);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create cards';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen" style={{ 
      padding: 'var(--space-xl)',
      paddingTop: 'calc(env(safe-area-inset-top) + var(--space-xl))'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <button 
          onClick={onCancel}
          style={{ 
            padding: 'var(--space-sm) var(--space-md)', 
            border: 'none', 
            background: 'transparent',
            color: 'var(--accent)',
            fontWeight: 600,
            fontSize: 'var(--font-base)'
          }}
        >
          ← Back
        </button>
        <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600 }}>Import from Video</h2>
      </div>

      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--space-sm)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
          Video URL
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          style={{ width: '100%' }}
          disabled={loading}
        />
      </div>

      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--space-sm)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
          Language
        </label>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          style={{ width: '100%' }}
          disabled={loading}
        >
          <option value="ja">Japanese</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="ko">Korean</option>
        </select>
      </div>

      <button 
        className="primaryButton"
        onClick={handleAnalyze}
        disabled={loading || !url.trim()}
        style={{ width: '100%', marginBottom: 'var(--space-lg)' }}
      >
        {loading ? 'Analyzing...' : 'Analyze'}
      </button>

      {error && (
        <div style={{ 
          padding: 'var(--space-md)', 
          background: 'var(--error-bg, #fef2f2)', 
          borderRadius: 8,
          color: 'var(--error)',
          marginBottom: 'var(--space-lg)',
          fontSize: 'var(--font-sm)'
        }}>
          {error}
        </div>
      )}

      {segments.length > 0 && onViewTranscript && (
        <button 
          onClick={handleViewTranscript}
          style={{ 
            width: '100%',
            marginBottom: 'var(--space-md)',
            padding: 'var(--space-md)',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 'var(--font-base)',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          📖 View Full Transcript
        </button>
      )}

      {segments.length > 0 && (
        <>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 'var(--space-md)' 
          }}>
            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
              {selected.size} of {segments.length} selected
            </span>
            <button 
              onClick={toggleAll}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'var(--accent)',
                fontSize: 'var(--font-sm)',
                cursor: 'pointer'
              }}
            >
              {selected.size === segments.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div style={{ 
            maxHeight: '40vh', 
            overflowY: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 8,
            marginBottom: 'var(--space-lg)'
          }}>
            {segments.map((seg) => (
              <label
                key={seg.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-sm)',
                  padding: 'var(--space-md)',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: selected.has(seg.id) ? 'var(--selected-bg, #f0f9ff)' : 'transparent'
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(seg.id)}
                  onChange={() => toggleSegment(seg.id)}
                  style={{ marginTop: 4 }}
                />
                <span style={{ fontSize: 'var(--font-sm)', lineHeight: 1.5 }}>
                  {seg.text}
                </span>
              </label>
            ))}
          </div>

          <button
            className="primaryButton"
            onClick={handleCreateCards}
            disabled={saving || selected.size === 0}
            style={{ width: '100%' }}
          >
            {saving ? 'Creating cards...' : `Create ${selected.size} card${selected.size !== 1 ? 's' : ''}`}
          </button>
        </>
      )}
    </div>
  );
}
