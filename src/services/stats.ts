import { db } from '../db';
import type { StoredUserStats } from '../db';
import { getStoredUser } from './auth';
import { getAllCards } from './cards';

const DEFAULT_STATS: StoredUserStats = {
  id: 'singleton',
  streak: 0,
  stars: 0,
  streakDate: null,
  lastSessionDate: null,
};

export type { StoredUserStats as UserStats };

/* ── helpers ── */

async function readStats(): Promise<StoredUserStats & { totalCards: number | null }> {
  const stored = await db.userStats.get('singleton');
  
  // Get card count using existing function
  let totalCards: number | null = null;
  try {
    const cards = await getAllCards();
    totalCards = cards.length;
  } catch (e) {
    console.error('Failed to fetch card count:', e);
  }
  
  if (stored) return { ...stored, totalCards: totalCards };
  // Migrate from legacy localStorage if present
  const legacy = migrateLegacyStats();
  await db.userStats.put(legacy);
  return { ...legacy, totalCards: totalCards };
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

function toStoredStats(stats: StoredUserStats & { totalCards: number | null }): StoredUserStats {
  return {
    id: stats.id,
    streak: stats.streak,
    stars: stats.stars,
    streakDate: stats.streakDate,
    lastSessionDate: stats.lastSessionDate,
  };
}

/* ── public API ── */

export async function getStats(): Promise<StoredUserStats & { totalCards: number | null }> {
  return readStats();
}

export async function addStars(count: number): Promise<void> {
  const stats = await readStats();
  await db.userStats.put({ ...toStoredStats(stats), stars: stats.stars + count });
}

export async function updateStreak(): Promise<void> {
  const stats = await readStats();
  const today = new Date().toDateString();
  if (stats.streakDate === today) return;

  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const newStreak = stats.streakDate === yesterday ? stats.streak + 1 : 1;

  await db.userStats.put({
    ...toStoredStats(stats),
    streak: newStreak,
    streakDate: today,
    lastSessionDate: today,
  });
}
