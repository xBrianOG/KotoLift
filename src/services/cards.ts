import type { Card } from '../types';
import { getStoredUser } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://kotolift.onrender.com';
const READ_TIMEOUT_MS = 75_000;
const MAX_READ_ATTEMPTS = 3;
const MAX_RETRY_AFTER_MS = 60_000;

export class CardApiError extends Error {
  status?: number;
  retryAfterMs?: number;

  constructor(message: string, status?: number, retryAfterMs?: number) {
    super(message);
    this.name = 'CardApiError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function getUserId(): string {
  const user = getStoredUser();
  if (!user?.id) throw new Error('Not authenticated');
  return user.id;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => globalThis.setTimeout(resolve, ms));
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.min(Math.max(seconds * 1000, 0), MAX_RETRY_AFTER_MS);
  }

  const dateMs = Date.parse(value);
  if (Number.isNaN(dateMs)) return undefined;
  return Math.min(Math.max(dateMs - Date.now(), 0), MAX_RETRY_AFTER_MS);
}

function isTransientStatus(status?: number): boolean {
  return status === 408 || status === 429 || (status !== undefined && status >= 500);
}

function isTimeoutOrNetworkError(error: unknown): boolean {
  if (error instanceof CardApiError) return isTransientStatus(error.status);
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof TypeError;
}

function retryDelay(attempt: number, error: unknown): number {
  if (error instanceof CardApiError && error.retryAfterMs !== undefined) {
    return error.retryAfterMs;
  }
  return attempt === 1 ? 1_500 : 4_000;
}

async function requestJson(url: string, options: RequestInit, isRead: boolean) {
  const controller = isRead ? new AbortController() : undefined;
  const timeoutId = controller
    ? globalThis.setTimeout(() => controller.abort(), READ_TIMEOUT_MS)
    : undefined;

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller?.signal ?? options.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new CardApiError(
        error.error || 'Request failed',
        response.status,
        parseRetryAfter(response.headers.get('Retry-After')),
      );
    }

    return response.json();
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
  }
}

async function apiCall(endpoint: string, options: RequestInit = {}) {
  const userId = getUserId();
  const isGet = !options.method || options.method === 'GET';
  const isDelete = options.method === 'DELETE';
  
  // For GET and DELETE requests, pass user_id as query param
  // For POST/PUT, pass user_id in body
  const url = (isGet || isDelete) 
    ? `${API_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}user_id=${userId}`
    : `${API_BASE}${endpoint}`;
  
  const body = options.body ? JSON.parse(options.body as string) : undefined;
  if (!isGet && body) {
    body.user_id = userId;
  }
  
  const requestOptions = {
    ...options,
    body: body ? JSON.stringify(body) : undefined,
  };

  const attempts = isGet ? MAX_READ_ATTEMPTS : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await requestJson(url, requestOptions, isGet);
    } catch (error) {
      lastError = error;
      if (!isGet || attempt === attempts || !isTimeoutOrNetworkError(error)) {
        throw error;
      }
      await sleep(retryDelay(attempt, error));
    }
  }

  throw lastError;
}

function parseTranslations(back: string | null | undefined): Record<string, string | undefined> {
  try {
    return JSON.parse(back || '{}');
  } catch {
    return {};
  }
}

function mapFlashcard(fc: any): Card {
  return {
    id: fc.id,
    sourceText: fc.front || '',
    sourceLang: fc.source_lang || 'en',
    jaText: fc.ja || '',
    enText: fc.en || '',
    esText: fc.es || '',
    translations: parseTranslations(fc.back),
    tags: fc.tags || [],
    notes: fc.notes || '',
    createdAt: new Date(fc.created_at).getTime(),
  };
}

