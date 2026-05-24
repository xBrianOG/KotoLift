-- Migration: Add explicit language columns to user_flashcards
-- This migration adds ja, en, es columns and source_lang to the user_flashcards table

-- Add new columns if they don't exist
ALTER TABLE user_flashcards ADD COLUMN IF NOT EXISTS ja TEXT;
ALTER TABLE user_flashcards ADD COLUMN IF NOT EXISTS en TEXT;
ALTER TABLE user_flashcards ADD COLUMN IF NOT EXISTS es TEXT;
ALTER TABLE user_flashcards ADD COLUMN IF NOT EXISTS source_lang TEXT DEFAULT 'en' CHECK (source_lang IN ('ja', 'en', 'es'));

-- Migrate existing data: parse the old 'back' JSON and populate the new columns
-- Also set source_lang based on the old 'front' content if possible
UPDATE user_flashcards
SET
  ja = COALESCE(
    (back::jsonb->>'ja'),
    -- If front contains Japanese characters, use it as ja
    CASE WHEN front ~ '[^\x00-\x7F]' THEN front ELSE NULL END
  ),
  en = COALESCE(
    (back::jsonb->>'en'),
    -- If front doesn't contain Japanese chars, assume it's English (for old cards)
    CASE WHEN front !~ '[^\x00-\x7F]' THEN front ELSE NULL END
  ),
  es = COALESCE(
    (back::jsonb->>'es'),
    NULL
  ),
  -- Default to 'en' for old cards since we don't know the original source
  source_lang = CASE
    WHEN source_lang IS NULL THEN 'en'
    ELSE source_lang
  END
WHERE ja IS NULL OR en IS NULL;

-- Grant permissions
GRANT ALL ON user_flashcards TO service_role;
GRANT SELECT ON user_flashcards TO anon;

-- Create index on source_lang for faster queries
CREATE INDEX IF NOT EXISTS idx_user_flashcards_source_lang ON user_flashcards(source_lang);