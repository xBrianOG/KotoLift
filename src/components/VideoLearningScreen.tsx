import { useRef, useState } from 'react';
import { fetchTranscript, type TranscriptSegment } from '../services/transcript';
import { extractVideoIdFromUrl } from '../utils/youtube';
import { SubtitleOverlay } from './SubtitleOverlay';
import { VideoPlayer, type VideoPlayerHandle } from './VideoPlayer';

interface VideoLearningScreenProps {
  onBack: () => void;
}

export function VideoLearningScreen({ onBack }: VideoLearningScreenProps) {
  const [url, setUrl] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [showInput, setShowInput] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [videoError, setVideoError] = useState<string | null>(null);

  const playerRef = useRef<VideoPlayerHandle>(null);

  const seekToSegment = (seg: TranscriptSegment) => {
    playerRef.current?.seekTo(seg.startMs / 1000);
    setCurrentTimeMs(seg.startMs);
  };

  const loadVideo = async () => {
    const id = extractVideoIdFromUrl(url);
    if (!id) {
      setError('Invalid URL');
      return;
    }

    setError(null);
    setVideoError(null);
    setVideoId(null);
    setSegments([]);
    setCurrentTimeMs(0);
    setLoading(true);
    setLoadingMessage('Loading transcript...');
    setShowInput(false);

    try {
      const result = await fetchTranscript(url, 'en');
      setVideoId(id);
      setSegments(result.segments);
      setLoadingMessage('Loading video...');
      // The VideoPlayer component initializes the YT.Player when videoId is set.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load transcript';
      if (message.includes('rate limited') || message.includes('429')) {
        setError('YouTube is rate limiting requests. Please wait a moment and try again.');
      } else if (message.includes('no transcript') || message.includes('not available')) {
        setError('No transcript available for this video. Try a different video with subtitles.');
      } else {
        setError(message);
      }
      setShowInput(true);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    if (!url.trim()) return;
    loadVideo();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  if (showInput) {
    return (
      <div
        className="screen"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-xl)',
        }}
      >
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            padding: 'var(--space-sm) var(--space-md)',
            border: 'none',
            background: 'transparent',
            color: 'var(--accent)',
            fontWeight: 600,
            fontSize: 'var(--font-base)',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>

        <h1
          style={{
            fontSize: 'var(--font-2xl)',
            fontWeight: 700,
            marginBottom: 'var(--space-sm)',
            color: 'var(--text)',
          }}
        >
          Video Learning
        </h1>
        <p
          style={{
            fontSize: 'var(--font-base)',
            color: 'var(--text-secondary)',
            maxWidth: 400,
            marginBottom: 'var(--space-xl)',
            textAlign: 'center',
          }}
        >
          Paste a video URL to start learning with interactive subtitles.
        </p>

        <div style={{ width: '100%', maxWidth: 500 }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://www.youtube.com/watch?v=..."
            style={{ width: '100%', marginBottom: 'var(--space-md)' }}
          />

          {error && (
            <div
              style={{
                padding: 'var(--space-md)',
                background: '#fef2f2',
                border: '1px solid #ef4444',
                borderRadius: 8,
                marginBottom: 'var(--space-md)',
                color: '#ef4444',
                fontSize: 'var(--font-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-sm)',
              }}
            >
              <span>{error}</span>
              <button
                onClick={loadVideo}
                style={{
                  padding: '6px 12px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 13,
                  cursor: 'pointer',
                  alignSelf: 'flex-start',
                }}
              >
                Retry
              </button>
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={!url.trim()}
            className="btn btn-primary"
            style={{ width: '100%', opacity: !url.trim() ? 0.6 : 1 }}
          >
            Start Learning
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="screen"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-xl)',
        }}
      >
        <button
          onClick={() => setShowInput(true)}
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            padding: 'var(--space-sm) var(--space-md)',
            border: 'none',
            background: 'transparent',
            color: 'var(--accent)',
            fontWeight: 600,
            fontSize: 'var(--font-base)',
            cursor: 'pointer',
          }}
        >
          ← Cancel
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-secondary)' }}>
            {loadingMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="screen"
      style={{ padding: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: 'var(--space-md) var(--space-lg)',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
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
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <span
          style={{
            flex: 1,
            textAlign: 'center',
            fontWeight: 600,
            fontSize: 'var(--font-base)',
            color: 'var(--text)',
          }}
        >
          Video Learning
        </span>
        <button
          onClick={() => {
            setShowInput(true);
            setVideoId(null);
          }}
          style={{
            padding: 'var(--space-xs) var(--space-md)',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            fontSize: 'var(--font-sm)',
            cursor: 'pointer',
          }}
        >
          New Video
        </button>
      </div>

      <div
        style={{
          position: 'relative',
          background: '#000',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {videoId ? (
          <>
            <VideoPlayer
              ref={playerRef}
              videoId={videoId}
              onTimeUpdate={(s) => setCurrentTimeMs(Math.round(s * 1000))}
              onError={setVideoError}
            />

            {videoError ? (
              <div
                style={{
                  padding: 20,
                  textAlign: 'center',
                  color: '#fff',
                  background: 'rgba(0,0,0,0.85)',
                }}
              >
                <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>{videoError}</p>
                <button
                  onClick={() => setShowInput(true)}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Try Another Video
                </button>
              </div>
            ) : segments.length > 0 ? (
              <SubtitleOverlay
                segments={segments}
                currentTimeMs={currentTimeMs}
                onSegmentClick={seekToSegment}
                onWordClick={() => { /* tooltip flow is server-side, not yet wired */ }}
              />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'rgba(0,0,0,0.9)',
                  padding: '20px',
                  textAlign: 'center',
                }}
              >
                <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>
                  No subtitles available for this video
                </p>
                <button
                  onClick={() => setShowInput(true)}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Try Another Video
                </button>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <p style={{ marginBottom: 16 }}>Failed to load video</p>
            <button
              onClick={() => setShowInput(true)}
              style={{
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 6,
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
