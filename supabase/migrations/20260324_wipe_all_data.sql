-- Data-only reset: removes all rows but keeps tables, columns, policies, and functions intact.
TRUNCATE TABLE
  public.password_resets,
  public.notifications,
  public.audit_logs,
  public.transactions,
  public.expense_items,
  public.claims,
  public.sessions,
  public.users,
  public.app_lists,
  public.company_settings
RESTART IDENTITY CASCADE;
