
-- 1) Coluna simulado_pai_id em simulados_admin
ALTER TABLE public.simulados_admin
  ADD COLUMN IF NOT EXISTS simulado_pai_id uuid REFERENCES public.simulados_admin(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_simulados_admin_simulado_pai_id
  ON public.simulados_admin(simulado_pai_id)
  WHERE simulado_pai_id IS NOT NULL;

-- 2) Backfill: vincula as duas repescagens FAI ao 3º Simulado FAI
UPDATE public.simulados_admin
   SET simulado_pai_id = '7ac2a46b-b58c-430e-bd27-847c15c26e0f'
 WHERE id IN ('1caf894b-5838-4a64-8601-981edad0b32c',
              'b07c13ec-7c7f-43b4-82be-bf43977dcfa7');

-- 3) get_institutional_simulados: oculta filhos do seletor do gestor
CREATE OR REPLACE FUNCTION public.get_institutional_simulados(p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, nome text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid; v_ies_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF NOT (
       has_role(v_user_id, 'admin')
    OR has_role(v_user_id, 'professor')
    OR has_role(v_user_id, 'gestor')
    OR has_role(v_user_id, 'gestor_grupo')
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_user_id, p_ies_id) THEN RAISE EXCEPTION 'Permission denied: cannot access this IES'; END IF;
    v_ies_id := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies_id FROM users u WHERE u.id = v_user_id;
    IF v_ies_id IS NULL THEN v_ies_id := (public.get_accessible_ies(v_user_id))[1]; END IF;
  END IF;

  RETURN QUERY
  SELECT sa.id, sa.nome, sa.created_at
  FROM simulados_admin sa
  WHERE v_ies_id = ANY(sa.ies_ids)
    AND sa.status IN ('ativo', 'encerrado')
    AND sa.simulado_pai_id IS NULL  -- oculta filhos (repescagens)
    AND (sa.liberacao_desempenho = 'imediato'
      OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= NOW())
      OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= NOW()))))
  ORDER BY sa.created_at DESC;
END;
$function$;

