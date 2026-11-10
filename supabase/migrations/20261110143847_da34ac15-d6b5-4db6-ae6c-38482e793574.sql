CREATE OR REPLACE FUNCTION public.admin_simulado_delete_check(p_simulado_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r jsonb; v_n int; v_lista jsonb; v_modo text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  WITH x AS (
    SELECT user_id u, max(created_at) t FROM answer_progress WHERE simulado=p_simulado_id GROUP BY 1
    UNION ALL SELECT user_id, NULL FROM answer_progress_historico WHERE simulado=p_simulado_id
    UNION ALL SELECT user_id, NULL FROM simulados_iniciados WHERE simulado_id=p_simulado_id
    UNION ALL SELECT user_id, NULL FROM simulados_finalizados WHERE simulado_id=p_simulado_id
    UNION ALL SELECT user_id, NULL FROM resultados_alunos_tri WHERE simulado_id=p_simulado_id
  ), d AS (SELECT u, max(t) t FROM x WHERE u IS NOT NULL GROUP BY u)
  SELECT count(*),
    CASE WHEN count(*) <= 5 THEN COALESCE(jsonb_agg(jsonb_build_object(
      'user_id', d.u, 'nome', us.nome, 'email', us.email, 'ies', i.nome,
      'roles', (SELECT COALESCE(jsonb_agg(ur.role::text), '[]'::jsonb) FROM user_roles ur WHERE ur.user_id=d.u),
      'ultima_atividade', d.t) ORDER BY us.nome), '[]'::jsonb) ELSE '[]'::jsonb END
  INTO v_n, v_lista
  FROM d LEFT JOIN users us ON us.id=d.u LEFT JOIN ies i ON i.id::text=us.id_ies::text;

  SELECT jsonb_build_object(
    'alunos', v_n, 'respondentes_distintos', v_n, 'respondentes', v_lista,
    'respostas', (SELECT count(*) FROM answer_progress WHERE simulado=p_simulado_id),
    'historico', (SELECT count(*) FROM answer_progress_historico WHERE simulado=p_simulado_id),
    'iniciados', (SELECT count(*) FROM simulados_iniciados WHERE simulado_id=p_simulado_id),
    'finalizados', (SELECT count(*) FROM simulados_finalizados WHERE simulado_id=p_simulado_id),
    'tri_alunos', (SELECT count(*) FROM resultados_alunos_tri WHERE simulado_id=p_simulado_id),
    'tri_ies', (SELECT count(*) FROM resultados_ies_tri WHERE simulado_id=p_simulado_id),
    'filhos', (SELECT count(*) FROM simulados_admin WHERE simulado_pai_id=p_simulado_id)
  ) INTO r;
  v_modo := CASE
    WHEN (r->>'tri_ies')::int > 0 OR (r->>'filhos')::int > 0 OR v_n > 5 THEN 'bloqueado'
    WHEN v_n = 0 AND (r->>'respostas')::int + (r->>'historico')::int + (r->>'iniciados')::int
         + (r->>'finalizados')::int + (r->>'tri_alunos')::int = 0 THEN 'direto'
    ELSE 'revisao' END;
  RETURN r || jsonb_build_object('modo', v_modo, 'deletable', v_modo <> 'bloqueado');
END $function$;

DROP FUNCTION IF EXISTS public.admin_delete_simulado(uuid);
CREATE OR REPLACE FUNCTION public.admin_delete_simulado(p_simulado_id uuid, p_respondentes_confirmados uuid[] DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_nome text; c jsonb; v_atual uuid[]; v_conf uuid[]; n jsonb := '{}'::jsonb; k int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  SELECT nome INTO v_nome FROM simulados_admin WHERE id=p_simulado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  c := public.admin_simulado_delete_check(p_simulado_id);
  IF c->>'modo' = 'bloqueado' THEN RAISE EXCEPTION 'has_responses' USING DETAIL = c::text; END IF;
  SELECT COALESCE(array_agg((e->>'user_id')::uuid ORDER BY e->>'user_id'), '{}') INTO v_atual FROM jsonb_array_elements(c->'respondentes') e;
  SELECT COALESCE(array_agg(x ORDER BY x::text), '{}') INTO v_conf FROM (SELECT DISTINCT unnest(COALESCE(p_respondentes_confirmados,'{}'::uuid[])) x) s;
  IF c->>'modo' = 'revisao' AND v_atual IS DISTINCT FROM v_conf THEN
    RAISE EXCEPTION 'respondentes_mudaram';
  END IF;
  DELETE FROM answer_progress WHERE simulado=p_simulado_id; GET DIAGNOSTICS k = ROW_COUNT; n := n || jsonb_build_object('answer_progress',k);
  DELETE FROM answer_progress_historico WHERE simulado=p_simulado_id; GET DIAGNOSTICS k = ROW_COUNT; n := n || jsonb_build_object('answer_progress_historico',k);
  DELETE FROM simulados_iniciados WHERE simulado_id=p_simulado_id; GET DIAGNOSTICS k = ROW_COUNT; n := n || jsonb_build_object('simulados_iniciados',k);
  DELETE FROM simulados_finalizados WHERE simulado_id=p_simulado_id; GET DIAGNOSTICS k = ROW_COUNT; n := n || jsonb_build_object('simulados_finalizados',k);
  DELETE FROM resultados_alunos_tri WHERE simulado_id=p_simulado_id; GET DIAGNOSTICS k = ROW_COUNT; n := n || jsonb_build_object('resultados_alunos_tri',k);
  DELETE FROM simulado_aluno_caderno WHERE simulado_id=p_simulado_id; GET DIAGNOSTICS k = ROW_COUNT; n := n || jsonb_build_object('simulado_aluno_caderno',k);
  DELETE FROM ies_simulado_previsto WHERE simulado_id=p_simulado_id;
  DELETE FROM simulados_admin WHERE id=p_simulado_id;
  INSERT INTO admin_audit_log(admin_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'delete_simulado', NULL, jsonb_build_object('simulado_id',p_simulado_id,'nome',v_nome,
    'respondentes', c->'respondentes', 'linhas_apagadas', n));
END $function$;

REVOKE ALL ON FUNCTION public.admin_delete_simulado(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_simulado(uuid, uuid[]) TO authenticated;