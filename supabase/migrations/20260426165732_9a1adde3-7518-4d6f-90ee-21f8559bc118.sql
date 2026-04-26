-- 1. Atualizar get_user_performance_aggregates: remove byDifficulty e a coluna `difficulty` do CTE.
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

-- 2. Atualizar get_institutional_performance: remove byDifficulty e a coluna `difficulty` do CTE.
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
    WHERE ap.simulado = p_simulado_id AND u.id_ies = v_ies_id
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

-- 3. Remover a coluna `grau_dificuldade` da tabela de questões dos simulados.
ALTER TABLE public.questoes_simulado DROP COLUMN IF EXISTS grau_dificuldade;