CREATE OR REPLACE FUNCTION public.admin_simulado_delete_check(p_simulado_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  SELECT jsonb_build_object(
    'alunos', (SELECT count(DISTINCT u) FROM (
        SELECT user_id u FROM answer_progress WHERE simulado=p_simulado_id
        UNION SELECT user_id FROM simulados_iniciados WHERE simulado_id=p_simulado_id
        UNION SELECT user_id FROM simulados_finalizados WHERE simulado_id=p_simulado_id) x),
    'respostas', (SELECT count(*) FROM answer_progress WHERE simulado=p_simulado_id),
    'historico', (SELECT count(*) FROM answer_progress_historico WHERE simulado=p_simulado_id),
    'iniciados', (SELECT count(*) FROM simulados_iniciados WHERE simulado_id=p_simulado_id),
    'finalizados', (SELECT count(*) FROM simulados_finalizados WHERE simulado_id=p_simulado_id),
    'tri_alunos', (SELECT count(*) FROM resultados_alunos_tri WHERE simulado_id=p_simulado_id),
    'tri_ies', (SELECT count(*) FROM resultados_ies_tri WHERE simulado_id=p_simulado_id),
    'filhos', (SELECT count(*) FROM simulados_admin WHERE simulado_pai_id=p_simulado_id)
  ) INTO r;
  RETURN r || jsonb_build_object('deletable',
    (r->>'respostas')::int + (r->>'historico')::int + (r->>'iniciados')::int + (r->>'finalizados')::int
    + (r->>'tri_alunos')::int + (r->>'tri_ies')::int + (r->>'filhos')::int = 0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_simulado(p_simulado_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_nome text; c jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  SELECT nome INTO v_nome FROM simulados_admin WHERE id=p_simulado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  c := public.admin_simulado_delete_check(p_simulado_id);
  IF NOT (c->>'deletable')::boolean THEN
    RAISE EXCEPTION 'has_responses' USING DETAIL = c::text;
  END IF;
  DELETE FROM ies_simulado_previsto WHERE simulado_id=p_simulado_id;
  DELETE FROM simulados_admin WHERE id=p_simulado_id;
  INSERT INTO admin_audit_log(admin_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'delete_simulado', NULL, jsonb_build_object('simulado_id',p_simulado_id,'nome',v_nome));
END $$;

REVOKE ALL ON FUNCTION public.admin_simulado_delete_check(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_simulado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_simulado_delete_check(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_simulado(uuid) TO authenticated;