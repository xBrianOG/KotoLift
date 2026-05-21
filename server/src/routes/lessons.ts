import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

router.get('/', async (req, res) => {
  try {
    const { level, type, limit } = req.query;

    let query = supabase
      .from('lessons')
      .select('id, title, description, level, type, vocabulary_ids, grammar_topic, xp_reward, estimated_minutes, content, exercises')
      .order('created_at', { ascending: true });

    if (level) {
      query = query.eq('level', level);
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (limit) {
      query = query.limit(parseInt(limit as string));
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ lessons: data || [] });
  } catch (err: any) {
    console.error('Lessons fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch lessons' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('lessons')
      .select('id, title, description, level, type, vocabulary_ids, grammar_topic, xp_reward, estimated_minutes, content, exercises')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Lesson not found' });

    res.json({ lesson: data });
  } catch (err: any) {
    console.error('Lesson detail error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch lesson' });
  }
});

export default router;