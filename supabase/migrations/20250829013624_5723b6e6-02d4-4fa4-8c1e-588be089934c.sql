-- Remove the overly permissive "Admin pode tudo" policy that allows 
-- any authenticated user to access all student PII data
DROP POLICY IF EXISTS "Admin pode tudo" ON public.users;

-- Verify that proper self-scoped policies exist (these should already be in place):
-- 1. "Usuário pode ver seus dados" - allows users to see only their own data
-- 2. "Usuário pode atualizar seu próprio perfil" - allows users to update only their own data

-- Note: Admin operations will continue to work via service_role which bypasses RLS
-- This maintains functionality while securing student data from unauthorized access