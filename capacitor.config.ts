import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor configuration for iOS packaging
const config: CapacitorConfig = {
  appId: 'com.brian.languagelearning',
  appName: 'LanguageLearning',
  webDir: 'dist',
  bundledWebRuntime: false
};

export default config;
