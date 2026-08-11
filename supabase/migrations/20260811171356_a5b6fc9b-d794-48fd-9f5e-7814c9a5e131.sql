CREATE OR REPLACE FUNCTION public.tmp_rel_visao_geral(p_uid uuid, p_ies_id uuid, p_semestre text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  v := public.get_gestor_visao_geral(p_ies_id, p_semestre);
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.tmp_rel_detalhamento(p_uid uuid, p_ies_id uuid, p_semestre text, p_simulados uuid[])
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  v := public.get_gestor_detalhamento(p_ies_id, p_semestre, p_simulados);
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.tmp_rel_visao_geral(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tmp_rel_detalhamento(uuid, uuid, text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tmp_rel_visao_geral(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tmp_rel_detalhamento(uuid, uuid, text, uuid[]) TO service_role;