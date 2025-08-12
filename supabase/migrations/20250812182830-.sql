-- Secure users_public against public access (works for table or view)
DO $$ BEGIN
  -- Revoke any broad privileges so anon/authenticated cannot access
  EXECUTE 'REVOKE ALL ON TABLE public.users_public FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'users_public does not exist; nothing to revoke.';
END $$;

-- Optionally grant explicit privileges to service_role for operational tasks
DO $$ BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users_public TO service_role';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'users_public does not exist; nothing to grant.';
END $$;

-- Remove insecure legacy function if present
DO $$ BEGIN
  EXECUTE 'DROP FUNCTION IF EXISTS public.atualizar_senha(text)';
END $$;