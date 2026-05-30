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
      query = query.or(`ja.ilike.%${search}%,en.ilike.%${search}%,es.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    // Transform data to include translations object for backward compatibility
    const flashcards = (data || []).map((card: any) => ({
      ...card,
      front: card.source_lang 
        ? (card[card.source_lang] || card.front || '') 
        : (card.front || ''),
      back: JSON.stringify({
        ja: card.ja || null,
        en: card.en || null,
        es: card.es || null
      })
    }));
    
    res.json({ flashcards });
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
    
    // Transform to include translations object for backward compatibility
    const card = {
      ...data,
      front: data.source_lang 
        ? (data[data.source_lang] || data.front || '') 
        : (data.front || ''),
      back: JSON.stringify({
        ja: data.ja || null,
        en: data.en || null,
        es: data.es || null
      })
    };
    
    res.json({ flashcard: card });
  } catch (err: any) {
    console.error('Flashcard fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch flashcard' });
  }
});

// Create flashcard
router.post('/', async (req, res) => {
  try {
    const { user_id, ja, en, es, source_lang, category, tags, notes } = req.body;

    // Accept either new schema (ja/en/es/source_lang) or old schema (front/back)
    const { front, back } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // If new fields are provided, use them; otherwise fall back to old format
    const cardData: any = {
      category: category || null,
      tags: tags || [],
      source_lang: source_lang || 'en',
      notes: notes || null,
    };

    if (ja !== undefined || en !== undefined || es !== undefined) {
      // New schema
      cardData.ja = ja || null;
      cardData.en = en || null;
      cardData.es = es || null;
      // Set front based on source_lang
      const lang = source_lang || 'en';
      cardData.front = cardData[lang] || '';
      cardData.back = JSON.stringify({ ja: ja || null, en: en || null, es: es || null });
    } else if (front && back) {
      // Old schema - migrate it
      cardData.front = front;
      cardData.back = back;
      // Try to detect from back JSON
      try {
        const backObj = typeof back === 'string' ? JSON.parse(back) : back;
        cardData.ja = backObj.ja || null;
        cardData.en = backObj.en || null;
        cardData.es = backObj.es || null;
      } catch (e) {
        // If back is not valid JSON, leave it
      }
    } else {
      return res.status(400).json({ error: 'Either provide ja/en/es/source_lang or front/back' });
    }

    const id = `fc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    cardData.id = id;
    cardData.user_id = user_id;

    const { data, error } = await supabase
      .from('user_flashcards')
      .insert(cardData)
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
    const { user_id, ja, en, es, source_lang, category, tags, front, back, notes } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Handle new schema fields
    if (ja !== undefined) updateData.ja = ja;
    if (en !== undefined) updateData.en = en;
    if (es !== undefined) updateData.es = es;
    if (source_lang !== undefined) {
      updateData.source_lang = source_lang;
      // Update front based on new source_lang
      const lang = source_lang;
      updateData.front = req.body[lang] || '';
    }
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (notes !== undefined) updateData.notes = notes;
    
    // Handle old schema for backward compatibility
    if (front !== undefined) updateData.front = front;
    if (back !== undefined) {
      updateData.back = back;
      // Also update individual language columns if back is valid JSON
      try {
        const backObj = typeof back === 'string' ? JSON.parse(back) : back;
        if (backObj.ja && updateData.ja === undefined) updateData.ja = backObj.ja;
        if (backObj.en && updateData.en === undefined) updateData.en = backObj.en;
        if (backObj.es && updateData.es === undefined) updateData.es = backObj.es;
      } catch (e) {
        // Ignore JSON parse errors for back field
      }
    }

    const { data, error } = await supabase
      .from('user_flashcards')
      .update(updateData)
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