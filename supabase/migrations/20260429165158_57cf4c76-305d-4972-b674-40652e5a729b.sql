
-- 1) Atribui a role gestor_formal ao Sérgio
INSERT INTO public.user_roles (user_id, role)
VALUES ('1f618ac7-fd01-4e02-a9aa-83d120974700', 'gestor_formal')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) get_institutional_performance: exclui gestor_formal
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
    WHERE ap.simulado = p_simulado_id
      AND u.id_ies = v_ies_id
      AND NOT has_role(u.id, 'gestor_formal')
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

-- 3) get_institutional_student_scores: exclui gestor_formal
CREATE OR REPLACE FUNCTION public.get_institutional_student_scores(p_simulado_id uuid, p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_ies_id uuid;
  result json;
BEGIN
  v_user_id := auth.uid();
  IF NOT (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'professor') OR has_role(v_user_id, 'b2b_partner') OR has_role(v_user_id, 'gestor')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL AND (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'b2b_partner')) THEN
    v_ies_id := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies_id FROM users u WHERE u.id = v_user_id;
  END IF;

  SELECT json_build_object(
    'areas', (
      SELECT COALESCE(json_agg(DISTINCT q.grande_area ORDER BY q.grande_area), '[]'::json)
      FROM questoes_simulado q WHERE q.simulado_id = p_simulado_id AND q.grande_area IS NOT NULL
    ),
    'students', (
      SELECT COALESCE(json_agg(row_to_json(st) ORDER BY st.score_total DESC), '[]'::json)
      FROM (
        SELECT u.nome, u.semestre,
          COUNT(*) FILTER (WHERE ap.correct) as score_total,
          COUNT(*) as total_questions,
          (SELECT json_object_agg(sub.area, sub.acertos)
           FROM (
             SELECT q2.grande_area as area, COUNT(*) FILTER (WHERE ap2.correct) as acertos
             FROM answer_progress ap2 JOIN questoes_simulado q2 ON ap2.question_id = q2.id
             WHERE ap2.user_id = u.id AND ap2.simulado = p_simulado_id AND q2.grande_area IS NOT NULL
             GROUP BY q2.grande_area
           ) sub
          ) as scores_by_area
        FROM answer_progress ap JOIN users u ON ap.user_id = u.id
        WHERE ap.simulado = p_simulado_id
          AND u.id_ies = v_ies_id
          AND NOT has_role(u.id, 'gestor_formal')
        GROUP BY u.id, u.nome, u.semestre
      ) st
    )
  ) INTO result;
  RETURN result;
END;
$function$;

-- 4) get_institutional_evolution: exclui gestor_formal
CREATE OR REPLACE FUNCTION public.get_institutional_evolution(p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_ies_id uuid;
  result json;
BEGIN
  v_user_id := auth.uid();
  IF NOT (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'professor') OR has_role(v_user_id, 'b2b_partner') OR has_role(v_user_id, 'gestor')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL AND (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'b2b_partner')) THEN
    v_ies_id := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies_id FROM users u WHERE u.id = v_user_id;
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
        WHERE ap.simulado = sa.id
          AND u.id_ies = v_ies_id
          AND q.grande_area IS NOT NULL
          AND NOT has_role(u.id, 'gestor_formal')
        GROUP BY q.grande_area
      ) ad) as areas
    FROM simulados_admin sa
    WHERE v_ies_id = ANY(sa.ies_ids)
      AND sa.status IN ('ativo', 'encerrado')
      AND (sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= NOW())
        OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= NOW()))))
      AND EXISTS (
        SELECT 1 FROM answer_progress ap2
        JOIN users u2 ON ap2.user_id = u2.id
        WHERE ap2.simulado = sa.id
          AND u2.id_ies = v_ies_id
          AND NOT has_role(u2.id, 'gestor_formal')
      )
  ) t
  INTO result;
  RETURN result;
END;
$function$;

