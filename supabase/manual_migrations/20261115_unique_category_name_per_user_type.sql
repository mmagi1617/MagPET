-- Apply manually only after reviewing duplicate rows in public.categories.
-- This migration preserves all existing rows and stops if normalized duplicates exist.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.categories
    GROUP BY
      user_id,
      transaction_type,
      lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add category uniqueness: duplicate names exist for the same user and transaction type. Review and reassign duplicates first.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS categories_user_type_normalized_name_uidx
  ON public.categories (
    user_id,
    transaction_type,
    lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
  );

COMMIT;
