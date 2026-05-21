import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// Get all user flashcards
router.get('/', async (req, res) => {
  try {
    const { user_id, category, search } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    let query = supabase
      .from('user_flashcards')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`front.ilike.%${search}%,back.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ flashcards: data || [] });
  } catch (err: any) {
    console.error('Flashcards fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch flashcards' });
  }
});

// Get single flashcard
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const { data, error } = await supabase
      .from('user_flashcards')
      .select('*')
      .eq('id', id)
      .eq('user_id', user_id)
      .single();

    if (error) throw error;
    res.json({ flashcard: data });
  } catch (err: any) {
    console.error('Flashcard fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch flashcard' });
  }
});

// Create flashcard
router.post('/', async (req, res) => {
  try {
    const { user_id, front, back, category, tags } = req.body;

    if (!user_id || !front || !back) {
      return res.status(400).json({ error: 'user_id, front, and back are required' });
    }

    const id = `fc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const { data, error } = await supabase
      .from('user_flashcards')
      .insert({ 
        id, 
        user_id, 
        front, 
        back, 
        category: category || null,
        tags: tags || []
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ flashcard: data });
  } catch (err: any) {
    console.error('Flashcard create error:', err);
    res.status(500).json({ error: err.message || 'Failed to create flashcard' });
  }
});

// Update flashcard
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, front, back, category, tags } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const { data, error } = await supabase
      .from('user_flashcards')
      .update({ 
        front, 
        back, 
        category, 
        tags,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw error;
    res.json({ flashcard: data });
  } catch (err: any) {
    console.error('Flashcard update error:', err);
    res.status(500).json({ error: err.message || 'Failed to update flashcard' });
  }
});

// Delete flashcard
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const { error } = await supabase
      .from('user_flashcards')
      .delete()
      .eq('id', id)
      .eq('user_id', user_id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error('Flashcard delete error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete flashcard' });
  }
});

// Get user's flashcard categories
router.get('/categories', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const { data, error } = await supabase
      .from('user_flashcards')
      .select('category')
      .eq('user_id', user_id)
      .not('category', 'is', 'null');

    if (error) throw error;

    const categories = [...new Set(data.map(d => d.category).filter(Boolean))];
    res.json({ categories });
  } catch (err: any) {
    console.error('Categories fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch categories' });
  }
});

export default router;