-- 4) get_institutional_performance: expande p_simulado_id para pai+filhos e
--    usa apenas a ÚLTIMA tentativa de cada aluno (mais recente em simulados_finalizados).
CREATE OR REPLACE FUNCTION public.get_institutional_performance(p_simulado_id uuid, p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_ies_id  uuid;
  result    json;
BEGIN
  v_user_id := auth.uid();
  IF NOT (
       has_role(v_user_id, 'admin')
    OR has_role(v_user_id, 'professor')
    OR has_role(v_user_id, 'gestor')
    OR has_role(v_user_id, 'gestor_grupo')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_user_id, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies_id := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies_id FROM users u WHERE u.id = v_user_id;
    IF v_ies_id IS NULL THEN
      v_ies_id := (public.get_accessible_ies(v_user_id))[1];
    END IF;
  END IF;

  WITH grupo AS (
    SELECT sa.id AS simulado_id
    FROM simulados_admin sa
    WHERE sa.id = p_simulado_id OR sa.simulado_pai_id = p_simulado_id
  ),
  ultima AS (
    -- 1 linha por aluno: a tentativa finalizada mais recente entre as do grupo.
    SELECT DISTINCT ON (sf.user_id)
           sf.user_id, sf.simulado_id
    FROM simulados_finalizados sf
    WHERE sf.simulado_id IN (SELECT simulado_id FROM grupo)
    ORDER BY sf.user_id, sf.finalizado_em DESC NULLS LAST
  ),
  -- Fallback: alunos que possuem respostas mas não têm registro em simulados_finalizados
  -- (mantém compatibilidade com simulados sem finalização persistida).
  ultima_fallback AS (
    SELECT DISTINCT ON (ap.user_id)
           ap.user_id, ap.simulado AS simulado_id
    FROM answer_progress ap
    WHERE ap.simulado IN (SELECT simulado_id FROM grupo)
      AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id)
    ORDER BY ap.user_id, ap.updated_at DESC NULLS LAST
  ),
  ultima_final AS (
    SELECT * FROM ultima
    UNION ALL
    SELECT * FROM ultima_fallback
  ),
  ies_answers AS (
    SELECT ap.question_id, ap.correct, ap.user_id, u.semestre,
           q.grande_area, q.especialidade, q.tema
    FROM answer_progress ap
    JOIN ultima_final uf
      ON uf.user_id = ap.user_id AND uf.simulado_id = ap.simulado
    JOIN users u             ON ap.user_id     = u.id
    JOIN questoes_simulado q ON ap.question_id = q.id
    WHERE u.id_ies = v_ies_id
      AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
  )
  SELECT json_build_object(
    'overallStats',  (SELECT json_build_object('total',COUNT(*),'acertos',COUNT(*) FILTER (WHERE correct),'totalStudents',COUNT(DISTINCT user_id)) FROM ies_answers),
    'bySemester',    (SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.semestre), '[]'::json) FROM (SELECT semestre, COUNT(*) AS total, COUNT(*) FILTER (WHERE correct) AS acertos, COUNT(DISTINCT user_id) AS num_students FROM ies_answers WHERE semestre IS NOT NULL GROUP BY semestre) t),
    'byArea',        (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT grande_area AS name, COUNT(*) AS total, COUNT(*) FILTER (WHERE correct) AS acertos FROM ies_answers WHERE grande_area IS NOT NULL GROUP BY grande_area ORDER BY grande_area) t),
    'bySpecialty',   (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT especialidade AS name, grande_area AS area_name, COUNT(*) AS total, COUNT(*) FILTER (WHERE correct) AS acertos FROM ies_answers WHERE especialidade IS NOT NULL GROUP BY especialidade, grande_area ORDER BY especialidade) t),
    'bySubspecialty',(SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT tema AS name, especialidade AS specialty_name, grande_area AS area_name, COUNT(*) AS total, COUNT(*) FILTER (WHERE correct) AS acertos FROM ies_answers WHERE tema IS NOT NULL GROUP BY tema, especialidade, grande_area ORDER BY tema) t)
  ) INTO result;
  RETURN result;
END;
$function$;

