
-- 1) get_institutional_simulados: aceita gestor_grupo + valida via user_can_access_ies
CREATE OR REPLACE FUNCTION public.get_institutional_simulados(p_ies_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, nome text, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_ies_id  uuid;
BEGIN
  v_user_id := auth.uid();
  IF NOT (
       has_role(v_user_id, 'admin')
    OR has_role(v_user_id, 'professor')
    OR has_role(v_user_id, 'b2b_partner')
    OR has_role(v_user_id, 'gestor')
    OR has_role(v_user_id, 'gestor_formal')
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

  RETURN QUERY
  SELECT sa.id, sa.nome, sa.created_at
  FROM simulados_admin sa
  WHERE v_ies_id = ANY(sa.ies_ids)
    AND sa.status IN ('ativo', 'encerrado')
    AND (
      sa.liberacao_desempenho = 'imediato'
      OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= NOW())
      OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= NOW())))
    )
  ORDER BY sa.created_at DESC;
END;
$function$;

-- 2) get_institutional_question_details: aceita gestor_grupo + valida IES
CREATE OR REPLACE FUNCTION public.get_institutional_question_details(
  p_simulado_id uuid,
  p_tema text,
  p_area text DEFAULT NULL::text,
  p_specialty text DEFAULT NULL::text,
  p_ies_id uuid DEFAULT NULL::uuid
)
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

-- 3) get_institutional_tri: aceita gestor_grupo, gestor_formal + valida via user_can_access_ies
CREATE OR REPLACE FUNCTION public.get_institutional_tri(p_simulado_id uuid, p_ies_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  college_id uuid, simulado_id uuid, num_students bigint, num_proficient bigint,
  pcp double precision, mean_score double precision, median_score double precision,
  std_score double precision, min_score double precision, max_score double precision,
  concept bigint, sanctions text, is_restricted boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id    uuid;
  v_target_ies uuid;
BEGIN
  v_user_id := auth.uid();
  IF NOT (
       has_role(v_user_id, 'admin')
    OR has_role(v_user_id, 'professor')
    OR has_role(v_user_id, 'b2b_partner')
    OR has_role(v_user_id, 'gestor')
    OR has_role(v_user_id, 'gestor_formal')
    OR has_role(v_user_id, 'gestor_grupo')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_user_id, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_target_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_target_ies FROM users u WHERE u.id = v_user_id;
    IF v_target_ies IS NULL THEN
      v_target_ies := (public.get_accessible_ies(v_user_id))[1];
    END IF;
  END IF;

  IF v_target_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  RETURN QUERY
  SELECT
    r.college_id, r.simulado_id, r.num_students, r.num_proficient,
    r.pcp, r.mean_score, r.median_score, r.std_score,
    r.min_score, r.max_score, r.concept, r.sanctions, r.is_restricted
  FROM public.resultados_ies_tri r
  WHERE r.college_id = v_target_ies
    AND r.simulado_id = p_simulado_id;
END;
$function$;
