import { Router } from 'express';
import { Pool } from 'pg';

const router = Router();

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'postgres',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  ssl: { rejectUnauthorized: false }
});

function isSupabaseConfigured(): boolean {
  return !!(process.env.PG_HOST && process.env.PG_USER);
}

router.get('/', async (req, res) => {
  try {
    const { level, limit, offset } = req.query;

    let query = 'SELECT id, word, level, part_of_speech, translations, phonetic, frequency, example_sentences, collocations FROM vocabulary';
    const params: any[] = [];
    const conditions: string[] = [];

    if (level) {
      conditions.push(`level = $${params.length + 1}`);
      params.push(level);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY frequency ASC';

    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(limit as string));
    }

    if (offset) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(parseInt(offset as string));
    }

    const result = await pool.query(query, params);
    res.json({ vocabulary: result.rows });
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

    const params: any[] = [`%${q}%`];
    let query = `SELECT id, word, level, part_of_speech, translations, phonetic, frequency, example_sentences, collocations 
                 FROM vocabulary 
                 WHERE (word ILIKE $1 OR example_sentences::text ILIKE $1)`;

    if (level) {
      params.push(level);
      query += ` AND level = $${params.length}`;
    }

    query += ' ORDER BY frequency ASC LIMIT 20';

    const result = await pool.query(query, params);
    res.json({ vocabulary: result.rows });
  } catch (err: any) {
    console.error('Vocabulary search error:', err);
    res.status(500).json({ error: err.message || 'Failed to search vocabulary' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `SELECT id, word, level, part_of_speech, translations, phonetic, frequency, example_sentences, collocations 
                   FROM vocabulary WHERE id = $1`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Word not found' });
    }

    res.json({ vocabulary: result.rows[0] });
  } catch (err: any) {
    console.error('Vocabulary detail error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch word' });
  }
});

export default router;