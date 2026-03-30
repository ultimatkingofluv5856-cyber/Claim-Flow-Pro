-- Remove default admin user to allow fresh start
DELETE FROM public.users WHERE email = 'admin@example.com';