-- 5) get_institutional_student_scores: idem, com totals por aluno baseados no simulado realmente feito.
CREATE OR REPLACE FUNCTION public.get_institutional_student_scores(p_simulado_id uuid, p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid; v_ies_id uuid;
  result json;
BEGIN
  v_user_id := auth.uid();
  IF NOT (
       has_role(v_user_id, 'admin')
    OR has_role(v_user_id, 'professor')
    OR has_role(v_user_id, 'gestor')
    OR has_role(v_user_id, 'gestor_grupo')
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_user_id, p_ies_id) THEN RAISE EXCEPTION 'Permission denied: cannot access this IES'; END IF;
    v_ies_id := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies_id FROM users u WHERE u.id = v_user_id;
    IF v_ies_id IS NULL THEN v_ies_id := (public.get_accessible_ies(v_user_id))[1]; END IF;
  END IF;

  WITH grupo AS (
    SELECT sa.id AS simulado_id
    FROM simulados_admin sa
    WHERE sa.id = p_simulado_id OR sa.simulado_pai_id = p_simulado_id
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id)
           sf.user_id, sf.simulado_id
    FROM simulados_finalizados sf
    WHERE sf.simulado_id IN (SELECT simulado_id FROM grupo)
    ORDER BY sf.user_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fallback AS (
    SELECT DISTINCT ON (ap.user_id)
           ap.user_id, ap.simulado AS simulado_id
    FROM answer_progress ap
    WHERE ap.simulado IN (SELECT simulado_id FROM grupo)
      AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id)
    ORDER BY ap.user_id, ap.updated_at DESC NULLS LAST
  ),
  ultima_final AS (
    SELECT * FROM ultima
    UNION ALL
    SELECT * FROM ultima_fallback
  ),
  -- totais por simulado do grupo (para mapear cada aluno aos totais do simulado que ele fez)
  totals_per_sim AS (
    SELECT q.simulado_id,
           COALESCE(json_object_agg(t1.area, t1.total) FILTER (WHERE t1.area IS NOT NULL), '{}'::json) AS totals_by_area,
           COALESCE(json_object_agg(t2.tema, t2.total) FILTER (WHERE t2.tema IS NOT NULL), '{}'::json) AS totals_by_tema
    FROM (SELECT DISTINCT simulado_id FROM questoes_simulado WHERE simulado_id IN (SELECT simulado_id FROM grupo)) q
    LEFT JOIN LATERAL (
      SELECT qa.grande_area AS area, COUNT(*) AS total
      FROM questoes_simulado qa
      WHERE qa.simulado_id = q.simulado_id AND qa.grande_area IS NOT NULL AND COALESCE(qa.anulada,false)=false
      GROUP BY qa.grande_area
    ) t1 ON true
    LEFT JOIN LATERAL (
      SELECT qb.tema AS tema, COUNT(*) AS total
      FROM questoes_simulado qb
      WHERE qb.simulado_id = q.simulado_id AND qb.tema IS NOT NULL AND COALESCE(qb.anulada,false)=false
      GROUP BY qb.tema
    ) t2 ON true
    GROUP BY q.simulado_id
  )
  SELECT json_build_object(
    'areas', (SELECT COALESCE(json_agg(DISTINCT q.grande_area ORDER BY q.grande_area), '[]'::json)
              FROM questoes_simulado q
              WHERE q.simulado_id IN (SELECT simulado_id FROM grupo)
                AND q.grande_area IS NOT NULL AND COALESCE(q.anulada, false) = false),
    'students', (
      SELECT COALESCE(json_agg(row_to_json(st) ORDER BY st.score_total DESC), '[]'::json)
      FROM (
        SELECT u.id AS student_id, u.nome, u.semestre,
          COUNT(*) FILTER (WHERE ap.correct AND COALESCE(q0.anulada, false) = false) as score_total,
          COUNT(*) FILTER (WHERE COALESCE(q0.anulada, false) = false) as total_questions,
          (SELECT json_object_agg(sub.area, sub.acertos) FROM (
             SELECT q2.grande_area as area, COUNT(*) FILTER (WHERE ap2.correct) as acertos
             FROM answer_progress ap2 JOIN questoes_simulado q2 ON ap2.question_id = q2.id
             WHERE ap2.user_id = u.id AND ap2.simulado = uf.simulado_id
               AND q2.grande_area IS NOT NULL AND COALESCE(q2.anulada, false) = false
             GROUP BY q2.grande_area) sub) as scores_by_area,
          (SELECT tps.totals_by_area FROM totals_per_sim tps WHERE tps.simulado_id = uf.simulado_id) as totals_by_area,
          (SELECT json_object_agg(subt.tema, subt.acertos) FROM (
             SELECT q3.tema as tema, COUNT(*) FILTER (WHERE ap3.correct) as acertos
             FROM answer_progress ap3 JOIN questoes_simulado q3 ON ap3.question_id = q3.id
             WHERE ap3.user_id = u.id AND ap3.simulado = uf.simulado_id
               AND q3.tema IS NOT NULL AND COALESCE(q3.anulada, false) = false
             GROUP BY q3.tema) subt) as scores_by_tema,
          (SELECT tps.totals_by_tema FROM totals_per_sim tps WHERE tps.simulado_id = uf.simulado_id) as totals_by_tema
        FROM ultima_final uf
        JOIN users u ON u.id = uf.user_id
        JOIN answer_progress ap ON ap.user_id = u.id AND ap.simulado = uf.simulado_id
        LEFT JOIN questoes_simulado q0 ON ap.question_id = q0.id
        WHERE u.id_ies = v_ies_id
          AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
        GROUP BY u.id, u.nome, u.semestre, uf.simulado_id
      ) st
    )
  ) INTO result;
  RETURN result;
