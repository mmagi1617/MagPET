BEGIN;

-- Existing profiles must use a UUID id; missing profile fields are added
-- without replacing existing values.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  username text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE
  id_type oid;
  username_type oid;
BEGIN
  SELECT atttypid INTO id_type
  FROM pg_attribute
  WHERE attrelid = 'public.profiles'::regclass
    AND attname = 'id'
    AND NOT attisdropped;

  SELECT atttypid INTO username_type
  FROM pg_attribute
  WHERE attrelid = 'public.profiles'::regclass
    AND attname = 'username'
    AND NOT attisdropped;

  IF id_type IS DISTINCT FROM 'uuid'::regtype THEN
    RAISE EXCEPTION
      'Cannot migrate public.profiles safely: expected an id column of type uuid. No existing data was changed.';
  END IF;

  IF username_type NOT IN ('text'::regtype, 'character varying'::regtype) THEN
    RAISE EXCEPTION
      'Cannot migrate public.profiles safely: expected username to be text or varchar. No existing data was changed.';
  END IF;
END;
$$;

LOCK TABLE auth.users IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  orphan_ids text;
  duplicate_profile_ids text;
  duplicate_usernames text;
  invalid_users text;
  duplicate_effective_usernames text;
BEGIN
  SELECT string_agg(COALESCE(p.id::text, '<NULL>'), ', ' ORDER BY p.id::text)
  INTO orphan_ids
  FROM public.profiles AS p
  LEFT JOIN auth.users AS u ON u.id = p.id
  WHERE p.id IS NULL OR u.id IS NULL;

  IF orphan_ids IS NULL AND EXISTS (
    SELECT 1
    FROM public.profiles AS p
    GROUP BY p.id
    HAVING count(*) > 1
  ) THEN
    SELECT string_agg(profile_group.profile_id, ', ' ORDER BY profile_group.profile_id)
    INTO duplicate_profile_ids
    FROM (
      SELECT p.id::text AS profile_id
      FROM public.profiles AS p
      GROUP BY p.id
      HAVING count(*) > 1
    ) AS profile_group;

    RAISE EXCEPTION
      'Cannot migrate safely: multiple profile rows share these IDs (%). Resolve them manually without deleting user data.',
      duplicate_profile_ids;
  END IF;

  IF orphan_ids IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot migrate safely: public.profiles contains IDs without matching auth.users rows (%). Resolve these profiles manually; no users or profiles were deleted.',
      COALESCE(orphan_ids, '<NULL>');
  END IF;

  SELECT string_agg(
    format('%s [%s]', duplicate_group.username, duplicate_group.user_ids),
    '; '
  )
  INTO duplicate_usernames
  FROM (
    SELECT
      lower(btrim(p.username)) AS username,
      string_agg(p.id::text, ', ' ORDER BY p.id::text) AS user_ids
    FROM public.profiles AS p
    WHERE NULLIF(btrim(p.username), '') IS NOT NULL
    GROUP BY lower(btrim(p.username))
    HAVING count(*) > 1
  ) AS duplicate_group;

  IF duplicate_usernames IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot create case-insensitive username uniqueness: duplicate usernames already exist in public.profiles (%). Assign distinct usernames manually; no data was overwritten.',
      duplicate_usernames;
  END IF;

  WITH resolved_usernames AS (
    SELECT
      u.id,
      COALESCE(
        NULLIF(btrim(p.username), ''),
        NULLIF(btrim(u.raw_user_meta_data->>'username'), '')
      ) AS username
    FROM auth.users AS u
    LEFT JOIN public.profiles AS p ON p.id = u.id
  )
  SELECT string_agg(id::text, ', ' ORDER BY id::text)
  INTO invalid_users
  FROM resolved_usernames
  WHERE username IS NULL
    OR char_length(btrim(username)) NOT BETWEEN 3 AND 20
    OR btrim(username) !~ '^[A-Za-z0-9_]+$';

  IF invalid_users IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot migrate safely: these auth.users rows have no valid profile username or have an invalid one (%). Add/fix each username in Auth user metadata or public.profiles, then rerun. No users or profiles were skipped.',
      invalid_users;
  END IF;

  WITH resolved_usernames AS (
    SELECT
      u.id,
      lower(btrim(COALESCE(
        NULLIF(btrim(p.username), ''),
        NULLIF(btrim(u.raw_user_meta_data->>'username'), '')
      ))) AS username
    FROM auth.users AS u
    LEFT JOIN public.profiles AS p ON p.id = u.id
  )
  SELECT string_agg(
    format('%s [%s]', duplicate_group.username, duplicate_group.user_ids),
    '; '
  )
  INTO duplicate_effective_usernames
  FROM (
    SELECT
      username,
      string_agg(id::text, ', ' ORDER BY id::text) AS user_ids
    FROM resolved_usernames
    GROUP BY username
    HAVING count(*) > 1
  ) AS duplicate_group;

  IF duplicate_effective_usernames IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot migrate safely: existing profile usernames and Auth metadata contain case-insensitive conflicts (%). Assign distinct usernames manually; no data was overwritten.',
      duplicate_effective_usernames;
  END IF;
