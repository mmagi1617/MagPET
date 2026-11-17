BEGIN;

CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT,
  budget_type text NOT NULL,
  budget_month date NOT NULL,
  amount numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budgets_type_check CHECK (budget_type IN ('overall', 'category')),
  CONSTRAINT budgets_type_category_check CHECK (
    (budget_type = 'overall' AND category_id IS NULL)
    OR (budget_type = 'category' AND category_id IS NOT NULL)
  ),
  CONSTRAINT budgets_month_first_day_check CHECK (EXTRACT(DAY FROM budget_month) = 1),
  CONSTRAINT budgets_amount_positive_check CHECK (amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS budgets_one_overall_per_user_month
  ON public.budgets (user_id, budget_month)
  WHERE budget_type = 'overall' AND category_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS budgets_one_category_per_user_month
  ON public.budgets (user_id, category_id, budget_month)
  WHERE budget_type = 'category' AND category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS budgets_user_month_idx
  ON public.budgets (user_id, budget_month);

CREATE OR REPLACE FUNCTION public.validate_budget_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.budget_type = 'category' AND NOT EXISTS (
    SELECT 1
    FROM public.categories AS category
    WHERE category.id = NEW.category_id
      AND category.user_id = NEW.user_id
      AND category.transaction_type = 'expense'
  ) THEN
    RAISE EXCEPTION 'Budget category must be an expense category owned by the budget user.'
      USING ERRCODE = '23514', CONSTRAINT = 'budgets_category_owner_type_check';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS budgets_validate_category ON public.budgets;
CREATE TRIGGER budgets_validate_category
  BEFORE INSERT OR UPDATE OF user_id, category_id, budget_type
  ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.validate_budget_category();

CREATE OR REPLACE FUNCTION public.prevent_invalid_budget_category_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.transaction_type IS DISTINCT FROM OLD.transaction_type)
    AND EXISTS (
      SELECT 1
      FROM public.budgets AS budget
      WHERE budget.category_id = OLD.id
        AND (budget.user_id IS DISTINCT FROM NEW.user_id OR NEW.transaction_type IS DISTINCT FROM 'expense')
    ) THEN
    RAISE EXCEPTION 'A category referenced by budgets must remain an expense category owned by the same user.'
      USING ERRCODE = '23514', CONSTRAINT = 'categories_budget_owner_type_check';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS categories_prevent_invalid_budget_change ON public.categories;
CREATE TRIGGER categories_prevent_invalid_budget_change
  BEFORE UPDATE OF user_id, transaction_type
  ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.prevent_invalid_budget_category_change();

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.budgets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.budgets TO authenticated;

DROP POLICY IF EXISTS budgets_select_own ON public.budgets;
CREATE POLICY budgets_select_own ON public.budgets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS budgets_insert_own ON public.budgets;
CREATE POLICY budgets_insert_own ON public.budgets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS budgets_update_own ON public.budgets;
CREATE POLICY budgets_update_own ON public.budgets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS budgets_delete_own ON public.budgets;
CREATE POLICY budgets_delete_own ON public.budgets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMIT;
