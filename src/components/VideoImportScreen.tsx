import { useState } from 'react';
import { fetchTranscript } from '../services/transcript';
import { extractVideoIdFromUrl } from '../utils/youtube';

interface VideoImportScreenProps {
  onComplete?: (createdCount: number) => void;
  onCancel?: () => void;
  onViewTranscript?: (data: { url: string; title: string; segments: Awaited<ReturnType<typeof fetchTranscript>>['segments']; sourceLang: string; videoId: string }) => void;
  onOpenPlayer?: (data: { url: string; title: string; segments: Awaited<ReturnType<typeof fetchTranscript>>['segments']; sourceLang: string; videoId: string }) => void;
}

export function VideoImportScreen({ onCancel, onOpenPlayer }: VideoImportScreenProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    const videoId = extractVideoIdFromUrl(trimmedUrl);
    if (!videoId) {
      setError('Invalid YouTube URL. Expected a youtube.com/watch?v= or youtu.be/ link.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchTranscript(trimmedUrl, 'en');
      onOpenPlayer?.({
        url: trimmedUrl,
        title: result.title || `Video ${videoId}`,
        segments: result.segments,
        sourceLang: 'en',
        videoId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transcript');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleImport();
    }
  };

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
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontSize: 'var(--font-2xl)',
          fontWeight: 700,
          marginBottom: 'var(--space-sm)',
          color: 'var(--text)',
        }}
      >
        YouTube Learning
      </h1>
      <p
        style={{
          fontSize: 'var(--font-base)',
          color: 'var(--text-secondary)',
          maxWidth: 400,
          marginBottom: 'var(--space-xl)',
        }}
      >
        Paste a YouTube URL to extract subtitles and start learning with interactive transcripts.
      </p>

      <div style={{ width: '100%', maxWidth: 500 }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={loading}
          style={{
            width: '100%',
            marginBottom: 'var(--space-md)',
            opacity: loading ? 0.6 : 1,
          }}
        />

        {error && (
          <div
            style={{
              padding: 'var(--space-md)',
              background: 'var(--error-light, #fef2f2)',
              border: '1px solid var(--error, #ef4444)',
              borderRadius: 8,
              marginBottom: 'var(--space-md)',
              color: 'var(--error, #ef4444)',
              fontSize: 'var(--font-sm)',
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={loading || !url.trim()}
          className="btn btn-primary"
          style={{
            width: '100%',
            opacity: loading || !url.trim() ? 0.6 : 1,
            cursor: loading || !url.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Loading...' : 'Start Learning'}
        </button>
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            marginTop: 'var(--space-xl)',
            padding: 'var(--space-sm) var(--space-md)',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 'var(--font-base)',
          }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
