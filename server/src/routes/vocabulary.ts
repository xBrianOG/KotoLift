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
    const { level, limit, offset } = req.query;

    let query = supabase
      .from('vocabulary')
      .select('id, word, level, part_of_speech, translations, phonetic, frequency, example_sentences, collocations')
      .order('frequency', { ascending: true });

    if (level) {
      query = query.eq('level', level);
    }

    if (limit) {
      query = query.limit(parseInt(limit as string));
    }

    if (offset) {
      query = query.range(parseInt(offset as string), parseInt(offset as string) + (parseInt(limit as string) || 30) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ vocabulary: data || [] });
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

    let query = supabase
      .from('vocabulary')
      .select('id, word, level, part_of_speech, translations, phonetic, frequency, example_sentences, collocations')
      .or(`word.ilike.%${q}%,example_sentences.cs.*${q}*`)
      .order('frequency', { ascending: true })
      .limit(20);

    if (level) {
      query = query.eq('level', level);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ vocabulary: data || [] });
  } catch (err: any) {
    console.error('Vocabulary search error:', err);
    res.status(500).json({ error: err.message || 'Failed to search vocabulary' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vocabulary')
      .select('id, word, level, part_of_speech, translations, phonetic, frequency, example_sentences, collocations')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Word not found' });

    res.json({ vocabulary: data });
  } catch (err: any) {
    console.error('Vocabulary detail error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch word' });
  }
});

export default router;