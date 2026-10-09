// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '../src/types';

const cardMocks = vi.hoisted(() => ({
  getAllCards: vi.fn(),
  deleteCard: vi.fn(),
  updateCard: vi.fn(),
  filterCards: vi.fn((cards: Card[], query: string, tags: string[]) => {
    const q = query.toLowerCase();
    return cards.filter(card => {
      const matchesQuery = !q || card.sourceText?.toLowerCase().includes(q) || card.notes?.toLowerCase().includes(q);
      const matchesTags = tags.length === 0 || tags.some(tag => card.tags.includes(tag));
      return matchesQuery && matchesTags;
    });
  }),
  deriveTags: vi.fn((cards: Card[]) => Array.from(new Set(cards.flatMap(card => card.tags))).sort()),
}));

vi.mock('../src/services/cards', () => cardMocks);
vi.mock('../src/services/settings', () => ({
  getSecondaryLang: () => 'en',
  setSecondaryLang: vi.fn(),
}));

import { CardListScreen } from '../src/components/CardListScreen';

function makeCard(id: string, sourceText: string, tags: string[] = []): Card {
  return {
    id,
    sourceText,
    sourceLang: 'ja',
    translations: { en: `${sourceText} en` },
    tags,
    notes: '',
    createdAt: Date.now(),
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

async function renderCardList(): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<CardListScreen />);
  });
  return { container, root };
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

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('CardListScreen loading behavior', () => {
  let root: Root | undefined;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = undefined;
    }
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('shows loading instead of an empty state while cards are still loading', async () => {
    const load = deferred<Card[]>();
    cardMocks.getAllCards.mockReturnValueOnce(load.promise);

    ({ root } = await renderCardList());

    expect(document.body.textContent).toContain('Loading your cards...');
    expect(document.body.textContent).not.toContain('No cards found');

    await act(async () => load.resolve([]));
  });

  it('shows the empty state only after a successful empty response', async () => {
    cardMocks.getAllCards.mockResolvedValueOnce([]);

    ({ root } = await renderCardList());

    await waitFor(() => expect(document.body.textContent).toContain('No cards found'));
    expect(document.body.textContent).not.toContain('Unable to load your cards');
  });

  it('shows a failure with retry and recovers on retry', async () => {
    cardMocks.getAllCards
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([makeCard('1', 'こんにちは', ['greeting'])]);

    ({ root } = await renderCardList());

    await waitFor(() => expect(document.body.textContent).toContain('Unable to load your cards'));
    const retry = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Retry');
    expect(retry).toBeTruthy();

    await act(async () => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitFor(() => expect(document.body.textContent).toContain('こんにちは'));
    expect(cardMocks.getAllCards).toHaveBeenCalledTimes(2);
  });

  it('preserves loaded cards when a refresh fails', async () => {
    cardMocks.getAllCards
      .mockResolvedValueOnce([makeCard('1', '保存済み', ['known'])])
      .mockRejectedValueOnce(new Error('render sleeping'));
    cardMocks.deleteCard.mockResolvedValueOnce(undefined);

    ({ root } = await renderCardList());
    await waitFor(() => expect(document.body.textContent).toContain('保存済み'));

    const deleteButton = document.querySelector('button[title="Delete"]');
    expect(deleteButton).toBeTruthy();
    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const confirmDelete = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Delete');
    expect(confirmDelete).toBeTruthy();
    await act(async () => {
      confirmDelete?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitFor(() => expect(document.body.textContent).toContain('Unable to load your cards'));
    expect(document.body.textContent).toContain('保存済み');
  });

  it('does not re-fetch cards for search/filter changes', async () => {
    cardMocks.getAllCards.mockResolvedValueOnce([
      makeCard('1', 'apple', ['fruit']),
      makeCard('2', 'carrot', ['vegetable']),
    ]);

    ({ root } = await renderCardList());
    await waitFor(() => expect(document.body.textContent).toContain('apple'));

    const input = document.querySelector('input[placeholder="Search cards..."]') as HTMLInputElement;
    await act(async () => {
      changeInput(input, 'carrot');
      await new Promise(resolve => setTimeout(resolve, 350));
    });

    expect(cardMocks.getAllCards).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(cardMocks.filterCards).toHaveBeenLastCalledWith(expect.any(Array), 'carrot', []));
  });
});
