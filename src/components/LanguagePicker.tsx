import type { Card } from '../types';

interface LanguageOption {
  lang: string;
  label: string;
  text: string;
}

interface LanguagePickerProps {
  card: Card;
  onSelect: (sentence: string, lang: string) => void;
  onClose: () => void;
}

export function LanguagePicker({ card, onSelect, onClose }: LanguagePickerProps) {
  const options: LanguageOption[] = [];

  if (card.jaText) {
    options.push({ lang: 'ja', label: 'Japanese', text: card.jaText });
  }
  if (card.enText) {
    options.push({ lang: 'en', label: 'English', text: card.enText });
  }
  if (card.esText) {
    options.push({ lang: 'es', label: 'Spanish', text: card.esText });
  }

  if (options.length === 0) {
    return null;
  }

  return (
    <div
      className="modal-overlay animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-md)',
      }}
    >
      <div
        className="card animate-slide-down"
        style={{ width: '100%', maxWidth: '420px', maxHeight: '80vh', overflow: 'auto' }}
      >
        <h3 className="text-lg font-bold mb-md">Explain which language?</h3>
        <p className="text-secondary text-sm mb-lg">Choose a sentence from this card to explain.</p>
        <div className="flex-col gap-sm">
          {options.map(opt => (
            <button
              key={opt.lang}
              onClick={() => onSelect(opt.text, opt.lang)}
              className="btn btn-secondary btn-full"
              style={{ padding: 'var(--space-md)' }}
            >
              <span className="lang-badge mr-sm">{opt.lang.toUpperCase()}</span>
              <span className="text-base">{opt.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="btn btn-subtle btn-full mt-md"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
