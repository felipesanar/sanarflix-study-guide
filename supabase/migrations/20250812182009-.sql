-- 1) Lock down users_public with RLS and service-role-only access
ALTER TABLE IF EXISTS public.users_public ENABLE ROW LEVEL SECURITY;

-- Clean up any existing permissive policies if present
DROP POLICY IF EXISTS "Public can access users_public" ON public.users_public;
DROP POLICY IF EXISTS "users_public are publicly readable" ON public.users_public;
DROP POLICY IF EXISTS "Users can read their own users_public" ON public.users_public;

-- Revoke broad privileges from anon/authenticated (RLS still applies, this is defense-in-depth)
REVOKE ALL ON TABLE public.users_public FROM anon, authenticated;

-- Create strict policy: only service_role can access users_public for any operation
CREATE POLICY "Service role only - users_public"
ON public.users_public
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2) Remove insecure password update RPC that modified a shadow password hash
DROP FUNCTION IF EXISTS public.atualizar_senha(text);
