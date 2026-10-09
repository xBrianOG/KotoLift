import { useState } from 'react';
import { createCard } from '../services/cards';
import { ensureReviewStates } from '../services/review';

interface AddCardScreenProps {
  onSave: () => void;
}

export function AddCardScreen({ onSave }: AddCardScreenProps) {
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

      console.log('[AddCard] Creating card...');
      const card = await createCard(
        '',
        enText.trim(),
        esText.trim(),
        tagList,
        notes.trim() || undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        jaText.trim()
      );

      console.log('[AddCard] Card created:', card.id);
      console.log('[AddCard] Ensuring review states...');
      await ensureReviewStates(card);
      console.log('[AddCard] Review states ensured.');

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
    <div className="screen animate-fade-in" style={{ paddingBottom: '120px' }}>
      <form onSubmit={handleSubmit} className="flex-col gap-lg">
        <div className="card">
          <label className="font-semibold text-sm mb-xs block">
            <span className="lang-badge mr-sm" style={{ padding: '2px 6px', marginRight: 8 }}>JA</span> Japanese
          </label>
          <textarea
            value={jaText}
            onChange={(e) => setJaText(e.target.value)}
            placeholder="日本語の文"
            rows={2}
            className="mb-lg"
          />

          <label className="font-semibold text-sm mb-xs block">
            <span className="lang-badge mr-sm" style={{ padding: '2px 6px', marginRight: 8 }}>EN</span> English
          </label>
          <textarea
            value={enText}
            onChange={(e) => setEnText(e.target.value)}
            placeholder="English sentence"
            rows={2}
            className="mb-lg"
          />

          <label className="font-semibold text-sm mb-xs block">
            <span className="lang-badge mr-sm" style={{ padding: '2px 6px', marginRight: 8 }}>ES</span> Spanish
          </label>
          <textarea
            value={esText}
            onChange={(e) => setEsText(e.target.value)}
            placeholder="Oración en español"
            rows={2}
            className="mb-lg"
          />

          <label className="font-semibold text-sm mb-xs block">
            Tags (comma separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="greeting, formal, business"
            className="mb-lg"
          />

          <label className="font-semibold text-sm mb-xs block">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            rows={2}
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary btn-full animate-pulse delay-200"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Card'}
        </button>

        <button 
          type="button"
          className="btn btn-secondary btn-full"
          disabled
          aria-disabled="true"
          aria-describedby="video-import-unavailable"
          style={{ opacity: 0.65, cursor: 'not-allowed' }}
        >
          Import from video — Coming soon
        </button>
        <p id="video-import-unavailable" className="text-secondary text-sm" style={{ textAlign: 'center' }}>
          Video import is temporarily unavailable. Manual flashcards still work.
        </p>
      </form>
    </div>
  );
}
