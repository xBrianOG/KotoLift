import { useState } from 'react';
import { analyzeVideo, VideoSegment, translateText, type SupportedLang } from '../services/api';
import { createCard } from '../services/cards';
import { ensureReviewStates } from '../services/review';
import { getLearningSettings } from '../services/settings';

interface VideoImportScreenProps {
  onComplete: (createdCount: number) => void;
  onCancel: () => void;
  onViewTranscript?: (data: { url: string; title: string; segments: VideoSegment[]; sourceLang: string }) => void;
  onOpenPlayer?: (data: { url: string; title: string; segments: VideoSegment[]; sourceLang: string }) => void;
}

export function VideoImportScreen({ onComplete, onCancel, onViewTranscript, onOpenPlayer }: VideoImportScreenProps) {
  const [url, setUrl] = useState('');
  const [lang, setLang] = useState('en');
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
      const settings = getLearningSettings();
      const result = await analyzeVideo(url, lang, settings.preferWhisper);
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
      onViewTranscript({ url, title, segments, sourceLang: lang });
    }
  };

  const handleOpenPlayer = () => {
    if (onOpenPlayer && segments.length > 0) {
      onOpenPlayer({ url, title, segments, sourceLang: lang });
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

      const sourceLang = lang as SupportedLang;
      const targetLangs: SupportedLang[] = sourceLang === 'en' 
        ? ['es', 'ja'] 
        : sourceLang === 'es' 
          ? ['en', 'ja'] 
          : ['en', 'es'];

      for (const seg of selectedSegments) {
        // Translate to other languages
        const translations: Record<string, string> = {};
        await Promise.all(
          targetLangs.map(async (tlang) => {
            try {
              translations[tlang] = await translateText(seg.text, sourceLang, tlang);
            } catch (e) {
              console.error('Translation error:', e);
              translations[tlang] = '(translation failed)';
            }
          })
        );

        const card = await createCard(
          seg.text,
          translations.en || '',
          translations.es || '',
          ['imported'],
          `Imported from video`,
          sourceLang,
          undefined,
          seg.startMs,
          seg.endMs,
          translations.ja || ''
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
    <div className="screen animate-fade-in" style={{ paddingBottom: '120px' }}>
      <div className="flex-center mb-xl" style={{ justifyContent: 'flex-start' }}>
        <button 
          onClick={onCancel}
          className="btn-subtle"
          style={{ 
            padding: 'var(--space-sm) var(--space-md)', 
            marginRight: 'var(--space-sm)',
            borderRadius: 'var(--radius-round)'
          }}
        >
          ← Back
        </button>
        <h2 className="text-2xl font-bold">Import from Video</h2>
      </div>

      <div className="mb-lg">
        <label className="block mb-xs text-sm font-semibold text-secondary">
          Video URL
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={loading}
        />
      </div>

      <div className="mb-lg">
        <label className="block mb-xs text-sm font-semibold text-secondary">
          Language
        </label>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          disabled={loading}
        >
          <option value="en">English</option>
          <option value="ja">Japanese</option>
          <option value="es">Spanish</option>
        </select>
      </div>

      <button 
        className="btn btn-primary btn-full mb-lg animate-pulse delay-100"
        onClick={handleAnalyze}
        disabled={loading || !url.trim()}
      >
        {loading ? 'Analyzing...' : 'Analyze'}
      </button>

      {error && (
        <div className="card mb-lg" style={{ background: 'var(--error-bg, #fef2f2)', color: 'var(--error)', borderColor: 'var(--error)' }}>
          {error}
        </div>
      )}

      {segments.length > 0 && onViewTranscript && (
        <button 
          onClick={handleViewTranscript}
          className="btn btn-secondary btn-full mb-md"
        >
          📖 View Full Transcript
        </button>
      )}

      {segments.length > 0 && onOpenPlayer && (
        <button 
          onClick={handleOpenPlayer}
          className="btn btn-secondary btn-full mb-md"
        >
          ▶️ Open Video Player
        </button>
      )}

      {segments.length > 0 && (
        <div className="animate-slide-down delay-200">
          <div className="flex-between mb-md">
            <span className="text-sm font-medium text-secondary">
              {selected.size} of {segments.length} selected
            </span>
            <button 
              onClick={toggleAll}
              className="text-sm font-semibold text-accent cursor-pointer bg-transparent border-none"
            >
              {selected.size === segments.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="card p-0 overflow-hidden mb-lg" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
            <div className="flex-col divide-y divide-border">
              {segments.map((seg) => (
                <label
                  key={seg.id}
                  className={`flex items-start gap-sm p-md cursor-pointer transition-fast ${selected.has(seg.id) ? 'bg-accent-light' : 'hover:bg-surface'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(seg.id)}
                    onChange={() => toggleSegment(seg.id)}
                    style={{ marginTop: 4 }}
                  />
                  <span className="text-sm leading-relaxed">
                    {seg.text}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="review-bottom-bar animate-slide-down">
            <button
              className="btn btn-success btn-full"
              onClick={handleCreateCards}
              disabled={saving || selected.size === 0}
            >
              {saving ? 'Creating cards...' : `Create ${selected.size} card${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
