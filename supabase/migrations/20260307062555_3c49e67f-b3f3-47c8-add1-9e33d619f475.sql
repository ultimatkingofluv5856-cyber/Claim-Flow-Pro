ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS auto_approve_below numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS require_manager_approval boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS approval_note text DEFAULT NULL;