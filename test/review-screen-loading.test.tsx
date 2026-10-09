// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Card, ReviewState } from '../src/types';

const reviewMocks = vi.hoisted(() => ({
  getDueReviewStates: vi.fn(),
  getMixedReviewStates: vi.fn(),
  getPracticeReviewStates: vi.fn(),
  getMixedPracticeReviewStates: vi.fn(),
  rateReview: vi.fn(),
}));

vi.mock('../src/services/review', () => reviewMocks);
vi.mock('../src/services/stats', () => ({
  addStars: vi.fn(),
  updateStreak: vi.fn(),
}));
vi.mock('../src/components/AudioControls', () => ({
  AudioControls: () => <button>Audio</button>,
}));

import { ReviewScreen } from '../src/components/ReviewScreen';

function makeReviewCard(): ReviewState & { card: Card } {
  return {
    id: 'rs-1',
    cardId: 'card-1',
    promptLang: 'ja',
    answerLang: 'en',
    nextReviewAt: Date.now() - 1000,
    intervalDays: 0,
    updatedAt: Date.now() - 1000,
    card: {
      id: 'card-1',
      sourceText: '猫',
      sourceLang: 'ja',
      translations: { ja: '猫', en: 'cat' },
      tags: [],
      createdAt: Date.now(),
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function renderReview(): Promise<Root> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ReviewScreen />);
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

describe('ReviewScreen loading behavior', () => {
  let root: Root | undefined;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    installMemoryStorage();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = undefined;
    }
    document.body.innerHTML = '';
  });

  it('shows loading while review cards are still loading', async () => {
    const load = deferred<Array<ReviewState & { card: Card }>>();
    reviewMocks.getDueReviewStates.mockReturnValueOnce(load.promise);

    root = await renderReview();

    expect(document.body.textContent).toContain('Loading your cards...');
    expect(document.body.textContent).not.toContain('All caught up!');

    await act(async () => load.resolve([]));
  });

  it('shows caught-up empty state only after a successful empty response', async () => {
    reviewMocks.getDueReviewStates.mockResolvedValueOnce([]);

    root = await renderReview();

    await waitFor(() => expect(document.body.textContent).toContain('All caught up!'));
    expect(document.body.textContent).not.toContain('Unable to load review cards');
  });

  it('shows a failure with retry and recovers on retry', async () => {
    reviewMocks.getDueReviewStates
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([makeReviewCard()]);

    root = await renderReview();

    await waitFor(() => expect(document.body.textContent).toContain('Unable to load review cards'));
    const retry = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Retry');
    expect(retry).toBeTruthy();

    await act(async () => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitFor(() => expect(document.body.textContent).toContain('猫'));
    expect(reviewMocks.getDueReviewStates).toHaveBeenCalledTimes(2);
  });
});
