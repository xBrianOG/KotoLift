-- Add Google OAuth fields to email_users table
ALTER TABLE email_users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE email_users ADD COLUMN IF NOT EXISTS google_picture TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_users_google_id ON email_users(google_id);

-- Grant permissions
GRANT ALL ON email_users TO service_role;
GRANT SELECT ON email_users TO anon;