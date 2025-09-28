-- Fix critical security issue: Secure the users_basic view
-- The view currently exposes all user data without proper access controls

-- First, drop the existing insecure view
DROP VIEW IF EXISTS public.users_basic;

-- Recreate the view with proper security controls
-- Using security_invoker = true ensures the view respects RLS policies from the underlying users table
CREATE VIEW public.users_basic 
WITH (security_invoker = true) AS
SELECT 
  id,
  nome,
  id_ies,
  semestre
FROM public.users;

-- Grant SELECT permission only to authenticated users
GRANT SELECT ON public.users_basic TO authenticated;

-- Revoke any permissions from anonymous users
REVOKE ALL ON public.users_basic FROM anon;

-- Grant service_role access for admin operations
GRANT SELECT ON public.users_basic TO service_role;

-- Add documentation about the security model
COMMENT ON VIEW public.users_basic IS 'Secure view of basic user information. Uses security_invoker=true to enforce RLS policies from the underlying users table, ensuring users can only see their own data unless they have elevated privileges.';