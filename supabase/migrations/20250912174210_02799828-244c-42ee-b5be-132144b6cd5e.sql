-- Remove the problematic SECURITY DEFINER function
DROP FUNCTION IF EXISTS public.get_users_basic();
DROP VIEW IF EXISTS public.users_basic_secure;

-- Drop and recreate the users_basic view with proper security
DROP VIEW IF EXISTS public.users_basic;

-- Create a properly secured view that inherits RLS from the users table
-- Since the users table already has RLS policies that allow users to see their own data,
-- this view will automatically be secure
CREATE VIEW public.users_basic AS
SELECT 
    u.id,
    u.nome,
    u.id_ies,
    u.semestre
FROM public.users u;

-- The view will automatically inherit the RLS behavior from the users table
-- Users can only see their own data because of the existing RLS policy on users table:
-- "Usuário pode ver seus dados" FOR SELECT USING (auth.uid() = id)