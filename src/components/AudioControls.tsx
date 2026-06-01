import React, { useRef, useState } from 'react';
import { Volume2, Mic, MicOff } from 'lucide-react';
import { getAuthHeaders } from '../services/auth';
import { getLearningSettings } from '../services/settings';

interface AudioControlsProps {
  text: string;
  lang?: string;
  onPracticeComplete?: (score: number, transcript: string) => void;
  showPractice?: boolean;
  jaContent?: string;
  enContent?: string;
  esContent?: string;
}

const LANG_MAP: Record<string, string> = {
  en: 'en-US',
  ja: 'ja-JP',
  es: 'es-ES',
};

const audioCache = new Map<string, string>();

function getCacheKey(text: string, lang: string): string {
  return `${lang}:${text}`;
}

function getCachedUrl(text: string, lang: string): string | null {
  return audioCache.get(getCacheKey(text, lang)) || null;
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';
const TTS_URL = API_BASE ? `${API_BASE}/api/tts` : '/api/tts';

async function fetchServerTTS(text: string, lang: string): Promise<string | null> {
  const cached = getCachedUrl(text, lang);
  if (cached) return cached;

  try {
    const response = await fetch(TTS_URL, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang, rate: 0.9 }),
    });

    if (!response.ok) {
      console.log('Server TTS failed:', response.status);
      return null;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    audioCache.set(getCacheKey(text, lang), url);
    return url;
  } catch (err) {
    console.log('Server TTS error:', err);
    return null;
  }
}

export function AudioControls({ text, lang = 'en', showPractice = true, jaContent, enContent, esContent }: AudioControlsProps) {
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [transcript, setTranscript] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchingRef = useRef(false);
  const prefetchTokenRef = useRef(0);
  const recognitionRef = useRef<any>(null);

  const getEffectiveLang = (): string => {
    const settings = getLearningSettings();
    const preferred = settings.preferredTTSLang;
    if (!preferred || preferred === 'auto') return lang;
    const contentForLang =
      preferred === 'ja' ? jaContent :
      preferred === 'en' ? enContent :
      preferred === 'es' ? esContent : undefined;
    if (!contentForLang) return lang;
    return preferred;
  };

  const getContentForLang = (targetLang: string): string => {
    if (targetLang === 'ja' && jaContent) return jaContent;
    if (targetLang === 'en' && enContent) return enContent;
    if (targetLang === 'es' && esContent) return esContent;
    return text;
  };

  const effectiveLang = getEffectiveLang();
  const effectiveText = getContentForLang(effectiveLang);

  const prefetch = () => {
    if (!effectiveText || getCachedUrl(effectiveText, effectiveLang)) return;
    if (prefetchingRef.current) return;
    prefetchingRef.current = true;
    const token = ++prefetchTokenRef.current;
    fetchServerTTS(effectiveText, effectiveLang)
      .catch(() => {})
      .finally(() => {
        if (prefetchTokenRef.current === token) {
          prefetchingRef.current = false;
        }
      });
  };

  const speak = async () => {
    if (speaking || loading) return;

    let url = getCachedUrl(effectiveText, effectiveLang);
    if (!url) {
      setLoading(true);
      url = await fetchServerTTS(effectiveText, effectiveLang);
      setLoading(false);
      if (!url) return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    if (audio.src !== url) {
      audio.src = url;
    } else if (audio.ended) {
      audio.currentTime = 0;
    }
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => setSpeaking(false);
    setSpeaking(true);
    try {
      await audio.play();
    } catch (e) {
      setSpeaking(false);
    }
  };

  const handleSpeak = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await speak();
  };

  const handleSpeakHover = () => {
    prefetch();
  };

  const handleSpeakTouchStart = () => {
    prefetch();
  };

  const handleRecord = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (recording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setRecording(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = LANG_MAP[effectiveLang] || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    setRecording(true);
    setScore(null);
    setTranscript('');

    recognition.onend = () => setRecording(false);
    recognition.onerror = (e: any) => {
      console.log('Recognition error:', e.error);
      setRecording(false);
    };
    recognition.onresult = (e: any) => {
      const result = e.results[0][0].transcript;
      setTranscript(result);
      const sim = ((result.toLowerCase().split(/\s+/).filter((w: string) => effectiveText.toLowerCase().includes(w)).length) / Math.max(1, effectiveText.split(/\s+/).length)) * 100;
      setScore(Math.round(sim));
      if (sim >= 60) onPracticeComplete?.(sim, result);
    };

    try {
      recognition.start();
    } catch (e) {
      console.log('Recognition start error:', e);
      setRecording(false);
    }
  };

  const hasSR = typeof window !== 'undefined' &&
                ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
      <button
        onClick={handleSpeak}
        onMouseEnter={handleSpeakHover}
        onTouchStart={handleSpeakTouchStart}
        disabled={speaking || loading}
        className="btn btn-subtle"
        style={{ padding: 'var(--space-xs)', borderRadius: '50%' }}
        title={loading ? 'Loading...' : 'Listen'}
      >
        <Volume2 size={16} />
      </button>

      {showPractice && hasSR && (
        <button
          onClick={handleRecord}
          className={`btn ${recording ? 'btn-danger' : 'btn-secondary'}`}
          style={{ padding: 'var(--space-xs)', borderRadius: '50%' }}
          title={recording ? 'Stop' : 'Practice'}
        >
          {recording ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
      )}

      {score !== null && (
        <span style={{
          color: score >= 60 ? 'var(--success)' : 'var(--warning)',
          fontSize: 'var(--font-xs)',
          fontWeight: 500,
          minWidth: 32
        }}>
          {score}%
        </span>
      )}
    </div>
  );
}