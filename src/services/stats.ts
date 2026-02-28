const STREAK_KEY = 'userStats.streak';
const STREAK_DATE_KEY = 'userStats.streakDate';
const STARS_KEY = 'userStats.stars';
const LAST_SESSION_KEY = 'userStats.lastSession';

export interface UserStats {
  streak: number;
  stars: number;
  lastSessionDate: string | null;
}

export function getStats(): UserStats {
  const streak = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);
  const stars = parseInt(localStorage.getItem(STARS_KEY) || '0', 10);
  const lastSessionDate = localStorage.getItem(LAST_SESSION_KEY);
  return { streak, stars, lastSessionDate };
}

export function addStars(count: number): void {
  const current = parseInt(localStorage.getItem(STARS_KEY) || '0', 10);
  localStorage.setItem(STARS_KEY, String(current + count));
}

export function updateStreak(): void {
  const today = new Date().toDateString();
  const lastDate = localStorage.getItem(STREAK_DATE_KEY);
  const currentStreak = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);

  if (lastDate === today) {
    return;
  }

  const yesterday = new Date(Date.now() - 86400000).toDateString();
  
  if (lastDate === yesterday) {
    localStorage.setItem(STREAK_KEY, String(currentStreak + 1));
  } else if (lastDate !== today) {
    localStorage.setItem(STREAK_KEY, '1');
  }
  
  localStorage.setItem(STREAK_DATE_KEY, today);
}
