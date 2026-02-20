import { useState } from "react";
import type { ExplainResponse } from "../types";
import { normalizeExplainResponse } from "../utils/explainAdapter";

const API_URL = import.meta.env.VITE_EXPLAIN_API_URL || "/api/explain";

// Simple in-editor logger that only outputs in DEV mode
const log = (...args: any[]) => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};
const logError = (...args: any[]) => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
};

export function ExplainScreen() {
  const [sentence, setSentence] = useState("");
  const [focus, setFocus] = useState<"english" | "spanish" | "both">("both");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentence.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

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
      log("[ExplainScreen] Response ok:", response.ok);
      log(
        "[ExplainScreen] Response headers:",
        Object.fromEntries(response.headers.entries()),
      );

      if (!response.ok) {
        // Try to get detailed error from response
        let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error("[ExplainScreen] Error response data:", errorData);
          if (errorData.error) {
            errorDetails = errorData.error;
          }
          if (errorData.details) {
            errorDetails += ` - ${errorData.details}`;
          }
        } catch (jsonError) {
          console.error(
            "[ExplainScreen] Could not parse error response as JSON:",
            jsonError,
          );
          // Try to get text response
          try {
            const errorText = await response.text();
            console.error("[ExplainScreen] Error response text:", errorText);
          } catch (textError) {
            console.error(
              "[ExplainScreen] Could not read error response text:",
              textError,
            );
          }
        }
        throw new Error(errorDetails);
      }

      const data = await response.json();
      log("[ExplainScreen] Success! Received data:", data);
      log("[ExplainScreen] Data keys:", Object.keys(data));
      // Normalize incoming payload to the ExplainResponse shape expected by the UI
      setResult(normalizeExplainResponse(data));
    } catch (err) {
      logError("[ExplainScreen] Error occurred:", err);
      logError("[ExplainScreen] Error type:", typeof err);
      logError(
        "[ExplainScreen] Error name:",
        err instanceof Error ? err.name : "unknown",
      );
      logError(
        "[ExplainScreen] Error message:",
        err instanceof Error ? err.message : String(err),
      );
      if (err instanceof Error && err.stack) {
        logError("[ExplainScreen] Error stack:", err.stack);
      }

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

    alert("Card added successfully!");
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="card">
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="Enter a sentence to explain..."
            rows={3}
            style={{ width: "100%", marginBottom: 16 }}
            maxLength={500}
          />

          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value as typeof focus)}
            style={{ width: "100%", marginBottom: 16 }}
          >
            <option value="english">Focus: English</option>
            <option value="spanish">Focus: Spanish</option>
            <option value="both">Focus: Both</option>
          </select>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={loading || !sentence.trim()}
          >
            {loading ? "Explaining..." : "Explain"}
          </button>
        </div>
      </form>

      {error && (
        <div className="card" style={{ background: "var(--danger)" }}>
          <p>{error}</p>
          <p style={{ fontSize: "0.875rem", marginTop: 8 }}>
            Make sure you're online and the API is configured.
          </p>
        </div>
      )}

      {result && (
        <div>
          <div className="card">
            <h3>Translations</h3>
            <p>
              <span className="lang-badge">JA</span> {result.translations.ja}
            </p>
            <p>
              <span className="lang-badge">EN</span> {result.translations.en}
            </p>
            <p>
              <span className="lang-badge">ES</span> {result.translations.es}
            </p>
          </div>

          <div className="card">
            <h3>Naturalness</h3>
            <p>Score: {result.naturalness.score_1_to_5}/5</p>
            <p>{result.naturalness.comment}</p>
          </div>

          {result.grammar_points.length > 0 && (
            <div className="card">
              <h3>Grammar Points</h3>
              {result.grammar_points.map((point, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <p style={{ fontWeight: 600 }}>{point.title}</p>
                  <p style={{ color: "var(--text-secondary)" }}>
                    {point.explanation}
                  </p>
                  <p style={{ fontStyle: "italic", color: "var(--accent)" }}>
                    "{point.example}"
                  </p>
                </div>
              ))}
            </div>
          )}

          {result.vocabulary.length > 0 && (
            <div className="card">
              <h3>Vocabulary</h3>
              {result.vocabulary.map((vocab, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{vocab.term}</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {" "}
                    - {vocab.meaning}
                  </span>
                  {vocab.notes && (
                    <p style={{ fontSize: "0.875rem" }}>{vocab.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {result.mistakes.length > 0 && (
            <div className="card" style={{ background: "var(--danger)" }}>
              <h3>Mistakes</h3>
              <ul>
                {result.mistakes.map((mistake, i) => (
                  <li key={i}>{mistake}</li>
                ))}
              </ul>
            </div>
          )}

          {result.alternatives.length > 0 && (
            <div className="card">
              <h3>Alternatives</h3>
              {result.alternatives.map((alt, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <span className="lang-badge" style={{ fontSize: "0.6rem" }}>
                    {alt.tone}
                  </span>
                  <p>
                    <span className="lang-badge" style={{ fontSize: "0.6rem" }}>
                      JA
                    </span>{" "}
                    {alt.ja}
                  </p>
                  <p>
                    <span className="lang-badge" style={{ fontSize: "0.6rem" }}>
                      EN
                    </span>{" "}
                    {alt.en}
                  </p>
                  <p>
                    <span className="lang-badge" style={{ fontSize: "0.6rem" }}>
                      ES
                    </span>{" "}
                    {alt.es}
                  </p>
                </div>
              ))}
            </div>
          )}

          {result.suggested_flashcard && (
            <div className="card" style={{ border: "2px solid var(--accent)" }}>
              <h3>Suggested Flashcard</h3>
              <p>
                <span className="lang-badge">JA</span>{" "}
                {result.suggested_flashcard.ja}
              </p>
              <p>
                <span className="lang-badge">EN</span>{" "}
                {result.suggested_flashcard.en}
              </p>
              <p>
                <span className="lang-badge">ES</span>{" "}
                {result.suggested_flashcard.es}
              </p>
              {result.suggested_flashcard.tags.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {result.suggested_flashcard.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <button
                className="btn btn-success"
                onClick={handleAddAsCard}
                style={{ width: "100%", marginTop: 16 }}
              >
                Add as Card
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
