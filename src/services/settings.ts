import { db } from '../db';

export type NativeLanguage = 'en' | 'es' | 'ja';
export type LearningMode = 'passive' | 'active' | 'mixed';

export interface LearningSettings {
  nativeLang: NativeLanguage;
  learningMode: LearningMode;
  preferWhisper: boolean;
  quizSize: number;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  customBackground: string | null;
  glassEnabled: boolean;
}

const DEFAULTS: LearningSettings = {
  nativeLang: 'en',
  learningMode: 'mixed',
  preferWhisper: false,
  quizSize: 10,
  dailyReminderEnabled: true,
  dailyReminderTime: '19:00',
  customBackground: null,
  glassEnabled: true,
};

async function readSettings(): Promise<LearningSettings> {
  const stored = await db.userSettings.get('singleton');
  if (stored) {
    return {
      nativeLang: stored.nativeLang as NativeLanguage,
      learningMode: stored.learningMode as LearningMode,
      preferWhisper: stored.preferWhisper,
      quizSize: stored.quizSize,
      dailyReminderEnabled: stored.dailyReminderEnabled,
      dailyReminderTime: stored.dailyReminderTime,
      customBackground: stored.customBackground || null,
      glassEnabled: stored.glassEnabled ?? true,
    };
  }
  // Migrate from legacy localStorage
  const legacy = migrateLegacySettings();
  await db.userSettings.put({ id: 'singleton', ...legacy });
  return legacy;
}

function migrateLegacySettings(): LearningSettings {
  const nativeLang = (localStorage.getItem('settings.nativeLang') || DEFAULTS.nativeLang) as NativeLanguage;
  const learningMode = (localStorage.getItem('settings.learningMode') || DEFAULTS.learningMode) as LearningMode;
  const preferWhisper = localStorage.getItem('settings.preferWhisper') === 'true';
  const quizSize = parseInt(localStorage.getItem('settings.quizSize') || String(DEFAULTS.quizSize), 10);
  const dailyReminderEnabled = localStorage.getItem('dailyQuiz.enabled') !== 'false';
  const dailyReminderTime = localStorage.getItem('dailyQuiz.time') || DEFAULTS.dailyReminderTime;
  // Clean up
  ['settings.nativeLang','settings.learningMode','settings.preferWhisper','settings.quizSize','dailyQuiz.enabled','dailyQuiz.time']
    .forEach(k => localStorage.removeItem(k));
  return { nativeLang, learningMode, preferWhisper, quizSize, dailyReminderEnabled, dailyReminderTime };
}

async function patchSettings(patch: Partial<LearningSettings>): Promise<void> {
  const current = await readSettings();
  await db.userSettings.put({ id: 'singleton', ...current, ...patch });
}

/* ── sync-compatible wrapper ── */
// VideoImportScreen calls getLearningSettings() synchronously for preferWhisper.
// We keep a synchronous cache that is seeded from localStorage migration for the
// initial call, and updated whenever async writes happen.
let _cache: LearningSettings | null = null;

async function ensureCache(): Promise<LearningSettings> {
  if (!_cache) _cache = await readSettings();
  return _cache;
}

// Synchronous snapshot used by callers that can't await
export function getLearningSettings(): LearningSettings {
  if (_cache) return _cache;
  // Fallback: read from the legacy keys one more time (migration may not have run yet)
  return {
    nativeLang: (localStorage.getItem('settings.nativeLang') || DEFAULTS.nativeLang) as NativeLanguage,
    learningMode: (localStorage.getItem('settings.learningMode') || DEFAULTS.learningMode) as LearningMode,
    preferWhisper: localStorage.getItem('settings.preferWhisper') === 'true',
    quizSize: parseInt(localStorage.getItem('settings.quizSize') || String(DEFAULTS.quizSize), 10),
    dailyReminderEnabled: localStorage.getItem('dailyQuiz.enabled') !== 'false',
    dailyReminderTime: localStorage.getItem('dailyQuiz.time') || DEFAULTS.dailyReminderTime,
    customBackground: null,
    glassEnabled: true,
  };
}

// Call this on app start to prime the cache
export async function initSettings(): Promise<LearningSettings> {
  _cache = await readSettings();
  return _cache;
}

export async function setNativeLang(lang: NativeLanguage): Promise<void> {
  await ensureCache();
  await patchSettings({ nativeLang: lang });
  if (_cache) _cache.nativeLang = lang;
}

export async function setLearningMode(mode: LearningMode): Promise<void> {
  await ensureCache();
  await patchSettings({ learningMode: mode });
  if (_cache) _cache.learningMode = mode;
}

export async function setPreferWhisper(prefer: boolean): Promise<void> {
  await ensureCache();
  await patchSettings({ preferWhisper: prefer });
  if (_cache) _cache.preferWhisper = prefer;
}

export async function setQuizSize(size: number): Promise<void> {
  await ensureCache();
  await patchSettings({ quizSize: size });
  if (_cache) _cache.quizSize = size;
}

export async function setDailyReminder(enabled: boolean, time: string): Promise<void> {
  await ensureCache();
  await patchSettings({ dailyReminderEnabled: enabled, dailyReminderTime: time });
  if (_cache) {
    _cache.dailyReminderEnabled = enabled;
    _cache.dailyReminderTime = time;
  }
}

export async function setCustomBackground(background: string | null): Promise<void> {
  await ensureCache();
  await patchSettings({ customBackground: background });
  if (_cache) _cache.customBackground = background;
}

export async function setGlassEnabled(enabled: boolean): Promise<void> {
  await ensureCache();
  await patchSettings({ glassEnabled: enabled });
  if (_cache) _cache.glassEnabled = enabled;
}
