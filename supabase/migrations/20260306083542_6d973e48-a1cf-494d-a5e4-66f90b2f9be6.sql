ALTER TABLE public.company_settings 
ADD COLUMN email_notifications_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN app_notifications_enabled boolean NOT NULL DEFAULT true;