
-- 1. Ranking de questões mais erradas na IES
CREATE OR REPLACE FUNCTION public.get_institutional_question_stats(
  p_simulado_id uuid,
  p_ies_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ies uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_user_id, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_user_id;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_user_id))[1];
    END IF;
  END IF;

  IF v_ies IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH ies_answers AS (
    SELECT ap.question_id, ap.correct, upper(trim(ap.resposta_usuario)) AS resposta
    FROM public.answer_progress ap
    JOIN public.users u ON u.id = ap.user_id
    WHERE ap.simulado = p_simulado_id
      AND u.id_ies = v_ies
  ),
  q_stats AS (
    SELECT
      q.id AS question_id,
      q.numero_questao,
      q.enunciado,
      q.grande_area,
      q.especialidade,
      q.tema,
      q.correta,
      q.comentario,
      q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d, q.alternativa_e,
      COUNT(a.*)::int AS total_respostas,
      CASE WHEN COUNT(a.*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE a.correct))::numeric / COUNT(a.*) * 100, 2)
        ELSE 0 END AS pct_acerto,
      COUNT(*) FILTER (WHERE a.resposta = 'A')::int AS c_a,
      COUNT(*) FILTER (WHERE a.resposta = 'B')::int AS c_b,
      COUNT(*) FILTER (WHERE a.resposta = 'C')::int AS c_c,
      COUNT(*) FILTER (WHERE a.resposta = 'D')::int AS c_d,
      COUNT(*) FILTER (WHERE a.resposta = 'E')::int AS c_e
    FROM public.questoes_simulado q
    JOIN ies_answers a ON a.question_id = q.id
    WHERE q.simulado_id = p_simulado_id
      AND COALESCE(q.anulada, false) = false
    GROUP BY q.id
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'question_id', question_id,
      'numero_questao', numero_questao,
      'enunciado', enunciado,
      'grande_area', grande_area,
      'especialidade', especialidade,
      'tema', tema,
      'correta', correta,
      'comentario', comentario,
      'total_respostas', total_respostas,
      'pct_acerto', pct_acerto,
      'alternativas', (
        SELECT jsonb_agg(alt) FROM (
          SELECT jsonb_build_object('letra','A','texto',alternativa_a,
            'pct_escolha', CASE WHEN total_respostas>0 THEN ROUND(c_a::numeric/total_respostas*100,2) ELSE 0 END) AS alt WHERE alternativa_a IS NOT NULL
          UNION ALL SELECT jsonb_build_object('letra','B','texto',alternativa_b,
            'pct_escolha', CASE WHEN total_respostas>0 THEN ROUND(c_b::numeric/total_respostas*100,2) ELSE 0 END) WHERE alternativa_b IS NOT NULL
          UNION ALL SELECT jsonb_build_object('letra','C','texto',alternativa_c,
            'pct_escolha', CASE WHEN total_respostas>0 THEN ROUND(c_c::numeric/total_respostas*100,2) ELSE 0 END) WHERE alternativa_c IS NOT NULL
          UNION ALL SELECT jsonb_build_object('letra','D','texto',alternativa_d,
            'pct_escolha', CASE WHEN total_respostas>0 THEN ROUND(c_d::numeric/total_respostas*100,2) ELSE 0 END) WHERE alternativa_d IS NOT NULL
          UNION ALL SELECT jsonb_build_object('letra','E','texto',alternativa_e,
            'pct_escolha', CASE WHEN total_respostas>0 THEN ROUND(c_e::numeric/total_respostas*100,2) ELSE 0 END) WHERE alternativa_e IS NOT NULL
        ) s
      )
    ) ORDER BY pct_acerto ASC, numero_questao ASC
  ), '[]'::jsonb) INTO v_result FROM q_stats;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_institutional_question_stats(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_institutional_question_stats(uuid, uuid) TO authenticated, service_role;


-- 2. Comparação entre IES acessíveis
CREATE OR REPLACE FUNCTION public.get_group_ies_comparison(
  p_simulado_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ies_ids uuid[];
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_ies_ids := public.get_accessible_ies(v_user_id);
  IF v_ies_ids IS NULL OR array_length(v_ies_ids, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH per_ies AS (
    SELECT
      i.id AS ies_id,
      i.nome AS ies_nome,
      -- simulado alvo: fornecido, ou o mais recente com TRI para a IES
      COALESCE(
        p_simulado_id,
        (SELECT r.simulado_id
           FROM public.resultados_ies_tri r
           JOIN public.simulados_admin sa ON sa.id = r.simulado_id
          WHERE r.college_id = i.id
          ORDER BY sa.data_liberacao DESC NULLS LAST, sa.created_at DESC
          LIMIT 1)
      ) AS sim_id
    FROM public.ies i
    WHERE i.id = ANY(v_ies_ids)
  ),
  base AS (
    SELECT
      pi.ies_id, pi.ies_nome, pi.sim_id,
      r.concept, r.pcp, r.mean_score, r.num_students,
      sa.data_liberacao, sa.created_at
    FROM per_ies pi
    LEFT JOIN public.resultados_ies_tri r
      ON r.college_id = pi.ies_id AND r.simulado_id = pi.sim_id
    LEFT JOIN public.simulados_admin sa ON sa.id = pi.sim_id
  ),
  respondentes AS (
    SELECT b.ies_id, COUNT(*)::bigint AS n
    FROM base b
    JOIN public.resultados_alunos_tri a
      ON a.college_id = b.ies_id AND a.simulado_id = b.sim_id
    GROUP BY b.ies_id
  ),
  total_alunos AS (
    SELECT b.ies_id,
           (SELECT COUNT(*)::bigint FROM public.users u
             WHERE u.id_ies = b.ies_id
               AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)) AS base_n
    FROM base b
  ),
  prev_sim AS (
    SELECT b.ies_id,
      (SELECT r2.pcp
         FROM public.resultados_ies_tri r2
         JOIN public.simulados_admin sa2 ON sa2.id = r2.simulado_id
        WHERE r2.college_id = b.ies_id
          AND sa2.data_liberacao IS NOT NULL
          AND b.data_liberacao IS NOT NULL
          AND sa2.data_liberacao < b.data_liberacao
        ORDER BY sa2.data_liberacao DESC LIMIT 1) AS prev_pcp
    FROM base b
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'ies_id', b.ies_id,
      'ies_nome', b.ies_nome,
      'concept', b.concept,
      'pcp', b.pcp,
      'mean_score', b.mean_score,
      'num_students', b.num_students,
      'respondentes', COALESCE(r.n, 0),
      'adesao_pct', CASE WHEN COALESCE(t.base_n,0) > 0
                        THEN ROUND(COALESCE(r.n,0)::numeric / t.base_n * 100, 1)
                        ELSE NULL END,
      'delta_pcp', CASE WHEN b.pcp IS NOT NULL AND p.prev_pcp IS NOT NULL
                        THEN ROUND((b.pcp - p.prev_pcp)::numeric, 2)
                        ELSE NULL END
    ) ORDER BY b.ies_nome
  ), '[]'::jsonb)
  INTO v_result
  FROM base b
  LEFT JOIN respondentes r ON r.ies_id = b.ies_id
  LEFT JOIN total_alunos t ON t.ies_id = b.ies_id
  LEFT JOIN prev_sim p ON p.ies_id = b.ies_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_group_ies_comparison(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_ies_comparison(uuid) TO authenticated, service_role;


-- 3. Engajamento por aluno
CREATE OR REPLACE FUNCTION public.get_institutional_student_engagement(
  p_ies_id uuid DEFAULT NULL,
  p_days int DEFAULT 90
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ies uuid;
  v_days int := GREATEST(1, COALESCE(p_days, 90));
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_user_id, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_user_id;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_user_id))[1];
    END IF;
  END IF;

  IF v_ies IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH sess AS (
    SELECT s.user_id,
           SUM(COALESCE(s.duration_seconds, 0))::bigint AS total_sec,
           MAX(s.started_at) AS last_activity_at,
           COUNT(*)::int AS sessions_count
    FROM public.user_sessions s
    JOIN public.users u ON u.id = s.user_id
    WHERE u.id_ies = v_ies
      AND s.started_at >= now() - make_interval(days => v_days)
    GROUP BY s.user_id
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'user_id', u.id,
      'nome', u.nome,
      'semestre', u.semestre,
      'horas_periodo', ROUND((sess.total_sec / 3600.0)::numeric, 1),
      'last_activity_at', sess.last_activity_at,
      'sessions_count', sess.sessions_count
    ) ORDER BY sess.total_sec DESC NULLS LAST
  ), '[]'::jsonb)
  INTO v_result
  FROM sess
  JOIN public.users u ON u.id = sess.user_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_institutional_student_engagement(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_institutional_student_engagement(uuid, int) TO authenticated, service_role;
