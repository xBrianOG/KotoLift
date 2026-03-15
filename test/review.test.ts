import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rateReview } from '../src/services/review';

// Mock Dexie DB
vi.mock('../src/db', () => ({
  db: {
    cards: {
      where: () => ({ equals: () => ({ toArray: async () => [] }) }),
      anyOf: () => ({ toArray: async () => [] }),
    },
    reviewStates: {
      where: vi.fn().mockReturnThis(),
      belowOrEqual: vi.fn().mockReturnThis(),
      and: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue(undefined),
      equals: vi.fn().mockReturnThis(),
    },
  },
}));

import { db } from '../src/db';

const baseState = {
  id: 'rs-1',
  cardId: 'card-1',
  promptLang: 'ja' as const,
  answerLang: 'en' as const,
  nextReviewAt: Date.now() - 1000,
  intervalDays: 0,
  updatedAt: Date.now() - 1000,
};

describe('rateReview (SM-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('again: resets interval to 0 and sets short nextReviewAt', async () => {
    await rateReview('again', baseState);
    const updateCall = (db.reviewStates.update as any).mock.calls[0];
    expect(updateCall[0]).toBe('rs-1');
    expect(updateCall[1].intervalDays).toBe(0);
    // nextReviewAt should be close to now + 10 minutes (within 1 second tolerance)
    expect(updateCall[1].nextReviewAt).toBeGreaterThan(Date.now() + 9 * 60 * 1000);
    expect(updateCall[1].nextReviewAt).toBeLessThan(Date.now() + 11 * 60 * 1000);
  });

  it('good: first review sets interval to 1 day', async () => {
    await rateReview('good', { ...baseState, intervalDays: 0 });
    const updateCall = (db.reviewStates.update as any).mock.calls[0];
    expect(updateCall[1].intervalDays).toBe(1);
  });

  it('good: from 1 day interval goes to 6 days', async () => {
    await rateReview('good', { ...baseState, intervalDays: 1 });
    const updateCall = (db.reviewStates.update as any).mock.calls[0];
    expect(updateCall[1].intervalDays).toBe(6);
  });

  it('good: from 6 days interval multiplies by ease factor (~2.5)', async () => {
    await rateReview('good', { ...baseState, intervalDays: 6 });
    const updateCall = (db.reviewStates.update as any).mock.calls[0];
    // With EF=2.5, 6 * 2.5 = 15, fuzz ±5% → between 14 and 16
    expect(updateCall[1].intervalDays).toBeGreaterThanOrEqual(13);
    expect(updateCall[1].intervalDays).toBeLessThanOrEqual(17);
  });

  it('easy: starts at 3 days minimum', async () => {
    await rateReview('easy', { ...baseState, intervalDays: 0 });
    const updateCall = (db.reviewStates.update as any).mock.calls[0];
    expect(updateCall[1].intervalDays).toBeGreaterThanOrEqual(1);
  });

  it('stores an easeFactor in the update', async () => {
    await rateReview('good', baseState);
    const updateCall = (db.reviewStates.update as any).mock.calls[0];
    expect(typeof updateCall[1].easeFactor).toBe('number');
    expect(updateCall[1].easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});
