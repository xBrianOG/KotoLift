import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAllCards: vi.fn(),
  userStatsGet: vi.fn(),
  userStatsPut: vi.fn(),
}));

vi.mock('../src/services/cards', () => ({
  getAllCards: mocks.getAllCards,
}));

vi.mock('../src/db', () => ({
  db: {
    userStats: {
      get: mocks.userStatsGet,
      put: mocks.userStatsPut,
    },
  },
}));

import { getStats } from '../src/services/stats';

describe('stats card count availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userStatsGet.mockResolvedValue({
      id: 'singleton',
      streak: 3,
      stars: 5,
      streakDate: null,
      lastSessionDate: null,
    });
  });

  it('returns null for unavailable card count instead of pretending it is zero', async () => {
    mocks.getAllCards.mockRejectedValueOnce(new Error('backend unavailable'));

    const stats = await getStats();

    expect(stats.streak).toBe(3);
    expect(stats.totalCards).toBeNull();
  });

  it('returns a real zero when a successful response has no cards', async () => {
    mocks.getAllCards.mockResolvedValueOnce([]);

    const stats = await getStats();

    expect(stats.totalCards).toBe(0);
  });
});
