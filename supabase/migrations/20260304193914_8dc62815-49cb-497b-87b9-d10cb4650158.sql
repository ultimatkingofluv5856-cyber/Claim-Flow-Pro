
-- ========== USERS TABLE ==========
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'User' CHECK (role IN ('User', 'Manager', 'Admin', 'Super Admin')),
  manager_email TEXT,
  advance_amount NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ========== SESSIONS TABLE ==========
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  role TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ========== CLAIMS TABLE ==========
CREATE TABLE public.claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id TEXT NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  site_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending Manager Approval',
  manager_email TEXT,
  manager_approval_status TEXT DEFAULT 'Pending',
  manager_approval_date TIMESTAMP WITH TIME ZONE,
  admin_email TEXT,
  admin_approval_date TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  total_with_bill NUMERIC NOT NULL DEFAULT 0,
  total_without_bill NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC GENERATED ALWAYS AS (total_with_bill + total_without_bill) STORED,
  drive_file_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ========== EXPENSE ITEMS TABLE ==========
CREATE TABLE public.expense_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES public.claims(claim_id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  project_code TEXT,
  expense_date DATE,
  description TEXT,
  amount_with_bill NUMERIC NOT NULL DEFAULT 0,
  amount_without_bill NUMERIC NOT NULL DEFAULT 0,
  attachment_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ========== TRANSACTIONS TABLE ==========
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  admin_email TEXT,
  type TEXT NOT NULL,
  reference_id TEXT,
  credit NUMERIC NOT NULL DEFAULT 0,
  debit NUMERIC NOT NULL DEFAULT 0,
  balance_after NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ========== APP LISTS (Dropdown Master Data) ==========
CREATE TABLE public.app_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  project_code TEXT,
  project TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ========== COMPANY SETTINGS ==========
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT 'My Company',
  company_subtitle TEXT DEFAULT 'Claims Management System',
  logo_url TEXT,
  support_email TEXT,
  currency_symbol TEXT NOT NULL DEFAULT '₹',
  address TEXT,
  phone TEXT,
  website TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ========== STORAGE BUCKET FOR ATTACHMENTS ==========
INSERT INTO storage.buckets (id, name, public) VALUES ('claim-attachments', 'claim-attachments', true);

-- ========== RLS POLICIES ==========

-- Disable RLS for now since we use custom session-based auth (not Supabase Auth)
-- The app validates sessions in application logic
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Since this app uses custom session tokens (not Supabase Auth),
-- we need service-level access. Allow anon key full access and handle auth in app logic.
CREATE POLICY "Allow all access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to claims" ON public.claims FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to expense_items" ON public.expense_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to app_lists" ON public.app_lists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to company_settings" ON public.company_settings FOR ALL USING (true) WITH CHECK (true);

-- Storage policies
CREATE POLICY "Public read access for claim attachments" ON storage.objects FOR SELECT USING (bucket_id = 'claim-attachments');
CREATE POLICY "Anyone can upload claim attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'claim-attachments');
CREATE POLICY "Anyone can delete claim attachments" ON storage.objects FOR DELETE USING (bucket_id = 'claim-attachments');

-- ========== INDEXES ==========
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_sessions_token ON public.sessions(token);
CREATE INDEX idx_sessions_expires ON public.sessions(expires_at);
CREATE INDEX idx_claims_claim_id ON public.claims(claim_id);
CREATE INDEX idx_claims_user_email ON public.claims(user_email);
CREATE INDEX idx_claims_status ON public.claims(status);
CREATE INDEX idx_expense_items_claim_id ON public.expense_items(claim_id);
CREATE INDEX idx_transactions_user_email ON public.transactions(user_email);
CREATE INDEX idx_transactions_reference_id ON public.transactions(reference_id);
CREATE INDEX idx_app_lists_type ON public.app_lists(type);

-- ========== INSERT DEFAULT DATA ==========

-- No default admin is seeded here.
-- Create the first admin explicitly through the application setup flow.

-- Default company settings
INSERT INTO public.company_settings (company_name, company_subtitle, support_email, currency_symbol)
VALUES ('My Company', 'Claims Management System', 'support@company.com', '₹');

-- Sample dropdown data
INSERT INTO public.app_lists (type, value, project_code, active) VALUES
('category', 'Travel', NULL, true),
('category', 'Food & Accommodation', NULL, true),
('category', 'Office Supplies', NULL, true),
('category', 'Transportation', NULL, true),
('category', 'Communication', NULL, true),
('category', 'Miscellaneous', NULL, true),
('project', 'Head Office', 'HO', true),
('project', 'Site A', 'SA', true),
('project', 'Site B', 'SB', true);
