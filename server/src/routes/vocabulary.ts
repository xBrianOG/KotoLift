import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

async function querySupabase(table: string, params: Record<string, any> = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const headers: Record<string, string> = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      queryParams.append(key, `{${value.join(',')}}`);
    } else if (typeof value === 'object') {
      queryParams.append(key, JSON.stringify(value));
    } else {
      queryParams.append(key, String(value));
    }
  }

  const response = await fetch(`${url}?${queryParams}`, { headers });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${error}`);
  }
  return response.json();
}

router.get('/', async (req, res) => {
  try {
    const { level, limit, offset } = req.query;

    const params: Record<string, any> = {
      select: 'id, word, level, part_of_speech, translations, phonetic, frequency, example_sentences, collocations',
      order: 'frequency.asc'
    };

    if (level) {
      params.level = `eq.${level}`;
    }

    if (limit) {
      params.limit = parseInt(limit as string);
    }

    if (offset) {
      params.offset = parseInt(offset as string);
    }

    const vocabulary = await querySupabase('vocabulary', params);
    res.json({ vocabulary });
  } catch (err: any) {
    console.error('Vocabulary fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch vocabulary' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q, level } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const params: Record<string, any> = {
      select: 'id, word, level, part_of_speech, translations, phonetic, frequency, example_sentences, collocations',
      or: `word.ilike.%${q}%,example_sentences.cs.*${q}*`,
      order: 'frequency.asc',
      limit: 20
    };

    if (level) {
      params.level = `eq.${level}`;
    }

    const vocabulary = await querySupabase('vocabulary', params);
    res.json({ vocabulary });
  } catch (err: any) {
    console.error('Vocabulary search error:', err);
    res.status(500).json({ error: err.message || 'Failed to search vocabulary' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const params = {
      select: 'id, word, level, part_of_speech, translations, phonetic, frequency, example_sentences, collocations',
      id: `eq.${id}`
    };

    const vocabulary = await querySupabase('vocabulary', params);
    if (!vocabulary || vocabulary.length === 0) {
      return res.status(404).json({ error: 'Word not found' });
    }

    res.json({ vocabulary: vocabulary[0] });
  } catch (err: any) {
    console.error('Vocabulary detail error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch word' });
  }
});

export default router;