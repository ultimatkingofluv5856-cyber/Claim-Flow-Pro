ALTER TABLE public.app_lists
ADD COLUMN IF NOT EXISTS allows_all_categories boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS expense_categories text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.app_lists
SET allows_all_categories = true,
    expense_categories = '{}'::text[]
WHERE lower(type) = 'projectcode'
  AND (expense_categories IS NULL OR array_length(expense_categories, 1) IS NULL);

ALTER TABLE public.app_lists
DROP CONSTRAINT IF EXISTS app_lists_type_check;

ALTER TABLE public.app_lists
ADD CONSTRAINT app_lists_type_check
CHECK (lower(type) IN ('category', 'project', 'projectcode'));

ALTER TABLE public.app_lists
DROP CONSTRAINT IF EXISTS app_lists_value_required_check;

ALTER TABLE public.app_lists
ADD CONSTRAINT app_lists_value_required_check
CHECK (length(btrim(value)) > 0);

ALTER TABLE public.app_lists
DROP CONSTRAINT IF EXISTS app_lists_project_requires_code_check;

ALTER TABLE public.app_lists
ADD CONSTRAINT app_lists_project_requires_code_check
CHECK (
  lower(type) <> 'project'
  OR nullif(btrim(coalesce(project_code, '')), '') IS NOT NULL
);

ALTER TABLE public.app_lists
DROP CONSTRAINT IF EXISTS app_lists_projectcode_shape_check;

ALTER TABLE public.app_lists
ADD CONSTRAINT app_lists_projectcode_shape_check
CHECK (
  lower(type) <> 'projectcode'
  OR (
    nullif(btrim(coalesce(project_code, '')), '') IS NOT NULL
    AND nullif(btrim(coalesce(project, '')), '') IS NOT NULL
  )
);

ALTER TABLE public.app_lists
DROP CONSTRAINT IF EXISTS app_lists_category_scope_check;

ALTER TABLE public.app_lists
ADD CONSTRAINT app_lists_category_scope_check
CHECK (
  lower(type) <> 'projectcode'
  OR allows_all_categories
  OR coalesce(array_length(expense_categories, 1), 0) > 0
);

ALTER TABLE public.app_lists
DROP CONSTRAINT IF EXISTS app_lists_all_categories_empty_check;

ALTER TABLE public.app_lists
ADD CONSTRAINT app_lists_all_categories_empty_check
CHECK (
  lower(type) <> 'projectcode'
  OR NOT allows_all_categories
  OR coalesce(array_length(expense_categories, 1), 0) = 0
);

ALTER TABLE public.company_settings
DROP CONSTRAINT IF EXISTS company_settings_auto_approve_nonnegative_check;

ALTER TABLE public.company_settings
ADD CONSTRAINT company_settings_auto_approve_nonnegative_check
CHECK (coalesce(auto_approve_below, 0) >= 0);

ALTER TABLE public.expense_items
DROP CONSTRAINT IF EXISTS expense_items_nonnegative_amounts_check;

ALTER TABLE public.expense_items
ADD CONSTRAINT expense_items_nonnegative_amounts_check
CHECK (
  amount_with_bill >= 0
  AND amount_without_bill >= 0
  AND (amount_with_bill + amount_without_bill) > 0
);

ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_nonnegative_and_directional_check;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_nonnegative_and_directional_check
CHECK (
  credit >= 0
  AND debit >= 0
  AND ((credit > 0 AND debit = 0) OR (debit > 0 AND credit = 0))
);

CREATE INDEX IF NOT EXISTS idx_app_lists_project_lookup
ON public.app_lists (lower(type), project, project_code)
WHERE active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_lists_unique_active_category
ON public.app_lists ((lower(btrim(value))))
WHERE lower(type) = 'category' AND active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_lists_unique_active_project
ON public.app_lists ((lower(btrim(value))), (lower(btrim(project_code))))
WHERE lower(type) = 'project' AND active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_lists_unique_active_projectcode
ON public.app_lists ((lower(btrim(project))), (lower(btrim(project_code))))
WHERE lower(type) = 'projectcode' AND active = true;
