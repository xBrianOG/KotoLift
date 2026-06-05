import { useRef, useState } from 'react';

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || 'https://kotolift.onrender.com';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface CookieUploadBannerProps {
  message?: string;
  onUploadSuccess?: () => void;
}

/**
 * Inline banner shown when the transcript fetch fails with an anti-bot
 * or rate-limit error. Lets the user upload YouTube cookies.txt without
 * leaving the page. The file picker is hidden behind a label so it
 * doesn't take up visual space.
 */
export function CookieUploadBanner({ message, onUploadSuccess }: CookieUploadBannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('uploading');
    setError(null);
    try {
      const text = await file.text();
      const res = await fetch(`${API_BASE}/api/transcript/cookies`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: text,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setStatus('success');
      onUploadSuccess?.();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      // Reset the input so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-card, #1a1a1a)',
        border: '1px solid var(--warning, #f59e0b)',
        borderRadius: 8,
        padding: 'var(--space-md)',
        marginBottom: 'var(--space-md)',
        color: 'var(--text)',
        fontSize: 'var(--font-sm)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--warning, #f59e0b)' }}>
            Transcripts unavailable
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {message ||
              'YouTube is blocking transcript requests from this server. Upload a cookies.txt file to authenticate.'}
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 20,
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1,
            marginLeft: 8,
          }}
        >
          ×
        </button>
      </div>

      {status === 'success' ? (
        <div
          style={{
            padding: 'var(--space-sm) var(--space-md)',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid var(--success, #22c55e)',
            borderRadius: 4,
            color: 'var(--success, #22c55e)',
            marginTop: 8,
          }}
        >
          Cookies saved. Click "Retry" on the transcript banner to fetch them.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
          <label
            className="btn btn-primary"
            style={{
              padding: 'var(--space-xs) var(--space-md)',
              fontSize: 'var(--font-sm)',
              cursor: 'pointer',
              opacity: status === 'uploading' ? 0.6 : 1,
              pointerEvents: status === 'uploading' ? 'none' : 'auto',
            }}
          >
            {status === 'uploading' ? 'Uploading…' : 'Upload cookies.txt'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
          <button
            onClick={() => setShowHelp((v) => !v)}
            className="btn btn-subtle"
            style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--font-sm)' }}
          >
            {showHelp ? 'Hide' : 'How to get cookies'}
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            color: 'var(--danger, #ef4444)',
            fontSize: 'var(--font-xs)',
            marginTop: 8,
          }}
        >
          {error}
        </div>
      )}

      {showHelp && (
        <div
          style={{
            marginTop: 'var(--space-sm)',
            padding: 'var(--space-sm) var(--space-md)',
            background: 'var(--bg-secondary, rgba(0,0,0,0.2))',
            borderRadius: 4,
            fontSize: 'var(--font-xs)',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: 'var(--text)' }}>How to extract YouTube cookies:</strong>
          <ol style={{ marginTop: 6, paddingLeft: 20 }}>
            <li>
              Install{' '}
              <em>"Get cookies.txt LOCALLY"</em> (Chrome) or <em>"cookies.txt"</em> (Firefox).
            </li>
            <li>Go to youtube.com and make sure you're signed in.</li>
            <li>Click the extension icon → Export. Save as <code>cookies.txt</code>.</li>
            <li>Upload the file above.</li>
          </ol>
          The file is stored on the server's persistent disk. Cookies expire every
          few weeks; re-upload when transcripts stop working.
        </div>
      )}
    </div>
  );
}
