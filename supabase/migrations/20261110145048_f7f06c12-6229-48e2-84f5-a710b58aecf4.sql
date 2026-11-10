CREATE OR REPLACE FUNCTION public.admin_simulado_delete_check(p_simulado_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r jsonb; v_n int; v_lista jsonb; v_modo text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Access denied: admin role required'; END IF;
  WITH x AS (
    SELECT DISTINCT ap.user_id AS u, NULL::timestamptz AS t FROM answer_progress ap WHERE ap.simulado=p_simulado_id
    UNION ALL SELECT h.user_id, NULL FROM answer_progress_historico h WHERE h.simulado=p_simulado_id
    UNION ALL SELECT si.user_id, si.started_at FROM simulados_iniciados si WHERE si.simulado_id=p_simulado_id
    UNION ALL SELECT sf.user_id, sf.finalizado_em FROM simulados_finalizados sf WHERE sf.simulado_id=p_simulado_id
    UNION ALL SELECT rt.student_id, NULL FROM resultados_alunos_tri rt WHERE rt.simulado_id=p_simulado_id
  ), d AS (SELECT x.u, max(x.t) AS t FROM x WHERE x.u IS NOT NULL GROUP BY x.u)
  SELECT count(*),
    CASE WHEN count(*) <= 5 THEN COALESCE(jsonb_agg(jsonb_build_object(
      'user_id', d.u, 'nome', us.nome, 'email', us.email, 'ies', i.nome,
      'roles', (SELECT COALESCE(jsonb_agg(ur.role::text), '[]'::jsonb) FROM user_roles ur WHERE ur.user_id=d.u),
      'ultima_atividade', d.t) ORDER BY us.nome), '[]'::jsonb) ELSE '[]'::jsonb END
  INTO v_n, v_lista
  FROM d LEFT JOIN users us ON us.id=d.u LEFT JOIN ies i ON i.id=us.id_ies;

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