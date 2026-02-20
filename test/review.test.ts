import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest'
import { rateReview } from '../src/services/review'

// Mock the Dexie DB module that review.ts imports
const mockUpdate = vi.fn()
vi.mock('../src/db', () => ({
  db: {
    reviewStates: {
      update: mockUpdate,
    },
    cards: {
      // not used in these tests
      add: vi.fn(),
    },
  },
}))

describe('rateReview', () => {
  const FIXED_NOW = new Date('2026-01-01T00:00:00Z').getTime()

  beforeAll(() => {
    // Use fake timers to fix the "now" used by rateReview
    // @ts-ignore
    vi.useFakeTimers()
    // @ts-ignore
    vi.setSystemTime(new Date(FIXED_NOW))
  })

  afterAll(() => {
    // Restore timers
    vi.useRealTimers()
  })

  afterEach(() => {
    mockUpdate.mockClear()
  })

  it('calculates nextReviewAt and intervalDays for rating "again"', async () => {
    const now = FIXED_NOW
    const reviewState: any = {
      id: 'r1',
      cardId: 'c1',
      promptLang: 'ja',
      answerLang: 'en',
      nextReviewAt: 0,
      intervalDays: 0,
      updatedAt: now,
    }

    await rateReview('again' as any, reviewState)

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    const [id, updates] = mockUpdate.mock.calls[0]
    expect(id).toBe('r1')
    // nextReviewAt = now + 10 minutes (600,000 ms)
    expect(updates.nextReviewAt).toBe(now + 600000)
    expect(updates.intervalDays).toBe(0)
    expect(updates.updatedAt).toBe(now)
  })

  it('calculates nextReviewAt and intervalDays for rating "good"', async () => {
    const now = FIXED_NOW
    const reviewState: any = {
      id: 'r2',
      cardId: 'c2',
      promptLang: 'ja',
      answerLang: 'en',
      nextReviewAt: 0,
      intervalDays: 0,
      updatedAt: now,
    }

    await rateReview('good' as any, reviewState)

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    const [id, updates] = mockUpdate.mock.calls[0]
    expect(id).toBe('r2')
    // intervalDays should be 1 when starting from 0
    expect(updates.intervalDays).toBe(1)
    // nextReviewAt should be now + 1 day
    expect(updates.nextReviewAt).toBe(now + 86400000)
  })

  it('calculates nextReviewAt and intervalDays for rating "easy"', async () => {
    const now = FIXED_NOW
    const reviewState: any = {
      id: 'r3',
      cardId: 'c3',
      promptLang: 'ja',
      answerLang: 'en',
      nextReviewAt: 0,
      intervalDays: 0,
      updatedAt: now,
    }

    await rateReview('easy' as any, reviewState)

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    const [id, updates] = mockUpdate.mock.calls[0]
    expect(id).toBe('r3')
    // intervalDays should be 3 when starting from 0
    expect(updates.intervalDays).toBe(3)
    // nextReviewAt should be now + 3 days
    expect(updates.nextReviewAt).toBe(now + 3 * 86400000)
  })
})
