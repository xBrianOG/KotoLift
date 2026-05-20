import { Router } from 'express';

const router = Router();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

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
    const { type, limit } = req.query;

    const params: Record<string, any> = {
      select: 'id, verb, type, translations, tenses',
      order: 'verb.asc'
    };

    if (type) {
      params.type = `eq.${type}`;
    }

    if (limit) {
      params.limit = parseInt(limit as string);
    }

    const conjugations = await querySupabase('conjugations', params);
    res.json({ conjugations });
  } catch (err: any) {
    console.error('Conjugations fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch conjugations' });
  }
});

router.get('/:verb', async (req, res) => {
  try {
    const { verb } = req.params;

    const params = {
      select: 'id, verb, type, translations, tenses',
      verb: `eq.${verb.toLowerCase()}`
    };

    const conjugations = await querySupabase('conjugations', params);
    if (!conjugations || conjugations.length === 0) {
      return res.status(404).json({ error: 'Verb not found' });
    }

    res.json({ conjugation: conjugations[0] });
  } catch (err: any) {
    console.error('Conjugation detail error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch conjugation' });
  }
});

export default router;