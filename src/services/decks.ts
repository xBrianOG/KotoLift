import { db } from '../db';
import type { Card, Deck } from '../types';
import JSZip from 'jszip';
import initSqlJs, { type Database } from 'sql.js';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function detectLanguage(text: string): 'ja' | 'en' | 'es' | null {
  if (!text) return null;
  
  const jaChars = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g;
  const esChars = /[áéíóúñü¿¡]/gi;
  
  const jaMatches = (text.match(jaChars) || []).length;
  const esMatches = (text.match(esChars) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  
  if (jaMatches / totalChars > 0.1) return 'ja';
  if (esMatches / totalChars > 0.05) return 'es';
  return 'en';
}

export interface ParsedCard {
  front: string;
  back: string;
  tags: string[];
  audioUrl?: string; // base64 audio for APKG
}

export interface APKGParsedCard {
  front: string;
  back: string;
  tags: string[];
  audioFilename?: string;
}

export interface ImportPreview {
  deckName: string;
  cards: ParsedCard[];
  detectedLang: string;
}

export function parseCSV(content: string): ImportPreview {
  const lines = content.trim().split('\n');
  const cards: ParsedCard[] = [];
  let deckName = 'Imported Deck';
  const tags: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Handle quoted CSV fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    
    // Skip header row
    if (i === 0) {
      if (fields[0]?.toLowerCase().includes('front') || fields[0]?.toLowerCase().includes('card')) {
        continue;
      }
      // First line might be deck name if there's only one field
      if (fields.length === 1 && fields[0]) {
        deckName = fields[0];
        continue;
      }
    }
    
    // Parse card: front, back, tags (optional)
    const front = fields[0] || '';
    const back = fields[1] || '';
    const tagsStr = fields[2] || '';
    
    if (front && back) {
      cards.push({
        front,
        back,
        tags: tagsStr ? tagsStr.split(';').map(t => t.trim()).filter(Boolean) : [],
      });
    }
  }
  
  // Detect dominant language
  const sampleText = cards.slice(0, 5).map(c => c.front).join(' ');
  const detectedLang = detectLanguage(sampleText) || 'en';
  
  return { deckName, cards, detectedLang };
}

export async function importCards(
  deckName: string,
  parsedCards: ParsedCard[],
  targetLang: 'ja' | 'en' | 'es' = 'en'
): Promise<{ deck: Deck; importedCount: number }> {
  const deckId = generateId();
  const now = Date.now();
  
  // Create deck
  const deck: Deck = {
    id: deckId,
    name: deckName,
    cardCount: parsedCards.length,
    createdAt: now,
    source: 'import',
  };
  
  await db.decks.add(deck);
  
  // Create cards
  const cards: Card[] = parsedCards.map(parsed => {
    const sourceLang = detectLanguage(parsed.front) || targetLang;
    
    const card: Card = {
      id: generateId(),
      sourceText: parsed.front,
      sourceLang,
      translations: {
        [targetLang]: parsed.back,
      },
      tags: parsed.tags,
      deckId,
      deckName,
      createdAt: now,
    };
    
    // Also populate the explicit language fields
    if (sourceLang === 'ja') {
      card.jaText = parsed.front;
      card.enText = parsed.back;
    } else if (sourceLang === 'es') {
      card.esText = parsed.front;
      card.enText = parsed.back;
    } else {
      card.enText = parsed.front;
      card.jaText = parsed.back;
    }
    
    return card;
  });
  
  await db.cards.bulkAdd(cards);
  
  return { deck, importedCount: cards.length };
}

export async function getAllDecks(): Promise<Deck[]> {
  return db.decks.orderBy('createdAt').reverse().toArray();
}

export async function getDeckById(id: string): Promise<Deck | undefined> {
  return db.decks.get(id);
}

export async function getCardsByDeck(deckId: string): Promise<Card[]> {
  return db.cards.where('deckId').equals(deckId).toArray();
}

export async function deleteDeck(deckId: string): Promise<void> {
  await db.cards.where('deckId').equals(deckId).delete();
  await db.decks.delete(deckId);
}

export async function updateDeckCardCount(deckId: string): Promise<void> {
  const count = await db.cards.where('deckId').equals(deckId).count();
  await db.decks.update(deckId, { cardCount: count });
}

