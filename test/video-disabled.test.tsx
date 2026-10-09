// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const statsMocks = vi.hoisted(() => ({
  getStats: vi.fn(),
}));

vi.mock('../src/services/stats', () => ({
  getStats: statsMocks.getStats,
}));

vi.mock('../src/services/cards', () => ({
  createCard: vi.fn(),
  getAllCards: vi.fn(),
}));

vi.mock('../src/services/review', () => ({
  ensureReviewStates: vi.fn(),
}));

import { HomeScreen } from '../src/components/HomeScreen';
import { AddCardScreen } from '../src/components/AddCardScreen';

function installMemoryStorage(): void {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  };
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
}

async function render(element: React.ReactElement): Promise<Root> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return root;
}

async function waitFor(assertion: () => void): Promise<void> {
  const started = Date.now();
  let lastError: unknown;
  while (Date.now() - started < 1000) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }
  }
  throw lastError;
}

describe('disabled video entry points', () => {
  let root: Root | undefined;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    installMemoryStorage();
    document.body.innerHTML = '';
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    statsMocks.getStats.mockResolvedValue({
      id: 'singleton',
      streak: 0,
      stars: 0,
      streakDate: null,
      lastSessionDate: null,
      totalCards: 0,
    });
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = undefined;
    }
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('keeps a disabled accessible Home entry for video learning', async () => {
    const navigate = vi.fn();
    root = await render(<HomeScreen onNavigate={navigate} />);

    await waitFor(() => expect(document.body.textContent).toContain('Video learning — Coming soon'));
    const videoButton = Array.from(document.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Video learning')) as HTMLButtonElement;

    expect(videoButton).toBeTruthy();
    expect(videoButton.disabled).toBe(true);
    expect(videoButton.getAttribute('aria-disabled')).toBe('true');

    await act(async () => {
      videoButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(navigate).not.toHaveBeenCalledWith('videoLearning');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('disables video import on the Add Card screen without affecting manual card fields', async () => {
    root = await render(<AddCardScreen onSave={vi.fn()} />);

    const importButton = Array.from(document.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Import from video')) as HTMLButtonElement;

    expect(importButton).toBeTruthy();
    expect(importButton.disabled).toBe(true);
    expect(importButton.getAttribute('aria-disabled')).toBe('true');
    expect(document.body.textContent).toContain('Manual flashcards still work.');
    expect(document.querySelector('textarea[placeholder="日本語の文"]')).toBeTruthy();
  });
});

describe('video navigation guard', () => {
  let root: Root | undefined;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    installMemoryStorage();
    document.body.innerHTML = '';
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = undefined;
    }
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.doUnmock('../src/App');
  });

  it('blocks video screens even if navigation is requested directly', async () => {
    vi.doMock('../src/services/auth', () => ({
      isLoggedIn: () => true,
      clearAuth: vi.fn(),
      devLogin: vi.fn(),
      isDevMode: () => false,
      getStoredUser: () => ({ id: 'user-1', name: 'User' }),
    }));
    vi.doMock('../src/services/settings', () => ({
      initSettings: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock('../src/components/AppShell', () => ({
      AppShell: ({ children, onNavigate }: { children: React.ReactNode; onNavigate: (to: string) => void }) => (
        <div>
          <button onClick={() => onNavigate('videoLearning')}>Open video learning</button>
          <button onClick={() => onNavigate('videoImport')}>Open video import</button>
          <button onClick={() => onNavigate('videoPlayer')}>Open video player</button>
          <button onClick={() => onNavigate('transcript')}>Open transcript</button>
          <button onClick={() => onNavigate('add')}>Open add</button>
          {children}
        </div>
      ),
    }));
    vi.doMock('../src/components/HomeScreen', () => ({ HomeScreen: () => <div>Home Screen</div> }));
    vi.doMock('../src/components/AddCardScreen', () => ({ AddCardScreen: () => <div>Add Screen</div> }));
    vi.doMock('../src/components/ReviewScreen', () => ({ ReviewScreen: () => <div>Review Screen</div> }));
    vi.doMock('../src/components/CardListScreen', () => ({ CardListScreen: () => <div>Cards Screen</div> }));
    vi.doMock('../src/components/DrillScreen', () => ({ DrillScreen: () => <div>Drill Screen</div> }));
    vi.doMock('../src/components/ExplainScreen', () => ({ ExplainScreen: () => <div>Explain Screen</div> }));
    vi.doMock('../src/components/SettingsScreen', () => ({ SettingsScreen: () => <div>Settings Screen</div> }));
    vi.doMock('../src/components/ProfileScreen', () => ({ ProfileScreen: () => <div>Profile Screen</div> }));
    vi.doMock('../src/components/LessonsScreen', () => ({ LessonsScreen: () => <div>Lessons Screen</div> }));
    vi.doMock('../src/components/VocabularyScreen', () => ({ VocabularyScreen: () => <div>Vocabulary Screen</div> }));
    vi.doMock('../src/components/AssessmentScreen', () => ({ AssessmentScreen: () => <div>Assessment Screen</div> }));
    vi.doMock('../src/components/DeckListScreen', () => ({ DeckListScreen: () => <div>Decks Screen</div> }));
    vi.doMock('../src/components/DeckCardsScreen', () => ({ DeckCardsScreen: () => <div>Deck Cards Screen</div> }));
    vi.doMock('../src/components/ImportScreen', () => ({ ImportScreen: () => <div>Import Screen</div> }));
    vi.doMock('../src/components/LanguagePicker', () => ({ LanguagePicker: () => <div>Language Picker</div> }));

    const { default: App } = await import('../src/App');
    root = await render(<App />);

    await waitFor(() => expect(document.body.textContent).toContain('Home Screen'));

    for (const label of ['Open video learning', 'Open video import', 'Open video player', 'Open transcript']) {
      const button = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent === label);
      await act(async () => {
        button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(document.body.textContent).toContain('Home Screen');
      expect(document.body.textContent).not.toContain('Video Screen');
    }

    const addButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent === 'Open add');
    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Add Screen');
    expect(fetch).not.toHaveBeenCalled();
  });
});
