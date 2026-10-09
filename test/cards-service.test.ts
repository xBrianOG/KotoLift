import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/auth', () => ({
  getStoredUser: () => ({ id: 'real-user' }),
}));

import { createCard, getAllCards } from '../src/services/cards';

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

describe('cards service read retries', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('recovers when a transient read failure succeeds on retry', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'starting up' }, 503))
      .mockResolvedValueOnce(jsonResponse({ flashcards: [{ id: '1', front: 'hello', tags: [], created_at: new Date().toISOString() }] }));

    const resultPromise = getAllCards();
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_500);

    await expect(resultPromise).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('respects Retry-After on 429 read retries', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'slow down' }, 429, { 'Retry-After': '0.001' }))
      .mockResolvedValueOnce(jsonResponse({ flashcards: [] }));

    await expect(getAllCards()).resolves.toEqual([]);

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry authentication or validation failures', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401));

    await expect(getAllCards()).rejects.toThrow('Unauthorized');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not automatically retry writes', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError('network down'));

    await expect(createCard('hello', 'hello', 'hola', [])).rejects.toThrow('network down');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
