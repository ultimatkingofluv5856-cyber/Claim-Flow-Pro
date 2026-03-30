-- ClaimFlow Pro canonical RLS and storage policy reference
-- This app uses custom application sessions with the publishable/anon key,
-- so table policies are intentionally permissive and auth is enforced in app logic.

begin;

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.claims enable row level security;
alter table public.expense_items enable row level security;
alter table public.transactions enable row level security;
alter table public.app_lists enable row level security;
alter table public.company_settings enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.password_resets enable row level security;
alter table public.email_delivery_logs enable row level security;

drop policy if exists "Allow all access to users" on public.users;
drop policy if exists "Allow all access to sessions" on public.sessions;
drop policy if exists "Allow all access to claims" on public.claims;
drop policy if exists "Allow all access to expense_items" on public.expense_items;
drop policy if exists "Allow all access to transactions" on public.transactions;
drop policy if exists "Allow all access to app_lists" on public.app_lists;
drop policy if exists "Allow all access to company_settings" on public.company_settings;
drop policy if exists "Allow all access to notifications" on public.notifications;
drop policy if exists "Allow all access to audit_logs" on public.audit_logs;
drop policy if exists "Allow all operations" on public.password_resets;
drop policy if exists "Allow all access to email_delivery_logs" on public.email_delivery_logs;

create policy "Allow all access to users" on public.users for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to sessions" on public.sessions for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to claims" on public.claims for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to expense_items" on public.expense_items for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to transactions" on public.transactions for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to app_lists" on public.app_lists for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to company_settings" on public.company_settings for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to notifications" on public.notifications for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to audit_logs" on public.audit_logs for all to anon, authenticated using (true) with check (true);
create policy "Allow all operations" on public.password_resets for all to anon, authenticated using (true) with check (true);
create policy "Allow all access to email_delivery_logs" on public.email_delivery_logs for all to anon, authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values
  ('claim-attachments', 'claim-attachments', true),
  ('company-assets', 'company-assets', true),
  ('user-avatars', 'user-avatars', true)
on conflict (id) do nothing;

drop policy if exists "Public read claim-attachments" on storage.objects;
drop policy if exists "Allow upload claim-attachments" on storage.objects;
drop policy if exists "Allow delete claim-attachments" on storage.objects;
drop policy if exists "Public read company-assets" on storage.objects;
drop policy if exists "Allow upload company-assets" on storage.objects;
drop policy if exists "Allow update company-assets" on storage.objects;
drop policy if exists "Allow delete company-assets" on storage.objects;
drop policy if exists "Public read user-avatars" on storage.objects;
drop policy if exists "Allow upload user-avatars" on storage.objects;
drop policy if exists "Allow update user-avatars" on storage.objects;
drop policy if exists "Allow delete user-avatars" on storage.objects;

create policy "Public read claim-attachments" on storage.objects for select to anon, authenticated using (bucket_id = 'claim-attachments');
create policy "Allow upload claim-attachments" on storage.objects for insert to anon, authenticated with check (bucket_id = 'claim-attachments');
create policy "Allow delete claim-attachments" on storage.objects for delete to anon, authenticated using (bucket_id = 'claim-attachments');

create policy "Public read company-assets" on storage.objects for select to anon, authenticated using (bucket_id = 'company-assets');
create policy "Allow upload company-assets" on storage.objects for insert to anon, authenticated with check (bucket_id = 'company-assets');
create policy "Allow update company-assets" on storage.objects for update to anon, authenticated using (bucket_id = 'company-assets');
create policy "Allow delete company-assets" on storage.objects for delete to anon, authenticated using (bucket_id = 'company-assets');

create policy "Public read user-avatars" on storage.objects for select to anon, authenticated using (bucket_id = 'user-avatars');
create policy "Allow upload user-avatars" on storage.objects for insert to anon, authenticated with check (bucket_id = 'user-avatars');
create policy "Allow update user-avatars" on storage.objects for update to anon, authenticated using (bucket_id = 'user-avatars');
create policy "Allow delete user-avatars" on storage.objects for delete to anon, authenticated using (bucket_id = 'user-avatars');

commit;
