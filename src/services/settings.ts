export type NativeLanguage = 'en' | 'es' | 'ja';
export type LearningMode = 'passive' | 'active' | 'mixed';

export interface LearningSettings {
  nativeLang: NativeLanguage;
  learningMode: LearningMode;
  preferWhisper: boolean;
}

const NATIVE_LANG_KEY = 'settings.nativeLang';
const LEARNING_MODE_KEY = 'settings.learningMode';
const PREFER_WHISPER_KEY = 'settings.preferWhisper';

export function getLearningSettings(): LearningSettings {
  const nativeLang = localStorage.getItem(NATIVE_LANG_KEY) as NativeLanguage || 'en';
  const learningMode = localStorage.getItem(LEARNING_MODE_KEY) as LearningMode || 'mixed';
  const preferWhisper = localStorage.getItem(PREFER_WHISPER_KEY) === 'true';
  return { nativeLang, learningMode, preferWhisper };
}

export function setNativeLang(lang: NativeLanguage): void {
  localStorage.setItem(NATIVE_LANG_KEY, lang);
}

export function setLearningMode(mode: LearningMode): void {
  localStorage.setItem(LEARNING_MODE_KEY, mode);
}

export function setPreferWhisper(prefer: boolean): void {
  localStorage.setItem(PREFER_WHISPER_KEY, String(prefer));
}
