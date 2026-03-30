-- Add claim_number column to claims table
ALTER TABLE public.claims ADD COLUMN claim_number TEXT UNIQUE;

-- Create sequence for claim numbers (if using Postgres sequences)
CREATE SEQUENCE IF NOT EXISTS claim_number_seq START 1;

-- Update complete_schema.sql reference (this is for documentation)
-- The claims table should include: claim_number TEXT UNIQUE
