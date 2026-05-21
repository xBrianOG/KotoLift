-- Add phonetic column to conjugations if missing
ALTER TABLE conjugations ADD COLUMN IF NOT EXISTS phonetic TEXT;

-- Grant service role permissions (for seeding with service role key)
GRANT ALL ON vocabulary TO service_role;
GRANT ALL ON lessons TO service_role;
GRANT ALL ON conjugations TO service_role;

-- Also ensure anon can read (for frontend)
GRANT SELECT ON vocabulary TO anon;
GRANT SELECT ON lessons TO anon;
GRANT SELECT ON conjugations TO anon;