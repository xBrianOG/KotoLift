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
    const { level, type, limit } = req.query;

    let query = 'SELECT id, title, description, level, type, vocabulary_ids, grammar_topic, xp_reward, estimated_minutes, content, exercises FROM lessons';
    const params: any[] = [];
    const conditions: string[] = [];

    if (level) {
      conditions.push(`level = $${params.length + 1}`);
      params.push(level);
    }

    if (type) {
      conditions.push(`type = $${params.length + 1}`);
      params.push(type);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at ASC';

    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(limit as string));
    }

    const result = await pool.query(query, params);
    res.json({ lessons: result.rows });
  } catch (err: any) {
    console.error('Lessons fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch lessons' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `SELECT id, title, description, level, type, vocabulary_ids, grammar_topic, xp_reward, estimated_minutes, content, exercises 
                   FROM lessons WHERE id = $1`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json({ lesson: result.rows[0] });
  } catch (err: any) {
    console.error('Lesson detail error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch lesson' });
  }
});

export default router;