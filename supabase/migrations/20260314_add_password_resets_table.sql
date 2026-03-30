-- Create password_resets table for password reset functionality
CREATE TABLE IF NOT EXISTS public.password_resets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (email) REFERENCES public.users(email) ON DELETE CASCADE
);

-- Create index on email for quick lookups
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON public.password_resets(email);

-- Create index on token for validation
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON public.password_resets(token);

-- Create index on expires_at for cleanup
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON public.password_resets(expires_at);

-- Enable RLS (Row Level Security) - allow all since we use custom auth
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (custom auth)
CREATE POLICY "Allow all operations" ON public.password_resets
  FOR ALL
  USING (true)
  WITH CHECK (true);
