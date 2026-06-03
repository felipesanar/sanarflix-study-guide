
-- 1) Drop obsolete B2B partner SELECT policies (0 users have this role)
DROP POLICY IF EXISTS "B2B partners can view all answers" ON public.answer_progress;
DROP POLICY IF EXISTS "B2B partners can view all users" ON public.users;
DROP POLICY IF EXISTS "B2B partners can view all simulados" ON public.simulados_admin;
DROP POLICY IF EXISTS "B2B partners can view all questoes" ON public.questoes_simulado;
DROP POLICY IF EXISTS "B2B partners view all IES results" ON public.resultados_ies_tri;
DROP POLICY IF EXISTS "B2B partners view all student TRI" ON public.resultados_alunos_tri;

-- 2) Block insertion of deprecated enum values into user_roles (additive)
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_not_deprecated;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_not_deprecated
  CHECK (role NOT IN (
    'user'::public.app_role,
    'moderator'::public.app_role,
    'b2b_partner'::public.app_role,
    'gestor_formal'::public.app_role
  ));

-- 3) Recreate user_can_access_ies without b2b_partner shortcut
CREATE OR REPLACE FUNCTION public.user_can_access_ies(_user uuid, _ies uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _ies IS NULL THEN false
    WHEN public.has_role(_user, 'admin'::public.app_role) THEN true
    ELSE _ies = ANY (public.get_accessible_ies(_user))
  END;
$function$;

-- 4) Recreate institutional RPCs without b2b_partner / gestor_formal refs

