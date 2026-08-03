CREATE OR REPLACE FUNCTION public.get_gestor_aluno_contato(p_aluno_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_ies      uuid;
  v_telefone text;
BEGIN
  IF NOT (
       public.user_has_feature('gestao.enabled')
    OR public.user_has_feature('gestao.portal_v2')
  ) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_aluno_id IS NULL THEN
    RAISE EXCEPTION 'aluno_obrigatorio' USING ERRCODE = '22023';
  END IF;

  SELECT u.id_ies, u.telefone
    INTO v_ies, v_telefone
  FROM public.users u
  WHERE u.id = p_aluno_id
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id);

  IF v_ies IS NULL OR NOT public.user_can_access_ies(v_uid, v_ies) THEN
    RAISE EXCEPTION 'aluno_nao_encontrado' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'id',       p_aluno_id,
    'telefone', v_telefone
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_aluno_contato(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_aluno_contato(uuid) TO authenticated;