// APKG (Anki) Import Support

export interface APKGPreview {
  deckName: string;
  cards: APKGParsedCard[];
  detectedLang: string;
  totalMedia: number;
}

let sqljsInstance: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function getSqlJs() {
  if (!sqljsInstance) {
    // Use locally served WASM file from public folder
    sqljsInstance = await initSqlJs({
      locateFile: (file: string) => `/${file}`
    });
  }
  return sqljsInstance;
}

function extractAudioReferences(text: string): string[] {
  const regex = /\[sound:([^\]]+)\]/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function parseNoteFields(flds: string): string[] {
  // Anki uses 0x1f (31) as field separator
  return flds.split('\x1f');
}

export async function parseAPKG(file: File): Promise<APKGPreview> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  // Find the .anki2 database file
  const dbFile = Object.keys(zip.files).find(name => name.endsWith('.anki2'));
  if (!dbFile) {
    throw new Error('Invalid APKG file: no database found');
  }
  
  // Load the database
  const SQL = await getSqlJs();
  const dbBuffer = await zip.file(dbFile)!.async('uint8array');
  const db = new SQL.Database(dbBuffer);
  
  // Get deck name from collection
  let deckName = 'Imported Deck';
  try {
    const colResult = db.exec('SELECT decks FROM col');
    if (colResult.length > 0 && colResult[0].values.length > 0) {
      const decksJson = colResult[0].values[0][0] as string;
      const decks = JSON.parse(decksJson);
      // Get first deck name
      const deckId = Object.keys(decks)[0];
      if (deckId && decks[deckId]) {
        deckName = decks[deckId].name || 'Imported Deck';
      }
    }
  } catch (e) {
    console.warn('Could not parse deck name:', e);
  }
  
  // Get notes
  const notesResult = db.exec('SELECT id, flds, tags, sfld FROM notes');
  const cards: APKGParsedCard[] = [];
  const allAudioFiles: string[] = [];
  
  // Helper to check if field looks like an ID (LEAP_1001, 12345, etc.)
  const isLikelyID = (text: string): boolean => {
    const cleaned = text.trim().toUpperCase();
    // Skip if it's all caps with underscores and numbers (like LEAP_1001)
    if (/^[A-Z]+_\d+$/.test(cleaned)) return true;
    // Skip if it's just numbers
    if (/^\d+$/.test(cleaned)) return true;
    return false;
  };
  
  if (notesResult.length > 0) {
    for (const row of notesResult[0].values) {
      const flds = row[1] as string;
      const tagsStr = row[2] as string;
      const sortField = row[3] as string;
      
      const fields = parseNoteFields(flds);
      
// Find meaningful fields - skip IDs and duplicates
      const meaningfulFields: string[] = [];
      for (const field of fields) {
        const content = stripHtmlTags(field);
        if (!content) continue;
        if (isLikelyID(content)) continue;
        
        // Also skip if it appears identical to sort field
        if (content === stripHtmlTags(sortField)) continue;
        
        meaningfulFields.push(content);
      }
      
      // We need at least 2 fields for front and back
      if (meaningfulFields.length < 2) continue;

      // Smart field selection: 
      // - Field 0 is usually the word
      // - Skip phonetic (short, has pronunciation marks)
      // - Try to include Japanese in the back if available
      const front = meaningfulFields[0];
      let back = '';
      
      if (meaningfulFields.length >= 3) {
        // If there's a 3rd field, it might be Japanese
        // Use field 2 as back if it has Japanese characters, otherwise field 1
        const field2 = meaningfulFields[2];
        const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(field2);
        back = hasJapanese ? field2 : meaningfulFields[1];
      } else {
        back = meaningfulFields[1];
      }
      
      // Final check: if back is very short (phonetic), try next field
      if (back && back.length < 5 && meaningfulFields.length > 2) {
        back = meaningfulFields[2] || back;
      }
      
      // Extract audio references from ALL fields
      const audioRefs: string[] = [];
      for (const field of fields) {
        audioRefs.push(...extractAudioReferences(field));
      }
      
      const tags = tagsStr ? tagsStr.split(' ').filter(t => t) : [];
      
      cards.push({
        front,
        back,
        tags,
        audioFilename: audioRefs[0] || undefined,
      });
      
      // Collect all unique audio filenames
      for (const audio of audioRefs) {
        if (!allAudioFiles.includes(audio)) {
          allAudioFiles.push(audio);
        }
      }
    }
  }
  
  db.close();
  
  // Detect dominant language
  const sampleText = cards.slice(0, 5).map(c => c.front).join(' ');
  const detectedLang = detectLanguage(sampleText) || 'en';
  
  return {
    deckName,
    cards,
    detectedLang,
    totalMedia: allAudioFiles.length,
  };
}

