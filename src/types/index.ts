export type Language = 'ja' | 'en' | 'es';

export interface Card {
  id: string;
  jaText: string;
  enText: string;
  esText: string;
  tags: string[];
  notes?: string;
  createdAt: number;
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

export interface ExplainRequest {
  sentence: string;
  focus: 'english' | 'spanish' | 'both';
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
}
