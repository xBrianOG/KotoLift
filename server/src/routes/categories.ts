import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// Get all categories
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    res.json({ categories: data || [] });
  } catch (err: any) {
    console.error('Categories fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch categories' });
  }
});

// Create a category
router.post('/', async (req, res) => {
  try {
    const { name, description, color } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const id = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const { data, error } = await supabase
      .from('categories')
      .insert({ id, name, description, color: color || '#6366f1' })
      .select()
      .single();

    if (error) throw error;
    res.json({ category: data });
  } catch (err: any) {
    console.error('Category create error:', err);
    res.status(500).json({ error: err.message || 'Failed to create category' });
  }
});

// Update a category
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color } = req.body;

    const { data, error } = await supabase
      .from('categories')
      .update({ name, description, color })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ category: data });
  } catch (err: any) {
    console.error('Category update error:', err);
    res.status(500).json({ error: err.message || 'Failed to update category' });
  }
});

// Delete a category
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error('Category delete error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete category' });
  }
});

export default router;