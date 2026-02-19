import Dexie, { type Table } from 'dexie';
import type { Card, ReviewState } from '../types';

export class SentenceCoachDB extends Dexie {
  cards!: Table<Card>;
  reviewStates!: Table<ReviewState>;

  constructor() {
    super('SentenceCoachDB');
    this.version(1).stores({
      cards: 'id, createdAt, *tags',
      reviewStates: 'id, cardId, promptLang, answerLang, nextReviewAt, [cardId+promptLang+answerLang]'
    });
  }
}

export const db = new SentenceCoachDB();
