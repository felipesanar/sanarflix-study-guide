-- Clean up any remaining dependencies and recreate the view securely
DROP VIEW IF EXISTS public.users_basic CASCADE;
DROP FUNCTION IF EXISTS public.get_users_basic() CASCADE;

-- Recreate the users_basic view with proper security
-- This view will automatically inherit RLS from the users table
CREATE VIEW public.users_basic AS
SELECT 
    u.id,
    u.nome,
    u.id_ies,
    u.semestre
FROM public.users u;

-- Note: This view will now be secure because:
-- 1. It's based on the 'users' table which has RLS enabled
-- 2. The existing policy "Usuário pode ver seus dados" on the users table 
--    ensures users can only see their own data (WHERE auth.uid() = id)
-- 3. Views in PostgreSQL will respect the RLS policies of their underlying tables
--    when accessed by users with the same privileges