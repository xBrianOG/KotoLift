import { Capacitor } from "@capacitor/core";

// Lazy-load Local Notifications plugin on native platforms only
async function getLocalNotifications(): Promise<any | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const mod = await import("@capacitor/local-notifications");
    return (mod as any).LocalNotifications ?? null;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const L = await getLocalNotifications();
  if (!L) return false;
  try {
    const perm = await L.requestPermissions();
    const val = perm?.display ?? perm?.value ?? false;
    return !!val;
  } catch {
    return false;
  }
}

export async function scheduleDailyNotification(hour: number, minute: number, id: string = 'daily-quiz') {
  const L = await getLocalNotifications();
  if (!L) return;
  try {
    await L.schedule({
      notifications: [
        {
          id,
          title: 'Daily Quiz',
          body: 'Daily Quiz is ready ✨',
          schedule: { every: 'day', hour, minute } as any,
        },
      ],
    } as any);
  } catch (e) {
    console.error('Failed to schedule daily notification', e);
  }
}

export async function cancelDailyNotification(id: string = 'daily-quiz') {
  const L = await getLocalNotifications();
  if (!L) return;
  try {
    await L.cancel({ notifications: [{ id }] } as any);
  } catch {
    // ignore
  }
}

export async function initNotifications() {
  try {
    const enabledRaw = localStorage.getItem('dailyQuiz.enabled');
    const time = localStorage.getItem('dailyQuiz.time') || '19:00';
    const [hourStr, minuteStr] = time.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const enabled = enabledRaw !== 'false';
    const h = Number.isFinite(hour) ? hour : 19;
    const m = Number.isFinite(minute) ? minute : 0;

    if (enabled) {
      const ok = await requestNotificationPermission();
      if (ok) {
        await scheduleDailyNotification(isNaN(h) ? 19 : h, isNaN(m) ? 0 : m);
      }
    } else {
      await cancelDailyNotification();
    }
  } catch {
    // swallow errors, do not crash app
  }
}
