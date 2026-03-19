import { useState } from 'react';
import { analyzeVideo, VideoSegment, translateText, type SupportedLang } from '../services/api';
import { ensureReviewStates } from '../services/review';
import { getLearningSettings } from '../services/settings';
import { v4 as uuidv4 } from 'uuid';

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
  const [analysisMethod, setAnalysisMethod] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Please enter a video URL');
      return;
    }

    setLoading(true);
    setError(null);
    setSegments([]);
    setSelected(new Set());
    setAnalysisMethod(null);

    try {
      const settings = getLearningSettings();
      const result = await analyzeVideo(url, lang, settings.preferWhisper);
      setSegments(result.segments);
      setTitle(result.title || 'Video');
      if (result.method) {
        setAnalysisMethod(result.method);
      }
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
      const sourceLang = lang as SupportedLang;
      const targetLangs: SupportedLang[] = sourceLang === 'en'
        ? ['es', 'ja']
        : sourceLang === 'es'
          ? ['en', 'ja']
          : ['en', 'es'];

      // Batch all translations in parallel
      const translatedSegments = await Promise.all(
        selectedSegments.map(async (seg) => {
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
          return { seg, translations };
        })
      );

      // Build card objects
      const now = Date.now();
      const cards = translatedSegments.map(({ seg, translations }, i) => ({
        id: uuidv4(),
        sourceText: seg.text,
        sourceLang,
        translations: {
          en: translations.en || undefined,
          es: translations.es || undefined,
          ja: translations.ja || undefined,
        },
        jaText: sourceLang === 'ja' ? seg.text : (translations.ja || ''),
        enText: sourceLang === 'en' ? seg.text : (translations.en || ''),
        esText: sourceLang === 'es' ? seg.text : (translations.es || ''),
        tags: ['imported'],
        notes: `Imported from video`,
        sourceUrl: url,
        startMs: seg.startMs,
        endMs: seg.endMs,
        createdAt: now + i,
      }));

      // Bulk write cards, then set up review states
      const { db } = await import('../db');
      await db.cards.bulkAdd(cards);
      await Promise.all(cards.map(card => ensureReviewStates(card as any)));

      onComplete(cards.length);
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
        {loading ? 'Transcribing...' : 'Analyze'}
      </button>

      {loading && (
        <div style={{ 
          marginBottom: 'var(--space-md)', 
          padding: 'var(--space-sm) var(--space-md)', 
          background: 'var(--surface)', 
          borderRadius: 8,
          fontSize: 'var(--font-xs)',
          color: 'var(--text-secondary)',
          textAlign: 'center'
        }}>
          Getting video transcription...
        </div>
      )}

      {error && (
        <div className="card mb-lg" style={{ background: 'var(--error-bg, #fef2f2)', color: 'var(--error)', borderColor: 'var(--error)' }}>
          {error.includes('TRANSCRIPTION_FAILED') || error.includes('couldn\'t be transcribed')
            ? 'This video couldn\'t be transcribed. Try a different video.'
            : error}
        </div>
      )}

      {analysisMethod && (
        <div style={{ 
          marginBottom: 'var(--space-md)', 
          padding: 'var(--space-sm) var(--space-md)', 
          background: 'var(--accent-bg, #f0f9ff)', 
          borderRadius: 8,
          fontSize: 'var(--font-xs)',
          color: 'var(--accent)'
        }}>
          ✓ {analysisMethod}
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

          <div className="card p-0 overflow-hidden mb-lg" style={{ maxHeight: '40vh', overflowY: 'auto', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  onClick={() => toggleSegment(seg.id)}
                  ref={(el) => {
                    if (el && seg.id === segments[0]?.id) {
                      // @ts-ignore
                      window.debug_layout_info = window.debug_layout_info || [];
                      const cb = el.querySelector('input[type="checkbox"]');
                      if (cb) {
                        const style = window.getComputedStyle(cb);
                        const cstyle = window.getComputedStyle(el);
                        // @ts-ignore
                        window.debug_layout_info.push({
                           html: el.outerHTML,
                           containerDisplay: cstyle.display,
                           containerDirection: cstyle.flexDirection,
                           checkboxDisplay: style.display,
                           checkboxMargin: style.margin,
                           checkboxWidth: style.width
                        });
                      }
                    }
                  }}
                  className={`cursor-pointer transition-normal ${selected.has(seg.id) ? 'bg-accent-light' : 'hover:bg-surface'}`}
                  style={{
                    position: 'relative',
                    padding: '16px',
                    paddingRight: '64px', // Space for the absolute checkbox
                    borderBottom: '1px solid var(--border-light)',
                    width: '100%',
                    minHeight: '64px'
                  }}
                >
                  <span style={{ 
                    display: 'block', 
                    color: selected.has(seg.id) ? 'var(--text)' : 'var(--text-secondary)', 
                    fontSize: '16px', 
                    lineHeight: '1.625' 
                  }}>
                    {seg.text}
                  </span>
                  
                  <div style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <input
                      type="checkbox"
                      checked={selected.has(seg.id)}
                      readOnly
                      style={{ 
                        width: '24px', 
                        height: '24px', 
                        margin: 0,
                        cursor: 'pointer', 
                        accentColor: 'var(--primary)',
                        borderRadius: '6px',
                        border: '2px solid var(--border)',
                        pointerEvents: 'none'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: 'var(--space-md) 0' }} className="animate-slide-down">
            <button
              className="btn btn-primary btn-full"
              style={{ padding: '16px', fontSize: '18px', borderRadius: '12px' }}
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
