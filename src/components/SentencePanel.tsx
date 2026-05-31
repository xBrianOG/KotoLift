import { useState, useEffect } from 'react';
import type { Sentence } from '../services/subtitleService';
import { translateText, type SupportedLang } from '../services/api';

interface SentencePanelProps {
  sentence: Sentence;
  sourceLang: SupportedLang;
  onClose: () => void;
}

interface Translation {
  lang: string;
  text: string;
}

export function SentencePanel({ sentence, sourceLang, onClose }: SentencePanelProps) {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTranslations = async () => {
      setLoading(true);
      const targets: SupportedLang[] = sourceLang === 'en' 
        ? ['es', 'ja'] 
        : sourceLang === 'es' 
          ? ['en', 'ja'] 
          : ['en', 'es'];

      try {
        const results = await Promise.all(
          targets.map(async (lang) => ({
            lang,
            text: await translateText(sentence.text, sourceLang, lang)
          }))
        );
        setTranslations(results);
      } catch {
        setTranslations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTranslations();
  }, [sentence.text, sourceLang]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const langLabel = (l: string) => {
    switch (l) {
      case 'en': return 'English';
      case 'es': return 'Spanish';
      case 'ja': return 'Japanese';
      default: return l.toUpperCase();
    }
  };

  return (
    <div
      style={{
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
        boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
        zIndex: 1000
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
      }}>
        <h3 style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text)',
          margin: 0
        }}>
          Sentence Breakdown
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 24,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            padding: 0,
            lineHeight: 1
          }}
        >
          ×
        </button>
      </div>

      <div style={{
        padding: 12,
        background: 'var(--bg-secondary, #f5f5f5)',
        borderRadius: 8,
        marginBottom: 16
      }}>
        <span style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          display: 'block',
          marginBottom: 4
        }}>
          Original
        </span>
        <p style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: 'var(--text)',
          margin: 0
        }}>
          {sentence.text}
        </p>
      </div>

      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: 20,
          color: 'var(--text-secondary)'
        }}>
          Loading translations...
        </div>
      ) : translations.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {translations.map(({ lang, text }) => (
            <div
              key={lang}
              style={{
                padding: 10,
                background: 'var(--bg, #fafafa)',
                borderRadius: 6
              }}
            >
              <span style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                fontWeight: 500,
                textTransform: 'uppercase'
              }}>
                {langLabel(lang)}
              </span>
              <p style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: 'var(--text)',
                margin: '4px 0 0'
              }}>
                {text}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: 20,
          color: 'var(--text-secondary)'
        }}>
          Translation failed
        </div>
      )}

      <div style={{
        marginTop: 16,
        padding: '10px 12px',
        background: 'var(--bg-secondary, #f5f5f5)',
        borderRadius: 6,
        fontSize: 12,
        color: 'var(--text-secondary)'
      }}>
        ⏱ {Math.floor(sentence.start / 60)}:{String(Math.floor(sentence.start % 60)).padStart(2, '0')} - {Math.floor(sentence.end / 60)}:{String(Math.floor(sentence.end % 60)).padStart(2, '0')}
      </div>
    </div>
  );
}