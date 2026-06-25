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
  ies_users AS (
    SELECT u.id, u.semestre
    FROM users u
    WHERE u.id_ies = v_ies_id
      AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id)
           sf.user_id, sf.simulado_id
    FROM simulados_finalizados sf
    WHERE sf.simulado_id IN (SELECT simulado_id FROM grupo)
      AND sf.user_id IN (SELECT id FROM ies_users)
    ORDER BY sf.user_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fallback AS (
    SELECT DISTINCT ON (ap.user_id)
           ap.user_id, ap.simulado AS simulado_id
    FROM answer_progress ap
    JOIN simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.simulado IN (SELECT simulado_id FROM grupo)
      AND ap.user_id IN (SELECT id FROM ies_users)
      AND ap.user_id NOT IN (SELECT user_id FROM ultima)
    ORDER BY ap.user_id, sa_ord.created_at DESC NULLS LAST
  ),
  ultima_final AS (
    SELECT * FROM ultima
    UNION ALL
    SELECT * FROM ultima_fallback
  ),
  ies_answers AS (
    SELECT ap.question_id, ap.correct, ap.user_id, iu.semestre,
           q.grande_area, q.especialidade, q.tema
    FROM ultima_final uf
    JOIN ies_users iu        ON iu.id = uf.user_id
    JOIN answer_progress ap  ON ap.user_id = uf.user_id AND ap.simulado = uf.simulado_id
    JOIN questoes_simulado q ON ap.question_id = q.id
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
  ies_users AS (
    SELECT u.id, u.nome, u.semestre
    FROM users u
    WHERE u.id_ies = v_ies_id
      AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id)
           sf.user_id, sf.simulado_id
    FROM simulados_finalizados sf
    WHERE sf.simulado_id IN (SELECT simulado_id FROM grupo)
      AND sf.user_id IN (SELECT id FROM ies_users)
    ORDER BY sf.user_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fallback AS (
    SELECT DISTINCT ON (ap.user_id)
           ap.user_id, ap.simulado AS simulado_id
    FROM answer_progress ap
    JOIN simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.simulado IN (SELECT simulado_id FROM grupo)
      AND ap.user_id IN (SELECT id FROM ies_users)
      AND ap.user_id NOT IN (SELECT user_id FROM ultima)
    ORDER BY ap.user_id, sa_ord.created_at DESC NULLS LAST
  ),
  ultima_final AS (
    SELECT * FROM ultima
    UNION ALL
    SELECT * FROM ultima_fallback
  ),
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
        JOIN ies_users u ON u.id = uf.user_id
        JOIN answer_progress ap ON ap.user_id = u.id AND ap.simulado = uf.simulado_id
        LEFT JOIN questoes_simulado q0 ON ap.question_id = q0.id
        GROUP BY u.id, u.nome, u.semestre, uf.simulado_id
      ) st
    )
  ) INTO result;
  RETURN result;
END;
$function$;