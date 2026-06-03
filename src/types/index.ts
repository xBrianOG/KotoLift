export type Language = 'ja' | 'en' | 'es' | 'ko' | 'zh' | 'fr' | 'de';

export interface Card {
  id: string;
  // New flexible model
  sourceText?: string;
  sourceLang?: string;
  translations?: Record<string, string | undefined>;
  // Legacy fields (for backward compatibility)
  jaText?: string;
  enText?: string;
  esText?: string;
  tags: string[];
  notes?: string;
  // Deck/import tracking
  deckId?: string;
  deckName?: string;
  // Audio for pronunciation
  audioUrl?: string;
  // Source tracking for video imports
  sourceUrl?: string;
  startMs?: number;
  endMs?: number;
  createdAt: number;
}

// Helper to get display text from a card
export function getCardSourceText(card: Card): string {
  if (card.sourceText) return card.sourceText;
  return card.jaText || '';
}

export function getCardTranslation(card: Card, lang: string): string | undefined {
  if (card.translations) return card.translations[lang];
  if (lang === 'ja') return card.jaText;
  if (lang === 'en') return card.enText;
  if (lang === 'es') return card.esText;
  return undefined;
}

export interface ReviewState {
  id: string;
  cardId: string;
  promptLang: Language;
  answerLang: Language;
  nextReviewAt: number;
  intervalDays: number;
  updatedAt: number;
}

export type Rating = 'again' | 'good' | 'easy';

export type ReviewDirection = 'ja-en' | 'ja-es' | 'en-ja' | 'es-ja' | 'mixed';

export interface Deck {
  id: string;
  name: string;
  description?: string;
  cardCount: number;
  createdAt: number;
  source?: 'import' | 'manual';
}

export interface ExplainRequest {
  sentence: string;
  focus: 'english' | 'spanish' | 'both';
}

export interface TatoebaExample {
  ja: string;
  en: string;
  es: string;
}

export interface ExplainResponse {
  detected_language: 'ja' | 'en' | 'es';
  translations: { ja: string; en: string; es: string };
  naturalness: { score_1_to_5: number; comment: string };
  grammar_points: Array<{ title: string; explanation: string; example: string }>;
  vocabulary: Array<{ term: string; meaning: string; notes: string }>;
  alternatives: Array<{ tone: 'neutral' | 'casual' | 'formal'; ja: string; en: string; es: string }>;
  mistakes: string[];
  suggested_flashcard: { ja: string; en: string; es: string; tags: string[] };
  examples?: TatoebaExample[];
}
