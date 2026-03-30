-- Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for user avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for company-assets
CREATE POLICY "Public read company-assets" ON storage.objects FOR SELECT USING (bucket_id = 'company-assets');
CREATE POLICY "Allow upload company-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company-assets');
CREATE POLICY "Allow update company-assets" ON storage.objects FOR UPDATE USING (bucket_id = 'company-assets');
CREATE POLICY "Allow delete company-assets" ON storage.objects FOR DELETE USING (bucket_id = 'company-assets');

-- RLS for user-avatars
CREATE POLICY "Public read user-avatars" ON storage.objects FOR SELECT USING (bucket_id = 'user-avatars');
CREATE POLICY "Allow upload user-avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'user-avatars');
CREATE POLICY "Allow update user-avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'user-avatars');
CREATE POLICY "Allow delete user-avatars" ON storage.objects FOR DELETE USING (bucket_id = 'user-avatars');