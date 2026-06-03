import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type { ExplainResponse, TatoebaExample } from "../types";
import { normalizeExplainResponse } from "../utils/explainAdapter";
import { Accordion } from "./Accordion";

const API_URL = import.meta.env.VITE_EXPLAIN_API_URL || "/api/explain";

const log = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};
const logError = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
};

const LANG_LABELS: Record<string, string> = {
  ja: 'Japanese',
  en: 'English',
  es: 'Spanish'
};

export function ExplainScreen({ initialSentence }: { initialSentence?: string } = {}) {
  const [sentence, setSentence] = useState<string>(initialSentence ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [cardAdded, setCardAdded] = useState(false);

  const [cardJa, setCardJa] = useState("");
  const [cardEn, setCardEn] = useState("");
  const [cardEs, setCardEs] = useState("");
  const [cardTags, setCardTags] = useState("");

  const [includeJa, setIncludeJa] = useState(true);
  const [includeEn, setIncludeEn] = useState(true);
  const [includeEs, setIncludeEs] = useState(true);

  const [addedExamples, setAddedExamples] = useState<Set<number>>(new Set());
  const [addingExampleIdx, setAddingExampleIdx] = useState<number | null>(null);
  const [exampleError, setExampleError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSentence) setSentence(initialSentence);
    try {
      const raw = localStorage.getItem('explain.initial');
      if (!initialSentence && raw) {
        const payload = JSON.parse(raw);
        if (payload?.sentence) setSentence(payload.sentence);
      }
    } catch {
      // ignore
    }
    localStorage.removeItem('explain.initial');
  }, [initialSentence]);

  useEffect(() => {
    if (result?.translations) {
      setCardJa(result.translations.ja || "");
      setCardEn(result.translations.en || "");
      setCardEs(result.translations.es || "");
      setCardTags(result.suggested_flashcard?.tags?.join(", ") || "");
    }
  }, [result]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sentence.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setCardAdded(false);
    setAddedExamples(new Set());
    setAddingExampleIdx(null);
    setExampleError(null);

    log("[ExplainScreen] Starting explain request");
    log("[ExplainScreen] Sentence:", sentence.trim());

    try {
      const requestBody = { sentence: sentence.trim() };
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorDetails = errorData.error;
        } catch {
          // ignore
        }
        throw new Error(errorDetails);
      }

      const data = await response.json();
      setResult(normalizeExplainResponse(data));
    } catch (err) {
      logError("[ExplainScreen] Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to get explanation";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsCard = async () => {
    if (selectedCount < 2) {
      setError("Please select at least 2 languages for the card");
      return;
    }

    const tags = cardTags.split(",").map(t => t.trim()).filter(Boolean);

    const { createCard } = await import("../services/cards");
    const { ensureReviewStates } = await import("../services/review");

    let front = cardJa.trim();
    let sourceLang = 'ja';
    let jaText = "";
    let enText = "";
    let esText = "";

    if (result?.detected_language === 'ja' || (includeJa && !includeEn && !includeEs)) {
      front = cardJa.trim();
      sourceLang = 'ja';
      jaText = includeJa ? cardJa.trim() : "";
      enText = includeEn ? cardEn.trim() : "";
      esText = includeEs ? cardEs.trim() : "";
    } else if (result?.detected_language === 'en' || (includeEn && !includeJa)) {
      front = cardEn.trim();
      sourceLang = 'en';
      jaText = includeJa ? cardJa.trim() : "";
      enText = includeEn ? cardEn.trim() : "";
      esText = includeEs ? cardEs.trim() : "";
    } else if (result?.detected_language === 'es' || includeEs) {
      front = cardEs.trim();
      sourceLang = 'es';
      jaText = includeJa ? cardJa.trim() : "";
      enText = includeEn ? cardEn.trim() : "";
      esText = includeEs ? cardEs.trim() : "";
    }

    if (!front) {
      setError("Please fill in at least the front language");
      return;
    }

    const card = await createCard(front, enText, esText, tags, undefined, sourceLang, undefined, undefined, undefined, jaText);
    await ensureReviewStates(card);
    setCardAdded(true);
  };

  const handleAddExampleAsCard = async (example: TatoebaExample, idx: number) => {
    if (!result) return;
    if (addingExampleIdx !== null || addedExamples.has(idx)) return;

    setExampleError(null);
    setAddingExampleIdx(idx);
    try {
      const { createCard } = await import('../services/cards');
      const { ensureReviewStates } = await import('../services/review');

      const sourceLang = result.detected_language;
      const sourceText =
        sourceLang === 'ja' ? example.ja :
        sourceLang === 'en' ? example.en :
                              example.es;
      if (!sourceText) {
        setExampleError('Example has no source-language text');
        return;
      }

      const baseTags = result.suggested_flashcard?.tags ?? [];
      const tags = [...baseTags, 'from-explain'];

      const card = await createCard(
        sourceText,
        example.en,
        example.es,
        tags,
        undefined,
        sourceLang,
        undefined, undefined, undefined,
        example.ja,
      );
      await ensureReviewStates(card);
      setAddedExamples((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
    } catch (e) {
      setExampleError(e instanceof Error ? e.message : 'Failed to add card');
    } finally {
      setAddingExampleIdx(null);
    }
  };

  const selectedCount = [includeJa, includeEn, includeEs].filter(Boolean).length;

  return (
    <div className="screen animate-fade-in" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
      <form onSubmit={handleSubmit}>
        <div className="card mb-lg">
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="Enter a sentence in Japanese, English, or Spanish..."
            rows={4}
            className="mb-lg"
            maxLength={500}
          />

          <button
            type="submit"
            className="btn btn-primary btn-full animate-pulse delay-100"
            disabled={loading || !sentence.trim()}
          >
            {loading ? "Explaining..." : "Explain"}
          </button>
        </div>
      </form>

      {error && (
        <div className="card mb-lg" style={{ background: "var(--danger)", color: 'white', borderColor: 'var(--danger-hover)' }}>
          <p className="font-semibold">{error}</p>
          <p className="text-sm mt-sm" style={{ opacity: 0.9 }}>
            Make sure you're online and the API is configured.
          </p>
        </div>
      )}

      {result && (
        <div className="animate-slide-down delay-200">
          {result.detected_language && (
            <div className="card mb-lg" style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)' }}>
              <p className="text-sm text-accent">
                Detected language: <span className="font-semibold">{LANG_LABELS[result.detected_language] || result.detected_language.toUpperCase()}</span>
              </p>
            </div>
          )}

          <Accordion title="Translations">
            <p className="mb-sm"><span className="lang-badge border-none mr-sm">JA</span> {result.translations?.ja}</p>
            <p className="mb-sm"><span className="lang-badge border-none mr-sm">EN</span> {result.translations?.en}</p>
            <p><span className="lang-badge border-none mr-sm">ES</span> {result.translations?.es}</p>
          </Accordion>

          {result.naturalness && (
            <Accordion title="Naturalness">
              <p className="font-semibold mb-xs text-primary">Score: {result.naturalness.score_1_to_5}/5</p>
              <p className="text-secondary">{result.naturalness.comment}</p>
            </Accordion>
          )}

          <Accordion title="Grammar Points">
            {result.grammar_points?.length > 0 && (
              <div className="flex-col gap-lg">
                {result.grammar_points.map((point, i) => (
                  <div key={i}>
                    <p className="font-semibold text-primary mb-xs">{point.title}</p>
                    <p className="text-secondary mb-xs">{point.explanation}</p>
                    <p className="text-accent italic text-sm">"{point.example}"</p>
                  </div>
                ))}
              </div>
            )}
          </Accordion>

          <Accordion title="Vocabulary">
            {result.vocabulary?.length > 0 && (
              <div className="flex-col gap-md">
                {result.vocabulary.map((vocab, i) => (
                  <div key={i}>
                    <span className="font-semibold text-primary">{vocab.term}</span>
                    <span className="text-secondary"> - {vocab.meaning}</span>
                    {vocab.notes && <p className="text-sm mt-xs text-tertiary">{vocab.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </Accordion>

          <Accordion title="Alternatives">
            <div className="flex-col gap-lg">
              {result.alternatives?.map((alt, i) => (
                <div key={i}>
                  <span className="lang-badge text-xs mb-sm">{alt.tone}</span>
                  <p className="mb-xs"><span className="lang-badge text-xs mr-sm border-none bg-surface">JA</span> {alt.ja}</p>
                  <p className="mb-xs"><span className="lang-badge text-xs mr-sm border-none bg-surface">EN</span> {alt.en}</p>
                  <p><span className="lang-badge text-xs mr-sm border-none bg-surface">ES</span> {alt.es}</p>
                </div>
              ))}
            </div>
          </Accordion>

          <Accordion title={`Examples${result.examples?.length ? ` (${result.examples.length})` : ''}`}>
            {result.examples?.length ? (
              <div className="flex-col gap-lg">
                {result.examples.map((ex, i) => {
                  const isAdded = addedExamples.has(i);
                  const isAdding = addingExampleIdx === i;
                  return (
                    <div key={i} className="flex-col gap-xs" style={{ paddingBottom: 'var(--space-sm)', borderBottom: i < result.examples!.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      {ex.ja && <p className="mb-xs"><span className="lang-badge text-xs mr-sm border-none bg-surface">JA</span> {ex.ja}</p>}
                      {ex.en && <p className="mb-xs"><span className="lang-badge text-xs mr-sm border-none bg-surface">EN</span> {ex.en}</p>}
                      {ex.es && <p><span className="lang-badge text-xs mr-sm border-none bg-surface">ES</span> {ex.es}</p>}
                      <div className="flex-center" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-xs)' }}>
                        <button
                          type="button"
                          onClick={() => handleAddExampleAsCard(ex, i)}
                          disabled={isAdded || isAdding || addingExampleIdx !== null}
                          className={`btn ${isAdded ? 'btn-secondary' : 'btn-success'}`}
                          style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--font-sm)' }}
                        >
                          {isAdded ? '✓ Added' : isAdding ? 'Adding…' : 'Add as Card'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {exampleError && (
                  <p className="text-sm" style={{ color: 'var(--danger)' }}>{exampleError}</p>
                )}
              </div>
            ) : (
              <p className="text-secondary text-sm">No examples found for this word.</p>
            )}
          </Accordion>

          <Accordion title="Mistakes">
            {result.mistakes?.length > 0 ? (
              <ul className="text-secondary pl-lg">
                {result.mistakes.map((mistake, i) => (
                  <li key={i} className="mb-xs">{mistake}</li>
                ))}
              </ul>
            ) : <p className="text-secondary text-sm">No mistakes found!</p>}
          </Accordion>

          <div className="card mt-xl" style={{ border: "2px solid var(--accent)", background: 'var(--accent-light)' }}>
            <h3 className="font-bold text-lg mb-md text-accent-hover">Create Flashcard</h3>
            <p className="text-sm text-secondary mb-md">Select at least 2 languages for your card:</p>

            <div className="flex gap-md mb-md flex-wrap">
              <label className="flex-center gap-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeJa}
                  onChange={(e) => setIncludeJa(e.target.checked)}
                  className="checkbox"
                />
                <span className="lang-badge">JA</span>
              </label>
              <label className="flex-center gap-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeEn}
                  onChange={(e) => setIncludeEn(e.target.checked)}
                  className="checkbox"
                />
                <span className="lang-badge">EN</span>
              </label>
              <label className="flex-center gap-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeEs}
                  onChange={(e) => setIncludeEs(e.target.checked)}
                  className="checkbox"
                />
                <span className="lang-badge">ES</span>
              </label>
            </div>

            {selectedCount < 2 && (
              <p className="text-sm text-danger mb-md">Please select at least 2 languages</p>
            )}

            {includeJa && (
              <div className="mb-sm">
                <label className="text-sm text-secondary block mb-xs">Japanese</label>
                <input
                  type="text"
                  value={cardJa}
                  onChange={(e) => setCardJa(e.target.value)}
                  className="input"
                  placeholder="Japanese text"
                />
              </div>
            )}
            {includeEn && (
              <div className="mb-sm">
                <label className="text-sm text-secondary block mb-xs">English</label>
                <input
                  type="text"
                  value={cardEn}
                  onChange={(e) => setCardEn(e.target.value)}
                  className="input"
                  placeholder="English text"
                />
              </div>
            )}
            {includeEs && (
              <div className="mb-sm">
                <label className="text-sm text-secondary block mb-xs">Spanish</label>
                <input
                  type="text"
                  value={cardEs}
                  onChange={(e) => setCardEs(e.target.value)}
                  className="input"
                  placeholder="Spanish text"
                />
              </div>
            )}

            <div className="mb-md">
              <label className="text-sm text-secondary block mb-xs">Tags (comma separated)</label>
              <input
                type="text"
                value={cardTags}
                onChange={(e) => setCardTags(e.target.value)}
                className="input"
                placeholder="grammar, vocabulary"
              />
            </div>

            <button
              className={`btn btn-full ${cardAdded ? 'btn-secondary' : 'btn-success'}`}
              onClick={handleAddAsCard}
              disabled={cardAdded || selectedCount < 2}
            >
              {cardAdded ? '✓ Card Added' : 'Add Card'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}