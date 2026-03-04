import { useState, useRef, useEffect } from 'react';
import { createCard } from '../services/cards';
import { ensureReviewStates } from '../services/review';
import { translateText, type SupportedLang } from '../services/api';
import { db } from '../db';

export interface TranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface VideoPlayerData {
  url: string;
  title: string;
  segments: TranscriptSegment[];
  sourceLang: string;
}

interface VideoPlayerScreenProps {
  data: VideoPlayerData;
  onBack: () => void;
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function VideoPlayerScreen({ data, onBack }: VideoPlayerScreenProps) {
  const [search, setSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [selectedSegment, setSelectedSegment] = useState<TranscriptSegment | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const playerRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const videoId = extractVideoId(data.url);
  const sourceLang = data.sourceLang as SupportedLang;
  const targetLangs: SupportedLang[] = sourceLang === 'en' 
    ? ['es', 'ja'] 
    : sourceLang === 'es' 
      ? ['en', 'ja'] 
      : ['en', 'es'];

  const filteredSegments = search.trim()
    ? data.segments.filter(s => s.text.toLowerCase().includes(search.toLowerCase()))
    : data.segments;

  const currentSegmentIndex = filteredSegments.findIndex(
    seg => currentTime >= seg.startMs && currentTime < seg.endMs
  );

  const currentSegment = currentSegmentIndex >= 0 ? filteredSegments[currentSegmentIndex] : null;

  useEffect(() => {
    if (!playerRef.current) return;
    
    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        try {
          const time = playerRef.current.getCurrentTime();
          setCurrentTime(time * 1000);
        } catch (e) {
          // Ignore errors
        }
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [playing]);

  const seekTo = (ms: number) => {
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(ms / 1000, true);
    }
  };

  const checkDuplicate = async (url: string, startMs: number, text: string): Promise<boolean> => {
    const existing = await db.cards.where('sourceUrl').equals(url).toArray();
    return existing.some(c => c.startMs === startMs && c.sourceText === text);
  };

  const handleSegmentClick = (seg: TranscriptSegment) => {
    seekTo(seg.startMs);
    setSelectedSegment(seg);
  };

  const handleCreateCard = async () => {
    if (!selectedSegment) return;
    
    if (savingIds.has(selectedSegment.id)) return;
    
    const isDup = await checkDuplicate(data.url, selectedSegment.startMs, selectedSegment.text);
    if (isDup) {
      setSavedIds(prev => new Set(prev).add(selectedSegment.id));
      setShowConfirmModal(false);
      setSelectedSegment(null);
      return;
    }
    
    setSavingIds(prev => new Set(prev).add(selectedSegment.id));
    
    try {
      const translations: Record<string, string> = {};
      
      await Promise.all(
        targetLangs.map(async (lang) => {
          try {
            translations[lang] = await translateText(selectedSegment.text, sourceLang, lang);
          } catch (e) {
            translations[lang] = '(translation failed)';
          }
        })
      );

      const card = await createCard(
        selectedSegment.text,
        translations.en || '',
        translations.es || '',
        ['imported'],
        `Video: ${data.title}`,
        sourceLang,
        data.url,
        selectedSegment.startMs,
        selectedSegment.endMs,
        translations.ja || ''
      );
      
      await ensureReviewStates(card);
      
      setSavedIds(prev => new Set(prev).add(selectedSegment.id));
      setShowConfirmModal(false);
      setSelectedSegment(null);
    } catch (err) {
      console.error('Failed to save card:', err);
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(selectedSegment.id);
        return next;
      });
    }
  };

  const handleSaveClick = (seg: TranscriptSegment) => {
    setSelectedSegment(seg);
    setShowConfirmModal(true);
  };

