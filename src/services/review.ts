import { db } from '../db';
import type { Card, ReviewState, Rating, Language } from '../types';
import { v4 as uuidv4 } from 'uuid';

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;

export async function getDueReviewStates(
  promptLang: Language,
  answerLang: Language,
  limit = 20
): Promise<Array<ReviewState & { card: Card }>> {
  const now = Date.now();
  
  let query = db.reviewStates
    .where('nextReviewAt')
    .belowOrEqual(now)
    .and(rs => rs.promptLang === promptLang && rs.answerLang === answerLang);

  const dueStates = await query.toArray();
  
  const sortedStates = dueStates
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
    .slice(0, limit);

  const cardIds = [...new Set(sortedStates.map(s => s.cardId))];
  const cards = await db.cards.where('id').anyOf(cardIds).toArray();
  const cardMap = new Map(cards.map(c => [c.id, c]));
  
  return sortedStates
    .map(state => ({ ...state, card: cardMap.get(state.cardId)! }))
    .filter(item => item.card);
}

export async function getMixedReviewStates(
  directions: Array<{ promptLang: Language; answerLang: Language }>,
  limit = 20
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
    const cards = await db.cards.where('id').anyOf(cardIds).toArray();
    const cardMap = new Map(cards.map(c => [c.id, c]));
    
    for (const state of due) {
      const card = cardMap.get(state.cardId);
      if (card) {
        allDue.push({ ...state, card });
      }
    }
  }

  return allDue
    .sort(() => Math.random() - 0.5)
    .slice(0, limit);
}

export async function rateReview(rating: Rating, reviewState: ReviewState): Promise<void> {
  const now = Date.now();
  let intervalDays: number;
  let nextReviewAt: number;

  switch (rating) {
    case 'again':
      intervalDays = 0;
      nextReviewAt = now + TEN_MINUTES;
      break;
    case 'good':
      intervalDays = Math.max(1, reviewState.intervalDays === 0 ? 1 : Math.round(reviewState.intervalDays * 2));
      nextReviewAt = now + intervalDays * MILLIS_PER_DAY;
      break;
    case 'easy':
      intervalDays = Math.max(3, reviewState.intervalDays === 0 ? 3 : Math.round(reviewState.intervalDays * 3));
      nextReviewAt = now + intervalDays * MILLIS_PER_DAY;
      break;
  }

  await db.reviewStates.update(reviewState.id, {
    intervalDays,
    nextReviewAt,
    updatedAt: now
  });
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
    updatedAt: now
  };
  await db.reviewStates.add(reviewState);
  return reviewState;
}

export async function ensureReviewStates(card: Card): Promise<void> {
  const directions: Array<{ promptLang: Language; answerLang: Language }> = [
    { promptLang: 'ja', answerLang: 'en' },
    { promptLang: 'ja', answerLang: 'es' },
    { promptLang: 'en', answerLang: 'ja' },
    { promptLang: 'es', answerLang: 'ja' },
  ];

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
