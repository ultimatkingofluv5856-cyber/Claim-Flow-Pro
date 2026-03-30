-- ClaimFlow Pro release bootstrap SQL
-- Apply this on a fresh Supabase project after complete_schema.sql
-- or on an existing project to align it with the March 29, 2026 release.

begin;

-- Claims workflow alignment
alter table public.claims
  add column if not exists manager_description text;

alter table public.claims
  add column if not exists admin_approval_status text default 'Pending',
  add column if not exists admin_approved_total numeric not null default 0,
  add column if not exists admin_deduction_total numeric not null default 0,
  add column if not exists admin_description text;

alter table public.expense_items
  add column if not exists approved_amount numeric not null default 0,
  add column if not exists deduction_amount numeric not null default 0,
  add column if not exists approval_remarks text;

create table if not exists public.password_resets (
  id uuid primary key default gen_random_uuid(),
  email text not null references public.users(email) on delete cascade,
  token text not null unique,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  template_type text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider text,
  message_id text,
  error_message text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_password_resets_email on public.password_resets(email);
create index if not exists idx_password_resets_token on public.password_resets(token);
create index if not exists idx_password_resets_expires_at on public.password_resets(expires_at);
create index if not exists idx_claims_status_created_at on public.claims (status, created_at desc);
create index if not exists idx_claims_manager_status_lookup on public.claims (manager_email, status, created_at desc) where manager_email is not null;
create index if not exists idx_claims_admin_status_lookup on public.claims (admin_email, status, created_at desc) where admin_email is not null;
create index if not exists idx_claims_user_created_at on public.claims (user_email, created_at desc);
create index if not exists idx_email_delivery_logs_recipient_created_at on public.email_delivery_logs (recipient_email, created_at desc);
create index if not exists idx_email_delivery_logs_template_status on public.email_delivery_logs (template_type, status, created_at desc);

create or replace function public.cleanup_expired_auth_records()
returns void
language plpgsql
as $$
begin
  delete from public.sessions where expires_at < now();
  delete from public.password_resets where expires_at < now();
end;
$$;

commit;