  if (!videoId) {
    return (
      <div className="screen" style={{ padding: 'var(--space-xl)', paddingTop: 'calc(env(safe-area-inset-top) + var(--space-xl))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
          <button 
            onClick={onBack}
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
        </div>
        <p>Invalid video URL</p>
      </div>
    );
  }

  return (
    <div className="screen" style={{ 
      padding: 'var(--space-xl)',
      paddingTop: 'calc(env(safe-area-inset-top) + var(--space-xl))',
      minHeight: '100%'
    }}>
      {/* Header - Sticky at top */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 'var(--space-md)', 
        marginBottom: 'var(--space-md)', 
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'var(--bg-primary)',
        paddingTop: 'var(--space-sm)'
      }}>
        <button 
          onClick={onBack}
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
        <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.title}
        </h2>
      </div>

      {/* Video Player - Sticky below header */}
      <div style={{ position: 'sticky', top: 60, zIndex: 15, background: 'var(--bg-primary)', paddingTop: 'var(--space-sm)' }}>
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
          <iframe
            ref={iframeRef}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>

      {/* Current Segment Info - Sticky below video */}
      {currentSegment && (
        <div style={{ 
          position: 'sticky',
          top: 280,
          zIndex: 10,
          padding: 'var(--space-md)', 
          background: 'var(--bg-card)', 
          borderRadius: 8,
          marginBottom: 'var(--space-md)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
              {formatTime(currentSegment.startMs)} - {formatTime(currentSegment.endMs)}
            </span>
            <button
              onClick={() => handleSaveClick(currentSegment)}
              disabled={savedIds.has(currentSegment.id)}
              style={{
                padding: '4px 12px',
                borderRadius: 4,
                border: 'none',
                background: savedIds.has(currentSegment.id) ? 'var(--success)' : 'var(--accent)',
                color: 'white',
                fontSize: 'var(--font-sm)',
                cursor: savedIds.has(currentSegment.id) ? 'default' : 'pointer'
              }}
            >
              {savedIds.has(currentSegment.id) ? '✓ Saved' : '+ Card'}
            </button>
          </div>
          <p style={{ fontSize: 'var(--font-base)', lineHeight: 1.5 }}>{currentSegment.text}</p>
        </div>
      )}

      {/* Search - Sticky below current segment */}
      <div style={{ position: 'sticky', top: 380, zIndex: 5, background: 'var(--bg-primary)', padding: 'var(--space-sm) 0' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transcript..."
          style={{ width: '100%' }}
        />
      </div>

      {/* Transcript List - Contained in fixed box */}
      <div style={{ 
        maxHeight: '40vh', 
        overflowY: 'auto', 
        border: '1px solid var(--border)', 
        borderRadius: 8,
        background: 'var(--bg-card)'
      }}>
        {filteredSegments.map((seg) => (
          <div
            key={seg.id}
            onClick={() => handleSegmentClick(seg)}
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              background: currentSegment?.id === seg.id ? 'var(--selected-bg, #f0f9ff)' : 'transparent'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', minWidth: 50 }}>
                {formatTime(seg.startMs)}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleSaveClick(seg); }}
                disabled={savedIds.has(seg.id)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: 'none',
                  background: savedIds.has(seg.id) ? 'var(--success)' : 'var(--accent)',
                  color: 'white',
                  fontSize: 'var(--font-xs)',
                  cursor: savedIds.has(seg.id) ? 'default' : 'pointer',
                  opacity: savedIds.has(seg.id) ? 0.7 : 1
                }}
              >
                {savedIds.has(seg.id) ? '✓' : '+'}
              </button>
            </div>
            <p style={{ fontSize: 'var(--font-sm)', marginTop: 4, lineHeight: 1.4 }}>
              {seg.text}
            </p>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && selectedSegment && (
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
            <h3 style={{ marginBottom: 16 }}>Create Card</h3>
            
            <div style={{ marginBottom: 16 }}>
              <span className="lang-badge">{sourceLang.toUpperCase()}</span>
              <p style={{ marginTop: 8, fontSize: 'var(--font-base)', lineHeight: 1.5 }}>
                {selectedSegment.text}
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <button
                onClick={() => { setShowConfirmModal(false); setSelectedSegment(null); }}
                style={{
                  flex: 1,
                  padding: 'var(--space-md)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-base)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCard}
                disabled={savingIds.has(selectedSegment.id)}
                className="primaryButton"
                style={{ flex: 1 }}
              >
                {savingIds.has(selectedSegment.id) ? 'Saving...' : 'Create Card'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