-- 5) get_theme_evolution: exclui gestor_formal
CREATE OR REPLACE FUNCTION public.get_theme_evolution(p_tema text, p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_ies_id uuid;
  result json;
BEGIN
  v_user_id := auth.uid();
  IF NOT (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'professor') OR has_role(v_user_id, 'b2b_partner') OR has_role(v_user_id, 'gestor')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL AND (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'b2b_partner')) THEN
    v_ies_id := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies_id FROM users u WHERE u.id = v_user_id;
  END IF;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at), '[]'::json)
  FROM (
    SELECT sa.nome AS simulado_nome, sa.created_at,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE ap.correct) AS acertos,
      ROUND(COUNT(*) FILTER (WHERE ap.correct)::numeric / NULLIF(COUNT(*), 0) * 100) AS percentual
    FROM simulados_admin sa
    JOIN questoes_simulado q ON q.simulado_id = sa.id AND q.tema = p_tema
    JOIN answer_progress ap ON ap.question_id = q.id AND ap.simulado = sa.id
    JOIN users u ON ap.user_id = u.id AND u.id_ies = v_ies_id
    WHERE v_ies_id = ANY(sa.ies_ids)
      AND sa.status IN ('ativo', 'encerrado')
      AND NOT has_role(u.id, 'gestor_formal')
      AND (
        sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= NOW())
        OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= NOW())))
      )
    GROUP BY sa.id, sa.nome, sa.created_at
    HAVING COUNT(*) > 0
  ) t
  INTO result;

  RETURN result;
END;
$function$;

-- 6) get_institutional_question_details: exclui gestor_formal das distribuições e listas de alunos
CREATE OR REPLACE FUNCTION public.get_institutional_question_details(p_simulado_id uuid, p_tema text, p_area text DEFAULT NULL::text, p_specialty text DEFAULT NULL::text, p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_ies_id uuid;
  result json;
BEGIN
  v_user_id := auth.uid();
  IF NOT (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'professor') OR has_role(v_user_id, 'b2b_partner') OR has_role(v_user_id, 'gestor')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_ies_id IS NOT NULL AND (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'b2b_partner')) THEN
    v_ies_id := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies_id FROM users u WHERE u.id = v_user_id;
  END IF;
  SELECT json_build_object(
    'questions', (
      SELECT COALESCE(json_agg(row_to_json(qq)), '[]'::json)
      FROM (
        SELECT q.id, q.enunciado, q.alternativa_a as a, q.alternativa_b as b, q.alternativa_c as c, q.alternativa_d as d,
          q.correta as gabarito, q.comentario, q.imagem, q.anulada,
          (SELECT COALESCE(json_agg(row_to_json(sd)), '[]'::json) FROM (
            SELECT u2.semestre, COUNT(*) as total, COUNT(*) FILTER (WHERE ap2.correct) as acertos
            FROM answer_progress ap2 JOIN users u2 ON ap2.user_id = u2.id
            WHERE ap2.question_id = q.id AND ap2.simulado = p_simulado_id
              AND u2.id_ies = v_ies_id AND u2.semestre IS NOT NULL
              AND NOT has_role(u2.id, 'gestor_formal')
            GROUP BY u2.semestre ORDER BY u2.semestre
          ) sd) as semester_distribution,
          (SELECT COALESCE(json_agg(row_to_json(sl) ORDER BY sl.nome), '[]'::json) FROM (
            SELECT u3.nome, u3.semestre, ap3.correct as acertou, UPPER(ap3.resposta_usuario) as resposta
            FROM answer_progress ap3 JOIN users u3 ON ap3.user_id = u3.id
            WHERE ap3.question_id = q.id AND ap3.simulado = p_simulado_id
              AND u3.id_ies = v_ies_id
              AND NOT has_role(u3.id, 'gestor_formal')
          ) sl) as students
        FROM questoes_simulado q
        WHERE q.simulado_id = p_simulado_id AND q.tema = p_tema
          AND (p_area IS NULL OR q.grande_area = p_area)
          AND (p_specialty IS NULL OR q.especialidade = p_specialty)
        ORDER BY q.ordem LIMIT 20
      ) qq
    )
  ) INTO result;
  RETURN result;
END;
$function$;
