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

-- CRITICAL: Grant SELECT to service_role for Supabase client to work
GRANT SELECT ON vocabulary TO service_role;
GRANT SELECT ON lessons TO service_role;

-- Email users permissions
GRANT ALL ON email_users TO service_role;
GRANT SELECT ON email_users TO service_role;
ALTER TABLE email_users DISABLE ROW LEVEL SECURITY;

-- Disable RLS for public read tables (workaround for permission issues)
ALTER TABLE vocabulary DISABLE ROW LEVEL SECURITY;
ALTER TABLE lessons DISABLE ROW LEVEL SECURITY;