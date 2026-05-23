import { db } from '../db';
import { getAllCards } from './cards';
import type { Card, ReviewState, Rating, Language } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Expose ease factor on ReviewState in DB (stored as extra field)
interface ReviewStateWithEF extends ReviewState {
  easeFactor?: number;
}

const MILLIS_PER_DAY = 24 * 60 * 60 * 1_000;
const TEN_MINUTES = 10 * 60 * 1_000;
const DEFAULT_EF = 2.5;

/** SM-2 rating mapping: again=0, good=3, easy=5 */
function ratingToQuality(rating: Rating): number {
  switch (rating) {
    case 'again': return 0;
    case 'good':  return 3;
    case 'easy':  return 5;
  }
}

/** SM-2 ease factor update. EF must stay >= 1.3 */
function updateEF(ef: number, q: number): number {
  const next = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return Math.max(1.3, next);
}

export async function getDueReviewStates(
  promptLang: Language,
  answerLang: Language,
  limit = 1000
): Promise<Array<ReviewState & { card: Card }>> {
  const now = Date.now();

  const dueStates = await db.reviewStates
    .where('nextReviewAt')
    .belowOrEqual(now)
    .and(rs => rs.promptLang === promptLang && rs.answerLang === answerLang)
    .toArray();

  const sortedStates = dueStates
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
    .slice(0, limit);

  const cardIds = [...new Set(sortedStates.map(s => s.cardId))];
  const allCards = await getAllCards();
  const cards = allCards.filter(c => cardIds.includes(c.id));
  const cardMap = new Map(cards.map(c => [c.id, c]));

  return sortedStates
    .map(state => ({ ...state, card: cardMap.get(state.cardId)! }))
    .filter(item => item.card);
}

export async function getMixedReviewStates(
  directions: Array<{ promptLang: Language; answerLang: Language }>,
  limit = 1000
): Promise<Array<ReviewState & { card: Card }>> {
  const now = Date.now();
  const allDue: Array<ReviewState & { card: Card }> = [];

  for (const dir of directions) {
    const due = await db.reviewStates
      .where('nextReviewAt')
      .belowOrEqual(now)
      .and(rs => rs.promptLang === dir.promptLang && rs.answerLang === dir.answerLang)
      .toArray();

    const cardIds = [...new Set(due.map(s => s.cardId))];
    const allCards = await getAllCards();
    const cards = allCards.filter(c => cardIds.includes(c.id));
    const cardMap = new Map(cards.map(c => [c.id, c]));

    for (const state of due) {
      const card = cardMap.get(state.cardId);
      if (card) allDue.push({ ...state, card });
    }
  }

  return allDue
    .sort(() => Math.random() - 0.5)
    .slice(0, limit);
}

export async function getPracticeReviewStates(
  promptLang: Language,
  answerLang: Language,
  limit = 100
): Promise<Array<ReviewState & { card: Card }>> {
  const allStates = await db.reviewStates
    .where('promptLang').equals(promptLang)
    .and(rs => rs.answerLang === answerLang)
    .toArray();

  const shuffled = allStates.sort(() => Math.random() - 0.5).slice(0, limit);

  const cardIds = [...new Set(shuffled.map(s => s.cardId))];
  const allCards = await getAllCards();
  const cards = allCards.filter(c => cardIds.includes(c.id));
  const cardMap = new Map(cards.map(c => [c.id, c]));

  return shuffled
    .map(state => ({ ...state, card: cardMap.get(state.cardId)! }))
    .filter(item => item.card);
}

export async function getMixedPracticeReviewStates(
  directions: Array<{ promptLang: Language; answerLang: Language }>,
  limit = 100
): Promise<Array<ReviewState & { card: Card }>> {
  const allStates = await db.reviewStates.toArray();
  const filtered = allStates.filter(rs =>
    directions.some(d => d.promptLang === rs.promptLang && d.answerLang === rs.answerLang)
  );

  const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, limit);

  const cardIds = [...new Set(shuffled.map(s => s.cardId))];
  const allCards = await getAllCards();
  const cards = allCards.filter(c => cardIds.includes(c.id));
  const cardMap = new Map(cards.map(c => [c.id, c]));

  return shuffled
    .map(state => ({ ...state, card: cardMap.get(state.cardId)! }))
    .filter(item => item.card);
}

/** SM-2 spaced repetition rating */
export async function rateReview(rating: Rating, reviewState: ReviewState): Promise<void> {
  const now = Date.now();
  const q = ratingToQuality(rating);
  const ef = updateEF((reviewState as ReviewStateWithEF).easeFactor ?? DEFAULT_EF, q);

  let intervalDays: number;
  let nextReviewAt: number;

  if (rating === 'again') {
    // Lapse: reset interval, review again in 10 minutes
    intervalDays = 0;
    nextReviewAt = now + TEN_MINUTES;
  } else {
    if (reviewState.intervalDays === 0) {
      intervalDays = 1;
    } else if (reviewState.intervalDays === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(reviewState.intervalDays * ef);
    }
    // Add a small fuzz factor (±5%) to prevent cards all reviewing on same day
    const fuzz = 1 + (Math.random() * 0.1 - 0.05);
    intervalDays = Math.max(1, Math.round(intervalDays * fuzz));
    nextReviewAt = now + intervalDays * MILLIS_PER_DAY;
  }

  await db.reviewStates.update(reviewState.id, {
    intervalDays,
    nextReviewAt,
    updatedAt: now,
    // Store ease factor (Dexie allows extra fields not in the index)
    easeFactor: ef,
  } as Partial<ReviewState>);
}

export async function createReviewState(
  cardId: string,
  promptLang: Language,
  answerLang: Language
): Promise<ReviewState> {
  const now = Date.now();
  const reviewState: ReviewState = {
    id: uuidv4(),
    cardId,
    promptLang,
    answerLang,
    nextReviewAt: now,
    intervalDays: 0,
    updatedAt: now,
  };
  await db.reviewStates.add(reviewState);
  return reviewState;
}

/** Creates review states for ALL relevant language directions based on the card's sourceLang */
export async function ensureReviewStates(card: Card): Promise<void> {
  const source = (card.sourceLang || 'ja') as Language;

  // Determine which target languages this card has translations for
  const translations = card.translations || {};
  const legacyTargets: Language[] = [];
  if (card.enText) legacyTargets.push('en');
  if (card.esText) legacyTargets.push('es');
  if (card.jaText && source !== 'ja') legacyTargets.push('ja');

  const allLangs = new Set<Language>([
    ...Object.keys(translations).filter(l => !!translations[l]) as Language[],
    ...legacyTargets,
  ]);
  allLangs.delete(source); // remove source itself

  const directions: Array<{ promptLang: Language; answerLang: Language }> = [];
  allLangs.forEach(target => {
    directions.push({ promptLang: source, answerLang: target }); // source → target
    directions.push({ promptLang: target, answerLang: source }); // target → source
  });

  const existing = await db.reviewStates
    .where('cardId')
    .equals(card.id)
    .toArray();

  const existingKeys = new Set(existing.map(e => `${e.promptLang}-${e.answerLang}`));

  for (const dir of directions) {
    const key = `${dir.promptLang}-${dir.answerLang}`;
    if (!existingKeys.has(key)) {
      await createReviewState(card.id, dir.promptLang, dir.answerLang);
    }
  }
}
