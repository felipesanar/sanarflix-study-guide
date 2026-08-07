-- REVERSAO: desfaz o guard de 20260807023000, que quebrou o login.
-- Dentro de SECURITY DEFINER, current_user e o dono da funcao, nao o chamador --
-- entao o ramo de service_role nunca disparava e a edge auth-login passou a
-- receber 'Access denied'. Restaura as definicoes anteriores, verbatim.

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF public.app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_accessible_ies(_user uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(array_agg(DISTINCT ies_id), ARRAY[]::uuid[])
  FROM (
    SELECT id_ies AS ies_id FROM public.users WHERE id = _user AND id_ies IS NOT NULL
    UNION
    SELECT gi.ies_id
    FROM public.user_groups ug
    JOIN public.group_ies gi ON gi.group_id = ug.group_id
    WHERE ug.user_id = _user
  ) t;
$$;

REVOKE ALL ON FUNCTION public.get_user_roles(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_accessible_ies(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_accessible_ies(uuid) TO authenticated, service_role;