END;
$$;

-- Keep an existing profile username intact; only fill missing profiles/usernames
-- from Auth metadata after all candidate data has passed validation.
UPDATE public.profiles AS p
SET username = lower(btrim(u.raw_user_meta_data->>'username'))
FROM auth.users AS u
WHERE u.id = p.id
  AND NULLIF(btrim(p.username), '') IS NULL;

INSERT INTO public.profiles (id, username, full_name)
SELECT
  u.id,
  lower(btrim(u.raw_user_meta_data->>'username')),
  COALESCE(u.raw_user_meta_data->>'full_name', '')
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.id = u.id
WHERE p.id IS NULL;

ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_username_length_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_length_check
      CHECK (char_length(btrim(username)) BETWEEN 3 AND 20) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_username_chars_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_chars_check
      CHECK (btrim(username) ~ '^[A-Za-z0-9_]+$') NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.profiles
  VALIDATE CONSTRAINT profiles_username_length_check;
ALTER TABLE public.profiles
  VALIDATE CONSTRAINT profiles_username_chars_check;

DO $$
DECLARE
  profiles_id_attnum smallint;
  index_is_unique boolean;
  index_is_valid boolean;
  index_is_ready boolean;
  index_expression text;
BEGIN
  SELECT attnum INTO profiles_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.profiles'::regclass
    AND attname = 'id'
    AND NOT attisdropped;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index AS i
    WHERE i.indrelid = 'public.profiles'::regclass
      AND i.indisunique
      AND i.indisvalid
      AND i.indisready
      AND i.indnkeyatts = 1
      AND i.indkey[0] = profiles_id_attnum
      AND i.indexprs IS NULL
  ) THEN
    CREATE UNIQUE INDEX profiles_id_unique_idx ON public.profiles (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS c
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.confrelid = 'auth.users'::regclass
      AND c.contype = 'f'
      AND c.conkey = ARRAY[profiles_id_attnum]::smallint[]
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_auth_users_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  FOR index_expression, index_is_unique, index_is_valid, index_is_ready IN
    SELECT
      pg_get_expr(i.indexprs, i.indrelid),
      i.indisunique,
      i.indisvalid,
      i.indisready
    FROM pg_index AS i
    JOIN pg_class AS index_class ON index_class.oid = i.indexrelid
    WHERE index_class.oid = to_regclass('public.profiles_username_ci_unique_idx')
  LOOP
    IF NOT index_is_unique
      OR NOT index_is_valid
      OR NOT index_is_ready
      OR COALESCE(
        regexp_replace(lower(index_expression), '[[:space:]"]', '', 'g'),
        ''
      )
        <> 'lower(btrim(username))'
    THEN
      RAISE EXCEPTION
        'The existing profiles_username_ci_unique_idx is not the expected unique lower(trim(username)) index. Resolve it manually before rerunning.';
    END IF;
  END LOOP;

  IF to_regclass('public.profiles_username_ci_unique_idx') IS NULL THEN
    CREATE UNIQUE INDEX profiles_username_ci_unique_idx
      ON public.profiles (lower(btrim(username)));
  END IF;
END;
$$;

DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND confrelid = 'auth.users'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.profiles'::regclass
           AND attname = 'id'
           AND NOT attisdropped)
      ]::smallint[]
      AND NOT convalidated
  LOOP
    EXECUTE format(
      'ALTER TABLE public.profiles VALIDATE CONSTRAINT %I',
      constraint_record.conname
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  normalized_username text;
  violated_constraint text;
BEGIN
  normalized_username := lower(btrim(COALESCE(new.raw_user_meta_data->>'username', '')));

  IF normalized_username !~ '^[A-Za-z0-9_]{3,20}$' THEN
    RAISE EXCEPTION
      'A valid username (3-20 letters, numbers, or underscores) is required to create an account.'
      USING ERRCODE = '23514';
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, username, full_name)
    VALUES (
      new.id,
      normalized_username,
      new.raw_user_meta_data->>'full_name'
    );
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;

      IF violated_constraint = 'profiles_username_ci_unique_idx' THEN
        RAISE EXCEPTION
          'This username is already taken. Please choose another username.'
          USING
            ERRCODE = '23505',
            CONSTRAINT = 'profiles_username_ci_unique_idx';
      END IF;

      RAISE;
  END;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Replace every existing profile policy so permissive legacy policies cannot
-- accidentally grant cross-user access (Postgres combines permissive policies).
DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON public.profiles',
      policy_record.policyname
    );
  END LOOP;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (username, full_name) ON TABLE public.profiles TO authenticated;

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMIT;
