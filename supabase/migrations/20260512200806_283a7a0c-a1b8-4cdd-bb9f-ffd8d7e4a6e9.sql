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
    OR has_role(v_user_id, 'b2b_partner')
    OR has_role(v_user_id, 'gestor')
    OR has_role(v_user_id, 'gestor_formal')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL AND (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'b2b_partner')) THEN
    v_ies_id := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies_id FROM users u WHERE u.id = v_user_id;
  END IF;

  WITH ies_answers AS (
    SELECT ap.question_id, ap.correct, ap.user_id, u.semestre,
           q.grande_area, q.especialidade, q.tema
    FROM answer_progress ap
    JOIN users u             ON ap.user_id     = u.id
    JOIN questoes_simulado q ON ap.question_id = q.id
    WHERE ap.simulado = p_simulado_id
      AND u.id_ies = v_ies_id
      AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
  )
  SELECT json_build_object(
    'overallStats',  (SELECT json_build_object(
                        'total',         COUNT(*),
                        'acertos',       COUNT(*) FILTER (WHERE correct),
                        'totalStudents', COUNT(DISTINCT user_id)
                      ) FROM ies_answers),
    'bySemester',    (SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.semestre), '[]'::json)
                      FROM (SELECT semestre,
                                   COUNT(*) AS total,
                                   COUNT(*) FILTER (WHERE correct) AS acertos,
                                   COUNT(DISTINCT user_id) AS num_students
                            FROM ies_answers WHERE semestre IS NOT NULL
                            GROUP BY semestre) t),
    'byArea',        (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
                      FROM (SELECT grande_area AS name,
                                   COUNT(*) AS total,
                                   COUNT(*) FILTER (WHERE correct) AS acertos
                            FROM ies_answers WHERE grande_area IS NOT NULL
                            GROUP BY grande_area ORDER BY grande_area) t),
    'bySpecialty',   (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
                      FROM (SELECT especialidade AS name,
                                   grande_area  AS area_name,
                                   COUNT(*) AS total,
                                   COUNT(*) FILTER (WHERE correct) AS acertos
                            FROM ies_answers WHERE especialidade IS NOT NULL
                            GROUP BY especialidade, grande_area ORDER BY especialidade) t),
    'bySubspecialty',(SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
                      FROM (SELECT tema           AS name,
                                   especialidade  AS specialty_name,
                                   grande_area    AS area_name,
                                   COUNT(*) AS total,
                                   COUNT(*) FILTER (WHERE correct) AS acertos
                            FROM ies_answers WHERE tema IS NOT NULL
                            GROUP BY tema, especialidade, grande_area ORDER BY tema) t)
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
  v_user_id uuid;
  v_ies_id uuid;
  v_totals_by_area json;
  v_totals_by_tema json;
  result json;
BEGIN
  v_user_id := auth.uid();
  IF NOT (
       has_role(v_user_id, 'admin')
    OR has_role(v_user_id, 'professor')
    OR has_role(v_user_id, 'b2b_partner')
    OR has_role(v_user_id, 'gestor')
    OR has_role(v_user_id, 'gestor_formal')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL AND (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'b2b_partner')) THEN
    v_ies_id := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies_id FROM users u WHERE u.id = v_user_id;
  END IF;

  SELECT COALESCE(json_object_agg(area, total), '{}'::json) INTO v_totals_by_area
  FROM (
    SELECT q.grande_area AS area, COUNT(*) AS total
    FROM questoes_simulado q
    WHERE q.simulado_id = p_simulado_id
      AND q.grande_area IS NOT NULL
      AND COALESCE(q.anulada, false) = false
    GROUP BY q.grande_area
  ) ta;

  SELECT COALESCE(json_object_agg(tema, total), '{}'::json) INTO v_totals_by_tema
  FROM (
    SELECT q.tema AS tema, COUNT(*) AS total
    FROM questoes_simulado q
    WHERE q.simulado_id = p_simulado_id
      AND q.tema IS NOT NULL
      AND COALESCE(q.anulada, false) = false
    GROUP BY q.tema
  ) tt;

  SELECT json_build_object(
    'areas', (
      SELECT COALESCE(json_agg(DISTINCT q.grande_area ORDER BY q.grande_area), '[]'::json)
      FROM questoes_simulado q
      WHERE q.simulado_id = p_simulado_id
        AND q.grande_area IS NOT NULL
        AND COALESCE(q.anulada, false) = false
    ),
    'students', (
      SELECT COALESCE(json_agg(row_to_json(st) ORDER BY st.score_total DESC), '[]'::json)
      FROM (
        SELECT u.id AS student_id, u.nome, u.semestre,
          COUNT(*) FILTER (WHERE ap.correct AND COALESCE(q0.anulada, false) = false) as score_total,
          COUNT(*) FILTER (WHERE COALESCE(q0.anulada, false) = false) as total_questions,
          (SELECT json_object_agg(sub.area, sub.acertos)
           FROM (
             SELECT q2.grande_area as area, COUNT(*) FILTER (WHERE ap2.correct) as acertos
             FROM answer_progress ap2
             JOIN questoes_simulado q2 ON ap2.question_id = q2.id
             WHERE ap2.user_id = u.id
               AND ap2.simulado = p_simulado_id
               AND q2.grande_area IS NOT NULL
               AND COALESCE(q2.anulada, false) = false
             GROUP BY q2.grande_area
           ) sub
          ) as scores_by_area,
          v_totals_by_area as totals_by_area,
          (SELECT json_object_agg(subt.tema, subt.acertos)
           FROM (
             SELECT q3.tema as tema, COUNT(*) FILTER (WHERE ap3.correct) as acertos
             FROM answer_progress ap3
             JOIN questoes_simulado q3 ON ap3.question_id = q3.id
             WHERE ap3.user_id = u.id
               AND ap3.simulado = p_simulado_id
               AND q3.tema IS NOT NULL
               AND COALESCE(q3.anulada, false) = false
             GROUP BY q3.tema
           ) subt
          ) as scores_by_tema,
          v_totals_by_tema as totals_by_tema
        FROM answer_progress ap
        JOIN users u ON ap.user_id = u.id
        LEFT JOIN questoes_simulado q0 ON ap.question_id = q0.id
        WHERE ap.simulado = p_simulado_id
          AND u.id_ies = v_ies_id
          AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
        GROUP BY u.id, u.nome, u.semestre
      ) st
    )
  ) INTO result;
  RETURN result;
END;
$function$;