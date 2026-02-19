import { db } from '../db';
import type { Card } from '../types';
import { v4 as uuidv4 } from 'uuid';

export async function createCard(
  jaText: string,
  enText: string,
  esText: string,
  tags: string[],
  notes?: string
): Promise<Card> {
  const card: Card = {
    id: uuidv4(),
    jaText,
    enText,
    esText,
    tags,
    notes,
    createdAt: Date.now()
  };
  await db.cards.add(card);
  return card;
}

export async function updateCard(
  id: string,
  updates: Partial<Omit<Card, 'id' | 'createdAt'>>
): Promise<void> {
  await db.cards.update(id, updates);
}

export async function deleteCard(id: string): Promise<void> {
  await db.transaction('rw', [db.cards, db.reviewStates], async () => {
    await db.cards.delete(id);
    await db.reviewStates.where('cardId').equals(id).delete();
  });
}

export async function getAllCards(): Promise<Card[]> {
  return db.cards.orderBy('createdAt').reverse().toArray();
}

export async function searchCards(
  query: string,
  tags: string[] = []
): Promise<Card[]> {
  let cards = await db.cards.toArray();
  
  if (query) {
    const lowerQuery = query.toLowerCase();
    cards = cards.filter(card =>
      card.jaText.toLowerCase().includes(lowerQuery) ||
      card.enText.toLowerCase().includes(lowerQuery) ||
      card.esText.toLowerCase().includes(lowerQuery) ||
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
  const cards = await db.cards.toArray();
  const tagSet = new Set<string>();
  cards.forEach(card => card.tags.forEach(tag => tagSet.add(tag)));
  return Array.from(tagSet).sort();
}
