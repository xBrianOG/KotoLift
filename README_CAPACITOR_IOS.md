Capacitor iOS packaging guide

Goal: Build the web app into a single production output folder (dist) and package via Capacitor for iOS.

1) Capacitor dependencies (already added)
- @capacitor/core
- @capacitor/cli
- @capacitor/ios

2) Initialize Capacitor and iOS project
- Initialize Capacitor if not present:
  npx cap init com.brian.languagelearning LanguageLearning
- Generate the iOS project (creates ios/):
  npx cap add ios
- If the iOS project already exists, you can skip the add step.

3) Ensure capacitor.webDir is set to the build output folder
- capacitor.config.ts (preferred) was added with:
  webDir: 'dist',
  appId: 'com.brian.languagelearning',
  appName: 'LanguageLearning',
  bundledWebRuntime: false

4) Build and sync steps
- Build the web assets into dist:
  npm run build
- Sync Capacitor native project dependencies and assets:
  npx cap sync ios
- Open Xcode project:
  npx cap open ios

5) Commands recap
- npm install
- npm run build
- npx cap add ios (only once)
- npx cap sync ios
- npx cap open ios

6) iOS build notes
- In Xcode, select a Team for signing (General > Signing) if using automatic signing.
- Choose a simulator (e.g., iPhone 14) and run from Xcode.
