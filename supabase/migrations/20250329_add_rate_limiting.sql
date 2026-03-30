-- Create rate_limit_violations table for tracking rate limit breaches
-- Migration: add_rate_limiting
-- Created: 2025-03-29

CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_type VARCHAR(50) NOT NULL,
  identifier VARCHAR(255) NOT NULL,
  attempt_count INT NOT NULL DEFAULT 1,
  first_attempt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_attempt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT limit_type_not_null CHECK (limit_type IS NOT NULL),
  CONSTRAINT identifier_not_null CHECK (identifier IS NOT NULL)
);

-- Create composite index for fast lookups by type and identifier
CREATE INDEX idx_rate_limit_violations_type_identifier 
  ON rate_limit_violations(limit_type, identifier);

-- Create index for time-based queries (cleanup old records)
CREATE INDEX idx_rate_limit_violations_first_attempt 
  ON rate_limit_violations(first_attempt);

-- Create index for active violations
CREATE INDEX idx_rate_limit_violations_status 
  ON rate_limit_violations(status);

-- Create index for IP-based tracking
CREATE INDEX idx_rate_limit_violations_ip_address 
  ON rate_limit_violations(ip_address) WHERE ip_address IS NOT NULL;

-- Function to clean up expired rate limit violations (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_violations
  WHERE created_at < NOW() - INTERVAL '24 hours'
    AND status = 'resolved';
END;
$$ LANGUAGE plpgsql;

-- Function to reset active violations that have passed their window
CREATE OR REPLACE FUNCTION reset_expired_rate_limits()
RETURNS void AS $$
BEGIN
  UPDATE rate_limit_violations
  SET status = 'resolved'
  WHERE status = 'active'
    AND last_attempt < NOW() - INTERVAL '15 minutes'
    AND limit_type IN ('login', 'password_reset');

  UPDATE rate_limit_violations
  SET status = 'resolved'
  WHERE status = 'active'
    AND last_attempt < NOW() - INTERVAL '1 hour'
    AND limit_type IN ('claim_submission', 'approval');

  UPDATE rate_limit_violations
  SET status = 'resolved'
  WHERE status = 'active'
    AND last_attempt < NOW() - INTERVAL '1 minute'
    AND limit_type = 'api';
END;
$$ LANGUAGE plpgsql;

-- Create table for rate limit configuration
CREATE TABLE IF NOT EXISTS rate_limit_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_type VARCHAR(50) NOT NULL UNIQUE,
  max_attempts INT NOT NULL,
  window_minutes INT NOT NULL,
  backoff_enabled BOOLEAN NOT NULL DEFAULT true,
  backoff_multiplier DECIMAL(3, 2) NOT NULL DEFAULT 2.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT max_attempts_positive CHECK (max_attempts > 0),
  CONSTRAINT window_positive CHECK (window_minutes > 0),
  CONSTRAINT backoff_multiplier_positive CHECK (backoff_multiplier > 1.0)
);

-- Insert default rate limit configurations
INSERT INTO rate_limit_config (limit_type, max_attempts, window_minutes, backoff_enabled, backoff_multiplier)
VALUES
  ('login', 5, 15, true, 2.0),
  ('password_reset', 3, 60, true, 2.5),
  ('claim_submission', 10, 60, false, 1.0),
  ('approval', 20, 60, false, 1.0),
  ('api', 100, 1, false, 1.0)
ON CONFLICT (limit_type) DO NOTHING;

-- Create trigger for rate_limit_config updated_at
CREATE OR REPLACE FUNCTION update_rate_limit_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rate_limit_config_timestamp
  BEFORE UPDATE ON rate_limit_config
  FOR EACH ROW
  EXECUTE FUNCTION update_rate_limit_config_timestamp();
