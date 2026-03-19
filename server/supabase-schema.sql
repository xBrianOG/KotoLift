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
