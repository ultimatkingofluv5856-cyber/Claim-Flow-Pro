-- Emergency containment for known production risks

-- Disable the seeded default super admin only if it still matches the shipped credentials.
UPDATE public.users
SET active = false
WHERE email = 'admin@example.com'
  AND name = 'System Admin'
  AND role = 'Super Admin'
  AND password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

-- Prevent duplicate settlement or refund transactions for the same claim.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_claim_approved_unique
ON public.transactions (reference_id, type)
WHERE type = 'claim_approved' AND reference_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_claim_rejected_refund_unique
ON public.transactions (reference_id, type)
WHERE type = 'claim_rejected_refund' AND reference_id IS NOT NULL;
