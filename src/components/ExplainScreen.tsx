import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type { ExplainResponse } from "../types";
import { normalizeExplainResponse } from "../utils/explainAdapter";
import { Accordion } from "./Accordion";

const API_URL = import.meta.env.VITE_EXPLAIN_API_URL || "/api/explain";

// Simple in-editor logger that only outputs in DEV mode
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

export function ExplainScreen({ initialSentence }: { initialSentence?: string } = {}) {
  const [sentence, setSentence] = useState<string>(initialSentence ?? "");
  const [focus, setFocus] = useState<"english" | "spanish" | "both">("both");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [cardAdded, setCardAdded] = useState(false);

  useEffect(() => {
    if (initialSentence) setSentence(initialSentence);
    // If not prefilled via props, check for a stored explain payload from Cards/Review
    try {
      const raw = localStorage.getItem('explain.initial');
      if (!initialSentence && raw) {
        const payload = JSON.parse(raw);
        if (payload?.sentence) setSentence(payload.sentence);
      }
    } catch {
      // ignore
    }
  }, [initialSentence]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sentence.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setCardAdded(false);

    log("[ExplainScreen] Starting explain request");
    log("[ExplainScreen] API URL:", API_URL);
    log("[ExplainScreen] Sentence:", sentence.trim());
    log("[ExplainScreen] Focus:", focus);

    try {
      const requestBody = { sentence: sentence.trim(), focus };
      log("[ExplainScreen] Request body:", requestBody);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      log("[ExplainScreen] Response status:", response.status);

      if (!response.ok) {
        let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorDetails = errorData.error;
          if (errorData.details) errorDetails += ` - ${errorData.details}`;
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(errorDetails);
      }

      const data = await response.json();
      log("[ExplainScreen] Success! Received data:", data);
      setResult(normalizeExplainResponse(data));
    } catch (err) {
      logError("[ExplainScreen] Error occurred:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get explanation";
      setError(errorMessage);
    } finally {
      setLoading(false);
      log("[ExplainScreen] Request completed");
    }
  };

  const handleAddAsCard = async () => {
    if (!result?.suggested_flashcard) return;

    const { createCard } = await import("../services/cards");
    const { ensureReviewStates } = await import("../services/review");

    const card = await createCard(
      result.suggested_flashcard.ja,
      result.suggested_flashcard.en,
      result.suggested_flashcard.es,
      result.suggested_flashcard.tags,
    );
    await ensureReviewStates(card);
    setCardAdded(true);
  };

  return (
    <div className="screen animate-fade-in" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
      <form onSubmit={handleSubmit}>
        <div className="card mb-lg">
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="Enter a sentence to explain..."
            rows={4}
            className="mb-lg"
            maxLength={500}
          />

          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value as typeof focus)}
            className="mb-lg"
          >
            <option value="english">Focus: English</option>
            <option value="spanish">Focus: Spanish</option>
            <option value="both">Focus: Both</option>
          </select>

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

      {result?.suggested_flashcard && (
        <div className="review-bottom-bar animate-slide-down">
          <button
            className={`btn btn-full ${cardAdded ? 'btn-secondary' : 'btn-success'}`}
            onClick={handleAddAsCard}
            disabled={cardAdded}
          >
            {cardAdded ? '✓ Card Added' : 'Add as Card'}
          </button>
        </div>
      )}

      {result && (
        <div className="animate-slide-down delay-200">
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

          <Accordion title="Mistakes">
            {result.mistakes?.length > 0 ? (
              <ul className="text-secondary pl-lg">
                {result.mistakes.map((mistake, i) => (
                  <li key={i} className="mb-xs">{mistake}</li>
                ))}
              </ul>
            ) : <p className="text-secondary text-sm">No mistakes found!</p>}
          </Accordion>

          {result.suggested_flashcard && (
            <div className="card mt-xl" style={{ border: "2px solid var(--accent)", background: 'var(--accent-light)' }}>
              <h3 className="font-bold text-lg mb-md text-accent-hover">Suggested Flashcard</h3>
              <p className="mb-sm"><span className="lang-badge mr-sm">JA</span> {result.suggested_flashcard.ja}</p>
              <p className="mb-sm"><span className="lang-badge mr-sm">EN</span> {result.suggested_flashcard.en}</p>
              <p className="mb-sm"><span className="lang-badge mr-sm">ES</span> {result.suggested_flashcard.es}</p>
              {result.suggested_flashcard.tags?.length > 0 && (
                <div className="mt-md flex-start flex-wrap gap-xs">
                  {result.suggested_flashcard.tags.map((tag) => (
                    <span key={tag} className="tag text-xs">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
