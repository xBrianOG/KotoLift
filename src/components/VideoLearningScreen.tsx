import { useEffect, useRef, useState } from 'react';
import { fetchTranscript, type TranscriptSegment } from '../services/transcript';
import { SubtitleOverlay } from './SubtitleOverlay';

interface VideoLearningScreenProps {
  onBack: () => void;
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
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
  const [selectedSegment, setSelectedSegment] = useState<TranscriptSegment | null>(null);
  const [wordTooltip, setWordTooltip] = useState<{ word: string; segment: TranscriptSegment; position: { x: number; y: number } } | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<any>(null);
  const pollRef = useRef<number | null>(null);

  const POLL_INTERVAL = 250;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (playerRef.current?.destroy) {
        try { playerRef.current.destroy(); } catch {}
      }
    };
  }, []);

  const initYouTubePlayer = (id: string) => {
    if (typeof window.YT === 'undefined') {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onload = () => createPlayer(id);
      document.head.appendChild(tag);
    } else {
      createPlayer(id);
    }
  };

  const createPlayer = (id: string) => {
    if (!iframeRef.current) return;
    
    playerRef.current = new window.YT.Player(iframeRef.current, {
      videoId: id,
      events: {
        onReady: () => {
          console.log('[VideoLearning] Player ready');
          startPolling();
        },
        onError: (e: any) => {
          console.error('[VideoLearning] Player error:', e);
        }
      },
      playerVars: {
        enablejsapi: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1
      }
    });
  };

  const startPolling = () => {
    if (pollRef.current) return;
    
    pollRef.current = window.setInterval(() => {
      try {
        if (playerRef.current?.getCurrentTime) {
          const timeSeconds = playerRef.current.getCurrentTime();
          setCurrentTimeMs(Math.round(timeSeconds * 1000));
        }
      } catch {}
    }, POLL_INTERVAL);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const loadVideo = async () => {
    const id = extractVideoId(url);
    if (!id) {
      setError('Invalid URL');
      return;
    }

    stopPolling();
    if (playerRef.current?.destroy) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }

    setError(null);
    setVideoId(null);
    setSegments([]);
    setLoading(true);
    setLoadingMessage('Loading transcript...');
    setShowInput(false);

    try {
      console.log('[VideoLearning] Fetching transcript for:', id);
      const result = await fetchTranscript(url, 'en');
      
      setVideoId(id);
      setSegments(result.segments);
      setLoadingMessage('Loading video...');
      initYouTubePlayer(id);
    } catch (err) {
      console.error('[VideoLearning] Failed to load:', err);
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

  const handleRetry = () => {
    loadVideo();
  };

  const handleStart = () => {
    if (!url.trim()) return;
    loadVideo();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  const handleSegmentClick = (segment: TranscriptSegment) => {
    setSelectedSegment(segment);
    try {
      if (playerRef.current?.seekTo) {
        playerRef.current.seekTo(segment.startMs / 1000, true);
        playerRef.current.playVideo();
      }
    } catch {}
    setCurrentTimeMs(segment.startMs);
  };

  const handleWordClick = (word: string, segment: TranscriptSegment, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setWordTooltip({ word, segment, position: { x: rect.left + rect.width / 2, y: rect.top } });
  };

  if (showInput) {
    return (
      <div className="screen" style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-xl)'
      }}>
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
            cursor: 'pointer'
          }}
        >
          ← Back
        </button>

        <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, marginBottom: 'var(--space-sm)', color: 'var(--text)' }}>
          Video Learning
        </h1>
        <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-secondary)', maxWidth: 400, marginBottom: 'var(--space-xl)', textAlign: 'center' }}>
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
            <div style={{ 
              padding: 'var(--space-md)', 
              background: '#fef2f2', 
              border: '1px solid #ef4444', 
              borderRadius: 8, 
              marginBottom: 'var(--space-md)', 
              color: '#ef4444', 
              fontSize: 'var(--font-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)'
            }}>
              <span>{error}</span>
              <button 
                onClick={handleRetry} 
                style={{
                  padding: '6px 12px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 13,
                  cursor: 'pointer',
                  alignSelf: 'flex-start'
                }}
              >
                Retry
              </button>
            </div>
          )}

          <button onClick={handleStart} disabled={!url.trim()} className="btn btn-primary" style={{ width: '100%', opacity: !url.trim() ? 0.6 : 1 }}>
            Start Learning
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="screen" style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-xl)'
      }}>
        <button
          onClick={() => {
            stopPolling();
            if (playerRef.current?.destroy) {
              try { playerRef.current.destroy(); } catch {}
              playerRef.current = null;
            }
            setShowInput(true);
          }}
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
            cursor: 'pointer'
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
    <div className="screen" style={{ padding: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-md) var(--space-lg)', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <button onClick={onBack} style={{ padding: 'var(--space-sm) var(--space-md)', border: 'none', background: 'transparent', color: 'var(--accent)', fontWeight: 600, fontSize: 'var(--font-base)', cursor: 'pointer' }}>
          ← Back
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: 'var(--font-base)', color: 'var(--text)' }}>
          Video Learning
        </span>
        <button onClick={() => { setShowInput(true); setVideoId(null); }} style={{ padding: 'var(--space-xs) var(--space-md)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', cursor: 'pointer' }}>
          New Video
        </button>
      </div>

      <div style={{ position: 'relative', background: '#000', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {videoId ? (
          <>
            <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%' }}>
              <iframe
                ref={iframeRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>

            {segments.length > 0 ? (
              <SubtitleOverlay
                segments={segments}
                currentTimeMs={currentTimeMs}
                onSegmentClick={handleSegmentClick}
                onWordClick={handleWordClick}
              />
            ) : (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'rgba(0,0,0,0.9)',
                padding: '20px',
                textAlign: 'center'
              }}>
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
                    cursor: 'pointer'
                  }}
                >
                  Try Another Video
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
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
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {selectedSegment && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--bg-card, #fff)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 12,
          padding: 20,
          width: '90%',
          maxWidth: 500,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Sentence Breakdown</h3>
            <button onClick={() => setSelectedSegment(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ padding: 12, background: 'var(--bg-secondary, #f5f5f5)', borderRadius: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              {Math.floor(selectedSegment.startMs / 1000 / 60)}:{String(Math.floor((selectedSegment.startMs / 1000) % 60)).padStart(2, '0')}
            </span>
            <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>{selectedSegment.text}</p>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}>Translation feature coming soon</p>
        </div>
      )}

      {wordTooltip && (
        <div style={{
          position: 'fixed',
          top: wordTooltip.position.y,
          left: wordTooltip.position.x,
          transform: 'translate(-50%, -100%)',
          background: 'var(--bg-card, #fff)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 8,
          padding: 12,
          minWidth: 180,
          maxWidth: 280,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{wordTooltip.word}</span>
            <button onClick={() => setWordTooltip(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, lineHeight: 1 }}>×</button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Translation feature coming soon</p>
          <button style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: 'none', background: 'var(--accent, #3b82f6)', color: '#fff', fontSize: 12, fontWeight: 500, marginTop: 8 }}>
            Save Word
          </button>
        </div>
      )}
    </div>
  );
}