CREATE OR REPLACE FUNCTION public.get_institutional_performance(p_simulado_id uuid, p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
    'overallStats',  (SELECT json_build_object('total',COUNT(*),'acertos',COUNT(*) FILTER (WHERE correct),'totalStudents',COUNT(DISTINCT user_id)) FROM ies_answers),
    'bySemester',    (SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.semestre), '[]'::json) FROM (SELECT semestre, COUNT(*) AS total, COUNT(*) FILTER (WHERE correct) AS acertos, COUNT(DISTINCT user_id) AS num_students FROM ies_answers WHERE semestre IS NOT NULL GROUP BY semestre) t),
    'byArea',        (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT grande_area AS name, COUNT(*) AS total, COUNT(*) FILTER (WHERE correct) AS acertos FROM ies_answers WHERE grande_area IS NOT NULL GROUP BY grande_area ORDER BY grande_area) t),
    'bySpecialty',   (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT especialidade AS name, grande_area AS area_name, COUNT(*) AS total, COUNT(*) FILTER (WHERE correct) AS acertos FROM ies_answers WHERE especialidade IS NOT NULL GROUP BY especialidade, grande_area ORDER BY especialidade) t),
    'bySubspecialty',(SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT tema AS name, especialidade AS specialty_name, grande_area AS area_name, COUNT(*) AS total, COUNT(*) FILTER (WHERE correct) AS acertos FROM ies_answers WHERE tema IS NOT NULL GROUP BY tema, especialidade, grande_area ORDER BY tema) t)
  ) INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_institutional_evolution(p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.get_institutional_question_details(p_simulado_id uuid, p_tema text, p_area text DEFAULT NULL::text, p_specialty text DEFAULT NULL::text, p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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

  SELECT json_build_object(
    'questions', (
      SELECT COALESCE(json_agg(row_to_json(qq)), '[]'::json)
      FROM (
        SELECT q.id, q.enunciado, q.alternativa_a as a, q.alternativa_b as b, q.alternativa_c as c, q.alternativa_d as d,
          q.correta as gabarito, q.comentario, q.imagem, q.anulada,
          (SELECT COALESCE(json_agg(row_to_json(sd)), '[]'::json) FROM (
            SELECT u2.semestre, COUNT(*) as total, COUNT(*) FILTER (WHERE ap2.correct) as acertos
            FROM answer_progress ap2 JOIN users u2 ON ap2.user_id = u2.id
            WHERE ap2.question_id = q.id AND ap2.simulado = p_simulado_id AND u2.id_ies = v_ies_id AND u2.semestre IS NOT NULL
            GROUP BY u2.semestre ORDER BY u2.semestre
          ) sd) as semester_distribution,
          (SELECT COALESCE(json_agg(row_to_json(sl) ORDER BY sl.nome), '[]'::json) FROM (
            SELECT u3.nome, u3.semestre, ap3.correct as acertou, UPPER(ap3.resposta_usuario) as resposta
            FROM answer_progress ap3 JOIN users u3 ON ap3.user_id = u3.id
            WHERE ap3.question_id = q.id AND ap3.simulado = p_simulado_id AND u3.id_ies = v_ies_id
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

CREATE OR REPLACE FUNCTION public.get_institutional_student_scores(p_simulado_id uuid, p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid; v_ies_id uuid;
  v_totals_by_area json; v_totals_by_tema json; result json;
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

  SELECT COALESCE(json_object_agg(area, total), '{}'::json) INTO v_totals_by_area
  FROM (SELECT q.grande_area AS area, COUNT(*) AS total FROM questoes_simulado q
        WHERE q.simulado_id = p_simulado_id AND q.grande_area IS NOT NULL AND COALESCE(q.anulada, false) = false
        GROUP BY q.grande_area) ta;

  SELECT COALESCE(json_object_agg(tema, total), '{}'::json) INTO v_totals_by_tema
  FROM (SELECT q.tema AS tema, COUNT(*) AS total FROM questoes_simulado q
        WHERE q.simulado_id = p_simulado_id AND q.tema IS NOT NULL AND COALESCE(q.anulada, false) = false
        GROUP BY q.tema) tt;

  SELECT json_build_object(
    'areas', (SELECT COALESCE(json_agg(DISTINCT q.grande_area ORDER BY q.grande_area), '[]'::json)
              FROM questoes_simulado q
              WHERE q.simulado_id = p_simulado_id AND q.grande_area IS NOT NULL AND COALESCE(q.anulada, false) = false),
    'students', (
      SELECT COALESCE(json_agg(row_to_json(st) ORDER BY st.score_total DESC), '[]'::json)
      FROM (
        SELECT u.id AS student_id, u.nome, u.semestre,
          COUNT(*) FILTER (WHERE ap.correct AND COALESCE(q0.anulada, false) = false) as score_total,
          COUNT(*) FILTER (WHERE COALESCE(q0.anulada, false) = false) as total_questions,
          (SELECT json_object_agg(sub.area, sub.acertos) FROM (
             SELECT q2.grande_area as area, COUNT(*) FILTER (WHERE ap2.correct) as acertos
             FROM answer_progress ap2 JOIN questoes_simulado q2 ON ap2.question_id = q2.id
             WHERE ap2.user_id = u.id AND ap2.simulado = p_simulado_id AND q2.grande_area IS NOT NULL AND COALESCE(q2.anulada, false) = false
             GROUP BY q2.grande_area) sub) as scores_by_area,
          v_totals_by_area as totals_by_area,
          (SELECT json_object_agg(subt.tema, subt.acertos) FROM (
             SELECT q3.tema as tema, COUNT(*) FILTER (WHERE ap3.correct) as acertos
             FROM answer_progress ap3 JOIN questoes_simulado q3 ON ap3.question_id = q3.id
             WHERE ap3.user_id = u.id AND ap3.simulado = p_simulado_id AND q3.tema IS NOT NULL AND COALESCE(q3.anulada, false) = false
             GROUP BY q3.tema) subt) as scores_by_tema,
          v_totals_by_tema as totals_by_tema
        FROM answer_progress ap
        JOIN users u ON ap.user_id = u.id
        LEFT JOIN questoes_simulado q0 ON ap.question_id = q0.id
        WHERE ap.simulado = p_simulado_id AND u.id_ies = v_ies_id
          AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
        GROUP BY u.id, u.nome, u.semestre
      ) st
    )
  ) INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_theme_evolution(p_tema text, p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid; v_ies_id uuid; result json;
BEGIN
  v_user_id := auth.uid();
  IF NOT (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'professor') OR has_role(v_user_id, 'gestor') OR has_role(v_user_id, 'gestor_grupo')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL AND has_role(v_user_id, 'admin') THEN
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
      AND (sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= NOW())
        OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= NOW()))))
    GROUP BY sa.id, sa.nome, sa.created_at
    HAVING COUNT(*) > 0
  ) t INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_institutional_simulados(p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, nome text, created_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
    AND (sa.liberacao_desempenho = 'imediato'
      OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= NOW())
      OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= NOW()))))
  ORDER BY sa.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_institutional_evolution_tri(p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(simulado_id uuid, simulado_nome text, data_liberacao timestamp with time zone, num_students bigint, mean_score double precision, pcp double precision, concept bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
  ORDER BY s.data_liberacao NULLS LAST, s.nome;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_institutional_tri(p_simulado_id uuid, p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(college_id uuid, simulado_id uuid, num_students bigint, num_proficient bigint, pcp double precision, mean_score double precision, median_score double precision, std_score double precision, min_score double precision, max_score double precision, concept bigint, sanctions text, is_restricted boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid; v_target_ies uuid;
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
    v_target_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_target_ies FROM users u WHERE u.id = v_user_id;
    IF v_target_ies IS NULL THEN v_target_ies := (public.get_accessible_ies(v_user_id))[1]; END IF;
  END IF;

  IF v_target_ies IS NULL THEN RAISE EXCEPTION 'IES not resolved'; END IF;

  RETURN QUERY
  SELECT r.college_id, r.simulado_id, r.num_students, r.num_proficient,
         r.pcp, r.mean_score, r.median_score, r.std_score,
         r.min_score, r.max_score, r.concept, r.sanctions, r.is_restricted
  FROM public.resultados_ies_tri r
  WHERE r.college_id = v_target_ies AND r.simulado_id = p_simulado_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_institutional_longitudinal_tri(p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(simulado_id uuid, simulado_nome text, data_liberacao timestamp with time zone, mean_score double precision, pcp double precision, concept bigint, sanctions text, num_students bigint, delta_mean_score double precision, delta_pcp double precision, delta_concept bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_target_ies uuid;
BEGIN
  IF NOT (
       public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'professor'::app_role)
    OR public.has_role(auth.uid(), 'gestor_grupo'::app_role)
  ) THEN RAISE EXCEPTION 'Permissão negada'; END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(auth.uid(), p_ies_id) THEN RAISE EXCEPTION 'Permissão negada para a IES informada'; END IF;
    v_target_ies := p_ies_id;
  ELSE
    v_target_ies := public.get_current_user_ies_id();
    IF v_target_ies IS NULL THEN v_target_ies := (public.get_accessible_ies(auth.uid()))[1]; END IF;
  END IF;

  IF v_target_ies IS NULL THEN RAISE EXCEPTION 'IES não informada e usuário sem IES vinculada'; END IF;

  RETURN QUERY
  WITH ordered AS (
    SELECT mv.simulado_id, mv.simulado_nome, mv.data_liberacao,
      mv.mean_score, mv.pcp, mv.concept, mv.sanctions, mv.num_students,
      LAG(mv.mean_score) OVER w AS prev_mean_score,
      LAG(mv.pcp) OVER w AS prev_pcp,
      LAG(mv.concept) OVER w AS prev_concept
    FROM public.mv_evolucao_institucional_tri mv
    WHERE mv.college_id = v_target_ies
    WINDOW w AS (ORDER BY mv.data_liberacao NULLS LAST, mv.simulado_id)
  )
  SELECT o.simulado_id, o.simulado_nome, o.data_liberacao,
    o.mean_score, o.pcp, o.concept, o.sanctions, o.num_students,
    (o.mean_score - o.prev_mean_score) AS delta_mean_score,
    (o.pcp - o.prev_pcp) AS delta_pcp,
    (o.concept - o.prev_concept) AS delta_concept
  FROM ordered o
  ORDER BY o.data_liberacao NULLS LAST, o.simulado_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_student_growth_tri(p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(student_id uuid, num_simulados bigint, first_theta double precision, last_theta double precision, delta_theta double precision, first_score_enamed double precision, last_score_enamed double precision, delta_score_enamed double precision)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_target_ies uuid;
BEGIN
  IF NOT (
       public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'professor'::app_role)
    OR public.has_role(auth.uid(), 'gestor_grupo'::app_role)
  ) THEN RAISE EXCEPTION 'Permissão negada'; END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(auth.uid(), p_ies_id) THEN RAISE EXCEPTION 'Permissão negada para a IES informada'; END IF;
    v_target_ies := p_ies_id;
  ELSE
    v_target_ies := public.get_current_user_ies_id();
    IF v_target_ies IS NULL THEN v_target_ies := (public.get_accessible_ies(auth.uid()))[1]; END IF;
  END IF;

  IF v_target_ies IS NULL THEN RAISE EXCEPTION 'IES não informada e usuário sem IES vinculada'; END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT r.student_id, r.theta, r.score_enamed, sa.data_liberacao,
      ROW_NUMBER() OVER (PARTITION BY r.student_id ORDER BY sa.data_liberacao NULLS LAST, r.simulado_id) AS rn_first,
      ROW_NUMBER() OVER (PARTITION BY r.student_id ORDER BY sa.data_liberacao DESC NULLS LAST, r.simulado_id DESC) AS rn_last,
      COUNT(*) OVER (PARTITION BY r.student_id) AS n
    FROM public.resultados_alunos_tri r
    LEFT JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_target_ies
  ),
  firsts AS (SELECT student_id, theta AS first_theta, score_enamed AS first_score_enamed, n FROM ranked WHERE rn_first = 1),
  lasts  AS (SELECT student_id, theta AS last_theta, score_enamed AS last_score_enamed FROM ranked WHERE rn_last = 1)
  SELECT f.student_id, f.n AS num_simulados,
    f.first_theta, l.last_theta, (l.last_theta - f.first_theta) AS delta_theta,
    f.first_score_enamed, l.last_score_enamed, (l.last_score_enamed - f.first_score_enamed) AS delta_score_enamed
  FROM firsts f JOIN lasts l USING (student_id)
  ORDER BY (l.last_theta - f.first_theta) DESC NULLS LAST;
END;
$function$;
