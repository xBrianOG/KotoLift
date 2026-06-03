import { useRef, useState } from 'react';
import { createCard, getAllCards } from '../services/cards';
import { ensureReviewStates } from '../services/review';
import { translateText, type SupportedLang } from '../services/api';
import { extractVideoIdFromUrl } from '../utils/youtube';
import { VideoPlayer, type VideoPlayerHandle } from './VideoPlayer';
import { SubtitleOverlay } from './SubtitleOverlay';

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
  videoId?: string;
}

interface VideoPlayerScreenProps {
  data: VideoPlayerData;
  onBack: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function VideoPlayerScreen({ data, onBack }: VideoPlayerScreenProps) {
  const [search, setSearch] = useState('');
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [selectedSegment, setSelectedSegment] = useState<TranscriptSegment | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const playerRef = useRef<VideoPlayerHandle>(null);

  const videoId = data.videoId ?? extractVideoIdFromUrl(data.url);
  const sourceLang = data.sourceLang as SupportedLang;
  const targetLangs: SupportedLang[] = sourceLang === 'en'
    ? ['es', 'ja']
    : sourceLang === 'es'
      ? ['en', 'ja']
      : ['en', 'es'];

  const filteredSegments = search.trim()
    ? data.segments.filter((s) => s.text.toLowerCase().includes(search.toLowerCase()))
    : data.segments;

  const currentSegmentIndex = filteredSegments.findIndex(
    (seg) => currentTimeMs >= seg.startMs && currentTimeMs < seg.endMs,
  );
  const currentSegment = currentSegmentIndex >= 0 ? filteredSegments[currentSegmentIndex] : null;

  const seekToSegment = (seg: TranscriptSegment) => {
    playerRef.current?.seekTo(seg.startMs / 1000);
    setSelectedSegment(seg);
  };

  const checkDuplicate = async (_url: string, _startMs: number, text: string): Promise<boolean> => {
    const cards = await getAllCards();
    return cards.some((c) => c.sourceText === text);
  };

  const handleCreateCard = async () => {
    if (!selectedSegment) return;
    if (savingIds.has(selectedSegment.id)) return;

    const isDup = await checkDuplicate(data.url, selectedSegment.startMs, selectedSegment.text);
    if (isDup) {
      setSavedIds((prev) => new Set(prev).add(selectedSegment.id));
      setShowConfirmModal(false);
      setSelectedSegment(null);
      return;
    }

    setSavingIds((prev) => new Set(prev).add(selectedSegment.id));

    try {
      const translations: Record<string, string> = {};
      await Promise.all(
        targetLangs.map(async (lang) => {
          try {
            translations[lang] = await translateText(selectedSegment.text, sourceLang, lang);
          } catch {
            translations[lang] = '(translation failed)';
          }
        }),
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
        translations.ja || '',
      );

      await ensureReviewStates(card);

      setSavedIds((prev) => new Set(prev).add(selectedSegment.id));
      setShowConfirmModal(false);
      setSelectedSegment(null);
    } catch (err) {
      console.error('Failed to save card:', err);
    } finally {
      setSavingIds((prev) => {
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
      <div
        className="screen"
        style={{
          padding: 'var(--space-xl)',
          paddingTop: 'calc(env(safe-area-inset-top) + var(--space-xl))',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-md)',
            marginBottom: 'var(--space-xl)',
          }}
        >
          <button
            onClick={onBack}
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              border: 'none',
              background: 'transparent',
              color: 'var(--accent)',
              fontWeight: 600,
              fontSize: 'var(--font-base)',
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
    <div
      className="screen"
      style={{
        padding: 'var(--space-xl)',
        paddingTop: 'calc(env(safe-area-inset-top) + var(--space-xl))',
        minHeight: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-md)',
        }}
      >
        <button
          onClick={onBack}
          style={{
            padding: 'var(--space-sm) var(--space-md)',
            border: 'none',
            background: 'transparent',
            color: 'var(--accent)',
            fontWeight: 600,
            fontSize: 'var(--font-base)',
          }}
        >
          ← Back
        </button>
        <h2
          style={{
            fontSize: 'var(--font-lg)',
            fontWeight: 600,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.title}
        </h2>
        <button
          onClick={() => playerRef.current?.[isPlaying ? 'pause' : 'play']()}
          className="btn btn-subtle"
          style={{ padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--font-sm)' }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>

      <div style={{ marginBottom: 'var(--space-md)', position: 'relative' }}>
        <VideoPlayer
          ref={playerRef}
          videoId={videoId}
          onTimeUpdate={(s) => setCurrentTimeMs(Math.round(s * 1000))}
          onPlayStateChange={setIsPlaying}
          onError={setVideoError}
        />
        <SubtitleOverlay
          segments={filteredSegments}
          currentTimeMs={currentTimeMs}
          onSegmentClick={seekToSegment}
        />
      </div>

      {videoError && (
        <div
          className="card"
          style={{
            borderColor: 'var(--danger)',
            color: 'var(--danger)',
            marginBottom: 'var(--space-md)',
            fontSize: 'var(--font-sm)',
          }}
        >
          {videoError}
        </div>
      )}

      {currentSegment && (
        <div
          style={{
            padding: 'var(--space-md)',
            background: 'var(--bg-card)',
            borderRadius: 8,
            marginBottom: 'var(--space-md)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-sm)',
            }}
          >
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
                cursor: savedIds.has(currentSegment.id) ? 'default' : 'pointer',
              }}
            >
              {savedIds.has(currentSegment.id) ? '✓ Saved' : '+ Card'}
            </button>
          </div>
          <p style={{ fontSize: 'var(--font-base)', lineHeight: 1.5 }}>{currentSegment.text}</p>
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-md)' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transcript..."
          style={{ width: '100%' }}
        />
      </div>

      <div
        style={{
          maxHeight: '40vh',
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--bg-card)',
          marginBottom: '40px',
          flexShrink: 0,
        }}
      >
        {filteredSegments.map((seg) => (
          <div
            key={seg.id}
            onClick={() => seekToSegment(seg)}
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              background: currentSegment?.id === seg.id ? 'var(--selected-bg, #f0f9ff)' : 'transparent',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--font-xs)',
                  color: 'var(--text-secondary)',
                  minWidth: 50,
                }}
              >
                {formatTime(seg.startMs)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveClick(seg);
                }}
                disabled={savedIds.has(seg.id)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: 'none',
                  background: savedIds.has(seg.id) ? 'var(--success)' : 'var(--accent)',
                  color: 'white',
                  fontSize: 'var(--font-xs)',
                  cursor: savedIds.has(seg.id) ? 'default' : 'pointer',
                  opacity: savedIds.has(seg.id) ? 0.7 : 1,
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

      {showConfirmModal && selectedSegment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 100,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 500,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <h3 style={{ marginBottom: 16 }}>Create Card</h3>

            <div style={{ marginBottom: 16 }}>
              <span className="lang-badge">{sourceLang.toUpperCase()}</span>
              <p
                style={{
                  marginTop: 8,
                  fontSize: 'var(--font-base)',
                  lineHeight: 1.5,
                }}
              >
                {selectedSegment.text}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedSegment(null);
                }}
                style={{
                  flex: 1,
                  padding: 'var(--space-md)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-base)',
                  cursor: 'pointer',
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
