import { useState, useEffect, useRef } from 'react';
import { translateText, type SupportedLang } from '../services/api';
import { createCard } from '../services/cards';
import { ensureReviewStates } from '../services/review';

interface WordTooltipProps {
  word: string;
  sentenceText: string;
  sourceLang: SupportedLang;
  position: { x: number; y: number };
  onClose: () => void;
  onSaveWord: (word: string) => void;
}

export function WordTooltip({
  word,
  sentenceText,
  sourceLang,
  position,
  onClose,
  onSaveWord
}: WordTooltipProps) {
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTranslation = async () => {
      try {
        const targetLang: SupportedLang = sourceLang === 'ja' || sourceLang === 'es' ? 'en' : 'es';
        const result = await translateText(word, sourceLang, targetLang);
        setTranslation(result);
      } catch {
        setTranslation('(translation failed)');
      } finally {
        setLoading(false);
      }
    };

    fetchTranslation();
  }, [word, sourceLang]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleSaveWord = async () => {
    if (!translation || saving || saved) return;

    setSaving(true);
    try {
      const targetLangs: SupportedLang[] = sourceLang === 'en' ? ['es', 'ja'] : ['en'];
      
      const translations: Record<string, string> = { [sourceLang]: word };
      
      await Promise.all(
        targetLangs.map(async (lang) => {
          try {
            translations[lang] = await translateText(word, sourceLang, lang);
          } catch {
            translations[lang] = '(translation failed)';
          }
        })
      );

      const card = await createCard(
        word,
        translations.en || '',
        translations.es || '',
        ['youtube', 'word'],
        `From: "${sentenceText}"`,
        sourceLang
      );

      await ensureReviewStates(card);
      setSaved(true);
      onSaveWord(word);
    } catch (err) {
      console.error('Failed to save word:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        transform: 'translate(-50%, -100%)',
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: 8,
        padding: 12,
        minWidth: 180,
        maxWidth: 280,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        zIndex: 1000
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8
      }}>
        <span style={{
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--text)'
        }}>
          {word}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            padding: 0,
            lineHeight: 1
          }}
        >
          ×
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Loading...
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Translation:
          </span>
          <p style={{ fontSize: 14, color: 'var(--text)', margin: '4px 0 0' }}>
            {translation}
          </p>
        </div>
      )}

      <button
        onClick={handleSaveWord}
        disabled={loading || saving || saved}
        style={{
          width: '100%',
          padding: '6px 10px',
          borderRadius: 4,
          border: 'none',
          background: saved ? 'var(--success, #22c55e)' : 'var(--accent, #3b82f6)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 500,
          cursor: saved ? 'default' : 'pointer',
          opacity: loading || saving ? 0.7 : 1
        }}
      >
        {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Word'}
      </button>
    </div>
  );
}