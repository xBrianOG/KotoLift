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
    const { level, limit, offset, category, search } = req.query;

    let query = supabase
      .from('vocabulary')
      .select('id, word, level, part_of_speech, translations, phonetic, frequency, example_sentences, collocations, categories')
      .order('frequency', { ascending: true });

    if (level) {
      query = query.eq('level', level);
    }

    // Filter by category
    if (category && category !== 'all') {
      query = query.contains('categories', [category]);
    }

    // Keyword search
    if (search) {
      const searchTerm = search as string;
      query = query.or(`word.ilike.%${searchTerm}%,part_of_speech.ilike.%${searchTerm}%`);
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

// Get vocabulary by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vocabulary')
      .select('id, word, level, part_of_speech, translations, phonetic, frequency, example_sentences, collocations, categories')
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

// Add category to vocabulary word
router.post('/:id/categories', async (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.body;

    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    // Get current categories
    const { data: current, error: fetchError } = await supabase
      .from('vocabulary')
      .select('categories')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const categories = current?.categories || [];
    if (!categories.includes(category)) {
      categories.push(category);
    }

    const { data, error } = await supabase
      .from('vocabulary')
      .update({ categories })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ vocabulary: data });
  } catch (err: any) {
    console.error('Add category error:', err);
    res.status(500).json({ error: err.message || 'Failed to add category' });
  }
});

// Remove category from vocabulary word
router.delete('/:id/categories/:category', async (req, res) => {
  try {
    const { id, category } = req.params;

    const { data: current, error: fetchError } = await supabase
      .from('vocabulary')
      .select('categories')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const categories = (current?.categories || []).filter((c: string) => c !== category);

    const { data, error } = await supabase
      .from('vocabulary')
      .update({ categories })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ vocabulary: data });
  } catch (err: any) {
    console.error('Remove category error:', err);
    res.status(500).json({ error: err.message || 'Failed to remove category' });
  }
});

export default router;