import type { Card } from '../types';
import { getStoredUser } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://kotolift.onrender.com';

function getUserId(): string {
  const user = getStoredUser();
  if (!user?.id) throw new Error('Not authenticated');
  return user.id;
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
  
  const response = await fetch(url, {
    ...options,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
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
    translations: JSON.parse(result.flashcard.back || '{}'),
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
  
  return (result.flashcards || []).map((fc: any) => ({
    id: fc.id,
    sourceText: fc.front || '',
    sourceLang: fc.source_lang || 'en',
    jaText: fc.ja || '',
    enText: fc.en || '',
    esText: fc.es || '',
    translations: JSON.parse(fc.back || '{}'),
    tags: fc.tags || [],
    notes: fc.notes || '',
    createdAt: new Date(fc.created_at).getTime(),
  }));
}

export async function searchCards(
  query: string,
  tags: string[] = []
): Promise<Card[]> {
  let cards = await getAllCards();
  
  if (query) {
    const lowerQuery = query.toLowerCase();
    cards = cards.filter(card =>
      (card.sourceText?.toLowerCase().includes(lowerQuery)) ||
      (card.translations?.en?.toLowerCase().includes(lowerQuery)) ||
      (card.translations?.es?.toLowerCase().includes(lowerQuery)) ||
      (card.notes?.toLowerCase().includes(lowerQuery) ?? false)
    );
  }
  
  if (tags.length > 0) {
    cards = cards.filter(card =>
      tags.some(tag => card.tags.includes(tag))
    );
  }
  
  return cards;
}

export async function getAllTags(): Promise<string[]> {
  const cards = await getAllCards();
  const tagSet = new Set<string>();
  cards.forEach(card => card.tags?.forEach(tag => tagSet.add(tag)));
  return Array.from(tagSet).sort();
}