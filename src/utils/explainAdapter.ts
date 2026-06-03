import type { ExplainResponse, TatoebaExample } from "../types";

export function normalizeExplainResponse(input: any): ExplainResponse {
  const detected_language = input?.detected_language ?? input?.language ?? 'ja';

  const translationsRaw = input?.translations ?? {};
  const translations = {
    ja: translationsRaw?.ja ?? input?.ja ?? '',
    en: translationsRaw?.en ?? input?.en ?? '',
    es: translationsRaw?.es ?? input?.es ?? '',
  };

  const naturalness = input?.naturalness ?? { score_1_to_5: 0, comment: '' };
  const grammar_points = input?.grammar_points ?? [];
  const vocabulary = input?.vocabulary ?? [];
  const alternatives = input?.alternatives ?? [];
  const mistakes = (input?.mistakes ?? []) as string[];

  const suggested_flashcard = input?.suggested_flashcard ?? {
    ja: input?.suggested_ja ?? '',
    en: input?.suggested_en ?? '',
    es: input?.suggested_es ?? '',
    tags: input?.suggested_tags ?? [],
  };

  const rawExamples = Array.isArray(input?.examples) ? input.examples : [];
  const examples: TatoebaExample[] = rawExamples
    .map((e: any): TatoebaExample | null => {
      const ja = typeof e?.ja === 'string' ? e.ja : '';
      const en = typeof e?.en === 'string' ? e.en : '';
      const es = typeof e?.es === 'string' ? e.es : '';
      if (!ja && !en && !es) return null;
      return { ja, en, es };
    })
    .filter((e: TatoebaExample | null): e is TatoebaExample => e !== null);

  return {
    detected_language,
    translations,
    naturalness,
    grammar_points,
    vocabulary,
    alternatives,
    mistakes,
    suggested_flashcard,
    examples,
  };
}
