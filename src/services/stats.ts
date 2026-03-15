import { db } from '../db';
import type { StoredUserStats } from '../db';

const DEFAULT_STATS: StoredUserStats = {
  id: 'singleton',
  streak: 0,
  stars: 0,
  streakDate: null,
  lastSessionDate: null,
};

export type { StoredUserStats as UserStats };

/* ── helpers ── */

async function readStats(): Promise<StoredUserStats> {
  const stored = await db.userStats.get('singleton');
  if (stored) return stored;
  // Migrate from legacy localStorage if present
  const legacy = migrateLegacyStats();
  await db.userStats.put(legacy);
  return legacy;
}

function migrateLegacyStats(): StoredUserStats {
  const streak = parseInt(localStorage.getItem('userStats.streak') || '0', 10);
  const stars  = parseInt(localStorage.getItem('userStats.stars')  || '0', 10);
  const streakDate = localStorage.getItem('userStats.streakDate');
  const lastSessionDate = localStorage.getItem('userStats.lastSession');
  // Clean up old keys
  ['userStats.streak','userStats.streakDate','userStats.stars','userStats.lastSession']
    .forEach(k => localStorage.removeItem(k));
  return { id: 'singleton', streak, stars, streakDate, lastSessionDate };
}

/* ── public API ── */

export async function getStats(): Promise<StoredUserStats> {
  return readStats();
}

export async function addStars(count: number): Promise<void> {
  const stats = await readStats();
  await db.userStats.put({ ...stats, stars: stats.stars + count });
}

export async function updateStreak(): Promise<void> {
  const stats = await readStats();
  const today = new Date().toDateString();
  if (stats.streakDate === today) return;

  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const newStreak = stats.streakDate === yesterday ? stats.streak + 1 : 1;

  await db.userStats.put({
    ...stats,
    streak: newStreak,
    streakDate: today,
    lastSessionDate: today,
  });
}
