-- SECURITY FIX: Remove users_public view that exposes sensitive data
-- This view contains CPF, email, and other PII without proper access controls

-- First, drop the view since views can't have RLS policies
DROP VIEW IF EXISTS public.users_public;

-- Create a safer, limited view that only exposes non-sensitive data for legitimate use cases
-- This view excludes CPF and other sensitive fields
CREATE VIEW public.users_basic AS 
SELECT 
  id,
  nome,
  id_ies,
  semestre
FROM public.users;

-- Apply RLS-like protection by revoking access from anon/authenticated
REVOKE ALL ON public.users_basic FROM anon, authenticated;

-- Only service_role can access this view (for admin operations)
GRANT SELECT ON public.users_basic TO service_role;

-- Add a comment explaining the security reasoning
COMMENT ON VIEW public.users_basic IS 'Limited user view without sensitive PII like CPF and email. Only accessible by service_role.';

-- Note: The main users table already has proper RLS policies that protect individual user data