CREATE OR REPLACE FUNCTION public.get_gestor_portal_versao()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_ies_list uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- admin ve o portal NOVO (decisao de produto, 11/08 - revisada).
  IF public.has_role(v_uid, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  IF public.has_role(v_uid, 'gestor_grupo'::public.app_role) THEN
    v_ies_list := COALESCE(public.get_accessible_ies(v_uid), ARRAY[]::uuid[]);
  ELSIF public.has_role(v_uid, 'gestor'::public.app_role) THEN
    SELECT COALESCE(array_agg(u.id_ies), ARRAY[]::uuid[]) INTO v_ies_list
    FROM public.users u
    WHERE u.id = v_uid AND u.id_ies IS NOT NULL;
  ELSE
    RETURN false;
  END IF;

  IF v_ies_list IS NULL OR array_length(v_ies_list, 1) IS NULL THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM unnest(v_ies_list) AS ies(id)
    WHERE COALESCE(
      (SELECT f.enabled FROM public.ies_features f
       WHERE f.ies_id = ies.id AND f.feature_key = 'gestao.portal_v2'),
      false
    ) = false
  );
END;
$function$;