export async function createCard(
  sourceText: string,
  enText: string,
  esText: string,
  tags: string[],
  notes?: string,
  sourceLang?: string,
  sourceUrl?: string,
  startMs?: number,
  endMs?: number,
  jaText?: string
): Promise<Card> {
  const lang = sourceLang || 'en';
  
  // Determine which language field is the source
  let ja = jaText || '';
  let en = enText || '';
  let es = esText || '';
  
  // If source text is provided, put it in the right field based on sourceLang
  if (lang === 'ja' && sourceText) ja = sourceText;
  else if (lang === 'en' && sourceText) en = sourceText;
  else if (lang === 'es' && sourceText) es = sourceText;
  
  const result = await apiCall('/api/flashcards', {
    method: 'POST',
    body: JSON.stringify({
      ja,
      en,
      es,
      source_lang: lang,
      tags,
      category: tags[0] || null,
      notes,
    }),
  });
  
  const card: Card = {
    id: result.flashcard.id,
    sourceText: result.flashcard.front || sourceText,
    sourceLang: result.flashcard.source_lang || lang,
    jaText: result.flashcard.ja || ja,
    enText: result.flashcard.en || en,
    esText: result.flashcard.es || es,
    translations: parseTranslations(result.flashcard.back),
    tags: result.flashcard.tags || [],
    notes,
    sourceUrl,
    startMs,
    endMs,
    createdAt: new Date(result.flashcard.created_at).getTime(),
  };
  
  return card;
}

export async function updateCard(
  id: string,
  updates: Partial<Omit<Card, 'id' | 'createdAt'>>
): Promise<void> {
  const { sourceText, sourceLang, translations, tags, notes, sourceUrl, startMs, endMs, jaText, enText, esText } = updates;
  
  const front = sourceText || jaText;
  const back = JSON.stringify({
    en: enText !== undefined ? enText : (translations?.en ?? null),
    es: esText !== undefined ? esText : (translations?.es ?? null),
    ja: jaText !== undefined ? jaText : (translations?.ja ?? null),
  });
  
  await apiCall(`/api/flashcards/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      front,
      back,
      ja: jaText !== undefined ? jaText : (translations?.ja ?? null),
      en: enText !== undefined ? enText : (translations?.en ?? null),
      es: esText !== undefined ? esText : (translations?.es ?? null),
      tags,
      category: tags?.[0] || null,
      notes,
    }),
  });
}

export async function deleteCard(id: string): Promise<void> {
  await apiCall(`/api/flashcards/${id}`, {
    method: 'DELETE',
  });
}

export async function getAllCards(): Promise<Card[]> {
  const result = await apiCall('/api/flashcards');
  
  return (result.flashcards || []).map(mapFlashcard);
}

export function filterCards(cards: Card[], query: string, tags: string[] = []): Card[] {
  let filtered = cards;

  if (query) {
    const lowerQuery = query.toLowerCase();
    filtered = filtered.filter(card =>
      (card.sourceText?.toLowerCase().includes(lowerQuery)) ||
      (card.jaText?.toLowerCase().includes(lowerQuery)) ||
      (card.enText?.toLowerCase().includes(lowerQuery)) ||
      (card.esText?.toLowerCase().includes(lowerQuery)) ||
      (card.translations?.en?.toLowerCase().includes(lowerQuery)) ||
      (card.translations?.es?.toLowerCase().includes(lowerQuery)) ||
      (card.translations?.ja?.toLowerCase().includes(lowerQuery)) ||
      (card.notes?.toLowerCase().includes(lowerQuery) ?? false)
    );
  }

  if (tags.length > 0) {
    filtered = filtered.filter(card =>
      tags.some(tag => card.tags.includes(tag))
    );
  }

  return filtered;
}

export function deriveTags(cards: Card[]): string[] {
  const tagSet = new Set<string>();
  cards.forEach(card => card.tags?.forEach(tag => tagSet.add(tag)));
  return Array.from(tagSet).sort();
}

export async function searchCards(
  query: string,
  tags: string[] = []
): Promise<Card[]> {
  return filterCards(await getAllCards(), query, tags);
}

export async function getAllTags(): Promise<string[]> {
  return deriveTags(await getAllCards());
}
