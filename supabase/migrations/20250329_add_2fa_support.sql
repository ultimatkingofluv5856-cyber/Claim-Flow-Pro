-- Create user_2fa_settings table for Two-Factor Authentication
-- Migration: add_2fa_support
-- Created: 2025-03-29

CREATE TABLE IF NOT EXISTS user_2fa_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE REFERENCES users(email) ON DELETE CASCADE,
  secret_base32 VARCHAR(32) NOT NULL,
  backup_codes TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT email_not_null CHECK (email IS NOT NULL)
);

-- Create index on email for fast lookups
CREATE INDEX idx_user_2fa_settings_email ON user_2fa_settings(email);

-- Create index on enabled status for filtering active 2FA users
CREATE INDEX idx_user_2fa_settings_enabled ON user_2fa_settings(enabled);

-- Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_2fa_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_2fa_settings_timestamp
  BEFORE UPDATE ON user_2fa_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_2fa_settings_timestamp();

-- Add RLS (Row Level Security) policy if needed - currently disabled per project
-- but policy template for future:
-- CREATE POLICY "user_can_manage_own_2fa"
--   ON user_2fa_settings
--   FOR ALL
--   USING (email = current_user_email())
--   WITH CHECK (email = current_user_email());

-- ALTER TABLE user_2fa_settings ENABLE ROW LEVEL SECURITY;