export async function importAPKG(
  file: File,
  preview: APKGPreview,
  onProgress?: (current: number, total: number) => void
): Promise<{ deck: Deck; importedCount: number }> {
  console.log('importAPKG called', { file: file?.name, preview: preview?.deckName })
  const deckId = generateId();
  const now = Date.now();
  
  // Extract media from APKG
  console.log('Getting arrayBuffer...')
  const arrayBuffer = await file.arrayBuffer();
  console.log('Loading zip...', arrayBuffer.byteLength)
  const zip = await JSZip.loadAsync(arrayBuffer);
  console.log('Zip loaded, folders:', Object.keys(zip.files))
  
  // Get media folder
  const mediaFolder = zip.folder('media');
  const mediaMap: Record<string, string> = {};
  
  if (mediaFolder) {
    const mediaFiles = Object.keys(mediaFolder.files).filter(name => name !== 'media' && name !== '');
    console.log('Media files found:', mediaFiles.length);
    for (const filename of mediaFiles) {
      const mediaFile = mediaFolder.file(filename);
      if (mediaFile) {
        try {
          const fileData = await mediaFile.async('base64');
          const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
          const mimeType = ext === 'mp3' ? 'audio/mpeg' : ext === 'ogg' ? 'audio/ogg' : ext === 'wav' ? 'audio/wav' : 'application/octet-stream';
          mediaMap[filename] = `data:${mimeType};base64,${fileData}`;
        } catch (e) {
          console.warn('Failed to extract media file:', filename, e);
        }
      }
    }
    console.log('Extracted media:', Object.keys(mediaMap).length);
  }
  
  // Create deck
  const deck: Deck = {
    id: deckId,
    name: preview.deckName,
    cardCount: preview.cards.length,
    createdAt: now,
    source: 'import',
  };
  
await db.decks.add(deck);
  console.log('Deck created, now creating cards...', preview.cards.length);

  // Create cards with audio
  const cards: Card[] = [];
  const targetLang = preview.detectedLang as 'ja' | 'en' | 'es';
  
  for (let i = 0; i < preview.cards.length; i++) {
    const parsed = preview.cards[i];
    const sourceLang = detectLanguage(parsed.front) || targetLang;
    
    // Get audio if present
    let audioUrl: string | undefined;
    if (parsed.audioFilename && mediaMap[parsed.audioFilename]) {
      audioUrl = mediaMap[parsed.audioFilename];
    }
    
    const card: Card = {
      id: generateId(),
      sourceText: parsed.front,
      sourceLang,
      translations: {
        [targetLang]: parsed.back,
      },
      tags: parsed.tags,
      deckId,
      deckName: preview.deckName,
      audioUrl,
      createdAt: now,
    };
    
    // Populate explicit language fields
    if (sourceLang === 'ja') {
      card.jaText = parsed.front;
      card.enText = parsed.back;
    } else if (sourceLang === 'es') {
      card.esText = parsed.front;
      card.enText = parsed.back;
    } else {
      card.enText = parsed.front;
      card.jaText = parsed.back;
    }
    
    cards.push(card);
    
    // Report progress every 100 cards
    if ((i + 1) % 100 === 0 || i === preview.cards.length - 1) {
      onProgress?.(i + 1, preview.cards.length);
    }
  }
  
  console.log('Cards created, adding to DB...', cards.length);
  
  try {
    await db.cards.bulkAdd(cards);
    console.log('Cards added to DB successfully');
  } catch (e) {
    console.error('Failed to add cards to DB:', e);
    throw e;
  }

  return { deck, importedCount: cards.length };
}