END;
$function$;

-- 6) get_institutional_evolution: oculta filhos para não duplicar pontos
CREATE OR REPLACE FUNCTION public.get_institutional_evolution(p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid; v_ies_id uuid; result json;
BEGIN
  v_user_id := auth.uid();
  IF NOT (
       has_role(v_user_id, 'admin')
    OR has_role(v_user_id, 'professor')
    OR has_role(v_user_id, 'gestor')
    OR has_role(v_user_id, 'gestor_grupo')
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_user_id, p_ies_id) THEN RAISE EXCEPTION 'Permission denied: cannot access this IES'; END IF;
    v_ies_id := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies_id FROM users u WHERE u.id = v_user_id;
    IF v_ies_id IS NULL THEN v_ies_id := (public.get_accessible_ies(v_user_id))[1]; END IF;
  END IF;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at), '[]'::json)
  FROM (
    SELECT sa.id as simulado_id, sa.nome as simulado_nome, sa.created_at,
      (SELECT COALESCE(json_agg(row_to_json(ad)), '[]'::json) FROM (
        SELECT q.grande_area as area, COUNT(*) as total, COUNT(*) FILTER (WHERE ap.correct) as acertos,
          ROUND(COUNT(*) FILTER (WHERE ap.correct)::numeric / NULLIF(COUNT(*), 0) * 100) as percentual
        FROM answer_progress ap
        JOIN users u ON ap.user_id = u.id
        JOIN questoes_simulado q ON ap.question_id = q.id
        WHERE ap.simulado = sa.id AND u.id_ies = v_ies_id AND q.grande_area IS NOT NULL
        GROUP BY q.grande_area
      ) ad) as areas
    FROM simulados_admin sa
    WHERE v_ies_id = ANY(sa.ies_ids)
      AND sa.status IN ('ativo', 'encerrado')
      AND sa.simulado_pai_id IS NULL  -- oculta repescagens da evolução
      AND (sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= NOW())
        OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= NOW()))))
      AND EXISTS (
        SELECT 1 FROM answer_progress ap2
        JOIN users u2 ON ap2.user_id = u2.id
        WHERE ap2.simulado = sa.id AND u2.id_ies = v_ies_id
      )
  ) t INTO result;
  RETURN result;
END;
$function$;

-- 7) get_institutional_evolution_tri: oculta filhos no histórico TRI
CREATE OR REPLACE FUNCTION public.get_institutional_evolution_tri(p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(simulado_id uuid, simulado_nome text, data_liberacao timestamp with time zone, num_students bigint, mean_score double precision, pcp double precision, concept bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_target_ies uuid;
BEGIN
  IF NOT (
       public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'professor'::app_role)
    OR public.has_role(auth.uid(), 'gestor_grupo'::app_role)
  ) THEN RAISE EXCEPTION 'Permission denied'; END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(auth.uid(), p_ies_id) THEN RAISE EXCEPTION 'Permission denied: cannot access other IES'; END IF;
    v_target_ies := p_ies_id;
  ELSE
    v_target_ies := public.get_current_user_ies_id();
    IF v_target_ies IS NULL THEN v_target_ies := (public.get_accessible_ies(auth.uid()))[1]; END IF;
  END IF;

  IF v_target_ies IS NULL THEN RAISE EXCEPTION 'IES not resolved'; END IF;

  RETURN QUERY
  SELECT r.simulado_id, s.nome AS simulado_nome, s.data_liberacao,
         r.num_students, r.mean_score, r.pcp, r.concept
  FROM public.resultados_ies_tri r
  JOIN public.simulados_admin s ON s.id = r.simulado_id
  WHERE r.college_id = v_target_ies
    AND s.simulado_pai_id IS NULL  -- oculta filhos
  ORDER BY s.data_liberacao NULLS LAST, s.nome;
END;
$function$;
