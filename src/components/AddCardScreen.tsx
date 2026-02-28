import { useState } from 'react';
import { createCard } from '../services/cards';
import { ensureReviewStates } from '../services/review';

interface AddCardScreenProps {
  onSave: () => void;
  onNavigateToVideoImport?: () => void;
}

export function AddCardScreen({ onSave, onNavigateToVideoImport }: AddCardScreenProps) {
  const [jaText, setJaText] = useState('');
  const [enText, setEnText] = useState('');
  const [esText, setEsText] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jaText.trim() || !enText.trim() || !esText.trim()) {
      alert('Please fill in all three language fields');
      return;
    }

    setSaving(true);
    try {
      const tagList = tags
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      const card = await createCard(
        jaText.trim(),
        enText.trim(),
        esText.trim(),
        tagList,
        notes.trim() || undefined
      );

      await ensureReviewStates(card);

      setJaText('');
      setEnText('');
      setEsText('');
      setTags('');
      setNotes('');
      
      onSave();
    } catch (error) {
      console.error('Failed to save card:', error);
      alert('Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="card">
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span className="lang-badge">JA</span> Japanese
          </label>
          <textarea
            value={jaText}
            onChange={(e) => setJaText(e.target.value)}
            placeholder="日本語の文"
            rows={2}
            style={{ width: '100%', marginBottom: 16 }}
          />

          <label style={{ display: 'block', marginBottom: 8 }}>
            <span className="lang-badge">EN</span> English
          </label>
          <textarea
            value={enText}
            onChange={(e) => setEnText(e.target.value)}
            placeholder="English sentence"
            rows={2}
            style={{ width: '100%', marginBottom: 16 }}
          />

          <label style={{ display: 'block', marginBottom: 8 }}>
            <span className="lang-badge">ES</span> Spanish
          </label>
          <textarea
            value={esText}
            onChange={(e) => setEsText(e.target.value)}
            placeholder="Oración en español"
            rows={2}
            style={{ width: '100%', marginBottom: 16 }}
          />

          <label style={{ display: 'block', marginBottom: 8 }}>
            Tags (comma separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="greeting, formal, business"
            style={{ width: '100%', marginBottom: 16 }}
          />

          <label style={{ display: 'block', marginBottom: 8 }}>
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            rows={2}
            style={{ width: '100%' }}
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '100%' }}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Card'}
        </button>

        {onNavigateToVideoImport && (
          <button 
            type="button"
            onClick={onNavigateToVideoImport}
            style={{ 
              width: '100%', 
              marginTop: 'var(--space-md)',
              padding: 'var(--space-md)',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-sm)',
              cursor: 'pointer'
            }}
          >
            🎬 Import from video
          </button>
        )}
      </form>
    </div>
  );
}
