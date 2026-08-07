CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF public.app_role
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user <> 'service_role'
     AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles r
        WHERE r.user_id = auth.uid() AND r.role = 'admin'::public.app_role
     )
  THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT role FROM public.user_roles WHERE user_id = _user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_roles(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_accessible_ies(_user uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result uuid[];
BEGIN
  IF current_user <> 'service_role'
     AND _user IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles r
        WHERE r.user_id = auth.uid() AND r.role = 'admin'::public.app_role
     )
  THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT ies_id), ARRAY[]::uuid[])
    INTO v_result
    FROM (
      SELECT id_ies AS ies_id FROM public.users WHERE id = _user AND id_ies IS NOT NULL
      UNION
      SELECT gi.ies_id
      FROM public.user_groups ug
      JOIN public.group_ies gi ON gi.group_id = ug.group_id
      WHERE ug.user_id = _user
    ) t;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_accessible_ies(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_accessible_ies(uuid) TO authenticated, service_role;