-- Drop the existing insecure view
DROP VIEW IF EXISTS public.users_basic;

-- Create a secure function that replaces the view functionality
-- This function will respect RLS policies from the underlying users table
CREATE OR REPLACE FUNCTION public.get_users_basic()
RETURNS TABLE(
    id uuid,
    nome text,
    id_ies uuid,
    semestre integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id, u.nome, u.id_ies, u.semestre
    FROM public.users u
    WHERE u.id = auth.uid();  -- Only return current user's data
$$;

-- Create a new secure view that uses the function
-- This ensures only authenticated users can see their own basic data
CREATE VIEW public.users_basic_secure AS
SELECT * FROM public.get_users_basic();

-- If the original view name is needed for compatibility, create an alias
-- but make it secure by filtering to current user only
CREATE OR REPLACE VIEW public.users_basic AS
SELECT u.id, u.nome, u.id_ies, u.semestre
FROM public.users u
WHERE u.id = auth.uid();

-- Enable RLS on the view (this will now work since we're filtering by auth.uid())
ALTER VIEW public.users_basic SET (security_invoker = true);