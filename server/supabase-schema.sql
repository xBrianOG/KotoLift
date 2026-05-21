-- Supabase Database Schema for KotoLift

-- Create email_users table for storing registered users
CREATE TABLE IF NOT EXISTS email_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_users_email ON email_users(email);

-- Enable Row Level Security (RLS)
ALTER TABLE email_users ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for registration)
CREATE POLICY "Allow insert" ON email_users FOR INSERT WITH CHECK (true);

-- Allow anyone to select (for login)
CREATE POLICY "Allow select" ON email_users FOR SELECT USING (true);

-- Allow anyone to update (for password changes - in future)
CREATE POLICY "Allow update" ON email_users FOR UPDATE USING (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_email_users_updated_at ON email_users;
CREATE TRIGGER update_email_users_updated_at
  BEFORE UPDATE ON email_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- VOCABULARY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS vocabulary (
  id TEXT PRIMARY KEY,
  word TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  part_of_speech TEXT,
  translation JSONB DEFAULT '[{"pending": true}]',
  phonetic TEXT,
  frequency INTEGER,
  example_sentences JSONB DEFAULT '[]',
  collocations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_level ON vocabulary(level);
CREATE INDEX IF NOT EXISTS idx_vocabulary_word ON vocabulary(word);
CREATE INDEX IF NOT EXISTS idx_vocabulary_pos ON vocabulary(part_of_speech);
CREATE INDEX IF NOT EXISTS idx_vocabulary_frequency ON vocabulary(frequency);

ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON vocabulary FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- LESSONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  type TEXT NOT NULL CHECK (type IN ('grammar', 'vocabulary', 'reading', 'listening', 'flashcard')),
  content JSONB DEFAULT '{}',
  word_ids JSONB DEFAULT '[]',
  vocabulary_count INTEGER DEFAULT 0,
  difficulty INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_level ON lessons(level);
CREATE INDEX IF NOT EXISTS idx_lessons_type ON lessons(type);
CREATE INDEX IF NOT EXISTS idx_lessons_difficulty ON lessons(difficulty);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON lessons FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- CONJUGATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS conjugations (
  id TEXT PRIMARY KEY,
  verb TEXT NOT NULL,
  verb_type TEXT NOT NULL CHECK (verb_type IN ('regular', 'irregular')),
  translation JSONB DEFAULT '[{"pending": true}]',
  phonetic TEXT,
  tenses JSONB NOT NULL DEFAULT '{}',
  frequency INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conjugations_verb ON conjugations(verb);
CREATE INDEX IF NOT EXISTS idx_conjugations_type ON conjugations(verb_type);
CREATE INDEX IF NOT EXISTS idx_conjugations_frequency ON conjugations(frequency);

ALTER TABLE conjugations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON conjugations FOR ALL USING (true) WITH CHECK (true);