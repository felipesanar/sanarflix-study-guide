-- Relacionamento computado users -> user_roles para filtrar por papel via PostgREST (sem listas gigantes de ids na URL)
CREATE OR REPLACE FUNCTION public.user_roles(public.users)
RETURNS SETOF public.user_roles
LANGUAGE sql STABLE
SET search_path = public
AS $$ SELECT * FROM public.user_roles WHERE user_id = $1.id $$;
GRANT EXECUTE ON FUNCTION public.user_roles(public.users) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';