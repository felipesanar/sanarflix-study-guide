-- Fix Security Definer View issue
-- The users_basic view currently bypasses RLS policies because it's owned by postgres
-- We need to drop and recreate it properly with RLS enforcement

-- Drop the existing view
DROP VIEW IF EXISTS public.users_basic;

-- Recreate the view with proper RLS enforcement
-- This view will now respect the RLS policies of the underlying users table
CREATE VIEW public.users_basic 
WITH (security_invoker = true) AS
SELECT 
    id,
    nome,
    id_ies,
    semestre
FROM public.users;

-- Grant appropriate permissions
GRANT SELECT ON public.users_basic TO authenticated;

-- Add a comment explaining the security considerations
COMMENT ON VIEW public.users_basic IS 'User basic information view with security_invoker=true to enforce RLS policies from underlying users table';