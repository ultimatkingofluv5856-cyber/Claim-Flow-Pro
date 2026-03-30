-- Release hardening for ClaimFlow Pro
-- Safe to run multiple times

begin;

alter table public.claims
  add column if not exists manager_description text;

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

alter table public.email_delivery_logs enable row level security;

drop policy if exists "Allow all access to email_delivery_logs" on public.email_delivery_logs;
create policy "Allow all access to email_delivery_logs"
on public.email_delivery_logs
for all
to anon, authenticated
using (true)
with check (true);

create index if not exists idx_claims_status_created_at
on public.claims (status, created_at desc);

create index if not exists idx_claims_manager_status_lookup
on public.claims (manager_email, status, created_at desc)
where manager_email is not null;

create index if not exists idx_claims_admin_status_lookup
on public.claims (admin_email, status, created_at desc)
where admin_email is not null;

create index if not exists idx_claims_user_created_at
on public.claims (user_email, created_at desc);

create index if not exists idx_email_delivery_logs_recipient_created_at
on public.email_delivery_logs (recipient_email, created_at desc);

create index if not exists idx_email_delivery_logs_template_status
on public.email_delivery_logs (template_type, status, created_at desc);

create or replace function public.cleanup_expired_auth_records()
returns void
language plpgsql
as $$
begin
  delete from public.sessions where expires_at < now();
  delete from public.password_resets where expires_at < now();
end;
$$;

comment on table public.email_delivery_logs is 'Operational log of claim notification delivery attempts.';
comment on function public.cleanup_expired_auth_records() is 'Removes expired session and password reset records.';

commit;
