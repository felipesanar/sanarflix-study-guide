
-- 1) Update get_user_performance_aggregates to exclude annulled questions
CREATE OR REPLACE FUNCTION public.get_user_performance_aggregates(p_simulado_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  WITH user_answers AS (
    SELECT 
      ap.question_id,
      ap.correct,
      q.grande_area    AS area_name,
      q.especialidade  AS specialty_name,
      q.tema           AS subspecialty_name
    FROM answer_progress ap
    JOIN questoes_simulado q ON ap.question_id = q.id
    JOIN simulados_admin sa  ON ap.simulado    = sa.id
    WHERE ap.user_id = auth.uid()
      AND q.anulada = false
      AND (p_simulado_id IS NULL OR ap.simulado = p_simulado_id)
      AND (
        p_simulado_id IS NOT NULL
        OR sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado'
            AND sa.data_liberacao_desempenho IS NOT NULL
            AND sa.data_liberacao_desempenho <= NOW())
        OR (sa.liberacao_desempenho = 'ao_encerrar'
            AND (sa.status = 'encerrado'
                 OR (sa.data_encerramento IS NOT NULL
                     AND sa.data_encerramento <= NOW())))
      )
  )
  SELECT json_build_object(
    'overallStats', (
      SELECT json_build_object(
        'total',   COUNT(*),
        'acertos', COUNT(*) FILTER (WHERE correct = true)
      ) FROM user_answers
    ),
    'byArea', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT area_name AS name,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE correct = true) AS acertos
        FROM user_answers
        WHERE area_name IS NOT NULL
        GROUP BY area_name
        ORDER BY area_name
      ) t
    ),
    'bySpecialty', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT specialty_name AS name,
               area_name,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE correct = true) AS acertos
        FROM user_answers
        WHERE specialty_name IS NOT NULL
        GROUP BY specialty_name, area_name
        ORDER BY specialty_name
      ) t
    ),
    'bySubspecialty', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT subspecialty_name AS name,
               specialty_name,
               area_name,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE correct = true) AS acertos
        FROM user_answers
        WHERE subspecialty_name IS NOT NULL
        GROUP BY subspecialty_name, specialty_name, area_name
        ORDER BY subspecialty_name
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$function$;

-- 2) Update get_user_rankings to exclude annulled questions
CREATE OR REPLACE FUNCTION public.get_user_rankings(p_simulado_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_ies_id uuid;
  user_semester integer;
  result json;
BEGIN
  SELECT id_ies, semestre INTO user_ies_id, user_semester
  FROM users
  WHERE id = auth.uid();

  WITH rankings AS (
    SELECT 
      ap.user_id,
      COUNT(*) FILTER (WHERE ap.correct = true) as acertos,
      COUNT(*) as total
    FROM answer_progress ap
    JOIN questoes_simulado qs ON ap.question_id = qs.id
    WHERE qs.anulada = false
      AND (p_simulado_id IS NULL OR ap.simulado = p_simulado_id)
    GROUP BY ap.user_id
  ),
  ies_ranking AS (
    SELECT 
      r.user_id,
      r.acertos,
      RANK() OVER (ORDER BY r.acertos DESC) as rank
    FROM rankings r
    JOIN users u ON r.user_id = u.id
    WHERE u.id_ies = user_ies_id
  ),
  semester_ranking AS (
    SELECT 
      r.user_id,
      r.acertos,
      RANK() OVER (ORDER BY r.acertos DESC) as rank
    FROM rankings r
    JOIN users u ON r.user_id = u.id
    WHERE u.id_ies = user_ies_id AND u.semestre = user_semester
  )
  SELECT json_build_object(
    'rankingIES', (
      SELECT json_build_object(
        'rank', rank,
        'total', (SELECT COUNT(*) FROM ies_ranking)
      )
      FROM ies_ranking
      WHERE user_id = auth.uid()
    ),
    'rankingSemester', (
      SELECT json_build_object(
        'rank', rank,
        'total', (SELECT COUNT(*) FROM semester_ranking)
      )
      FROM semester_ranking
      WHERE user_id = auth.uid()
    )
  ) INTO result;

  RETURN result;
END;
$function$;
