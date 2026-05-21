import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// Get user progress
router.get('/', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user_id);

    if (error) throw error;
    res.json({ progress: data || [] });
  } catch (err: any) {
    console.error('Progress fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch progress' });
  }
});

// Get progress for specific lesson
router.get('/lesson/:lessonId', async (req, res) => {
  try {
    const { user_id } = req.query;
    const { lessonId } = req.params;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user_id)
      .eq('lesson_id', lessonId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ progress: data });
  } catch (err: any) {
    console.error('Progress fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch progress' });
  }
});

// Update progress for lesson
router.post('/lesson/:lessonId', async (req, res) => {
  try {
    const { user_id, status, xp_earned } = req.body;
    const { lessonId } = req.params;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const id = `progress-${user_id}-${lessonId}`;
    const completed_at = status === 'completed' ? new Date().toISOString() : null;

    const { data, error } = await supabase
      .from('user_progress')
      .upsert({ 
        id, 
        user_id, 
        lesson_id: lessonId, 
        status: status || 'in_progress',
        xp_earned: xp_earned || 0,
        completed_at,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    res.json({ progress: data });
  } catch (err: any) {
    console.error('Progress update error:', err);
    res.status(500).json({ error: err.message || 'Failed to update progress' });
  }
});

// Mark vocabulary as learned
router.post('/vocabulary/:vocabId', async (req, res) => {
  try {
    const { user_id, learned } = req.body;
    const { vocabId } = req.params;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const id = `vocab-${user_id}-${vocabId}`;
    
    const { data, error } = await supabase
      .from('user_progress')
      .upsert({ 
        id, 
        user_id, 
        vocabulary_id: vocabId, 
        status: learned ? 'learned' : 'not_started',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    res.json({ progress: data });
  } catch (err: any) {
    console.error('Vocabulary progress error:', err);
    res.status(500).json({ error: err.message || 'Failed to update vocabulary progress' });
  }
});

// Get all learned vocabulary
router.get('/vocabulary/learned', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const { data, error } = await supabase
      .from('user_progress')
      .select('vocabulary_id, status')
      .eq('user_id', user_id)
      .eq('status', 'learned');

    if (error) throw error;
    res.json({ vocabulary: data || [] });
  } catch (err: any) {
    console.error('Learned vocabulary fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch learned vocabulary' });
  }
});

// Get user stats
router.get('/stats', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const { data, error } = await supabase
      .from('user_progress')
      .select('status, xp_earned')
      .eq('user_id', user_id);

    if (error) throw error;

    const lessonsCompleted = data.filter(p => p.status === 'completed').length;
    const totalXp = data.reduce((sum, p) => sum + (p.xp_earned || 0), 0);

    res.json({ 
      stats: {
        lessonsCompleted,
        totalXp,
        vocabularyLearned: data.filter(p => p.vocabulary_id && p.status === 'learned').length
      }
    });
  } catch (err: any) {
    console.error('Stats fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch stats' });
  }
});

export default router;