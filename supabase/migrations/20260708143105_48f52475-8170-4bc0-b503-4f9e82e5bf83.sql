-- Fix: get_institutional_tri — recorte por semestre a partir da tabela POR-ALUNO
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS sig
    FROM pg_proc
    WHERE proname = 'get_institutional_tri'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig::text || ' CASCADE';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_institutional_tri(
  p_simulado_id uuid,
  p_ies_id uuid DEFAULT NULL,
  p_semestres integer[] DEFAULT NULL,
  p_semestre integer DEFAULT NULL
)
RETURNS TABLE(
  college_id uuid,
  simulado_id uuid,
  num_students bigint,
  num_proficient bigint,
  pcp double precision,
  mean_score double precision,
  median_score double precision,
  std_score double precision,
  min_score double precision,
  max_score double precision,
  concept bigint,
  sanctions text,
  is_restricted boolean,
  num_below_expected bigint,
  num_students_sixth_year bigint,
  num_proficient_sixth_year bigint,
  pcp_sixth_year double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id   uuid;
  v_target_ies uuid;
  v_sems      integer[];
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

  v_sems := COALESCE(
    p_semestres,
    CASE WHEN p_semestre IS NOT NULL THEN ARRAY[p_semestre] ELSE NULL END
  );

  IF v_sems IS NULL OR array_length(v_sems, 1) IS NULL THEN
    -- BASE GERAL: mantém valores pré-agregados autoritativos.
    RETURN QUERY
    WITH sy AS (
      SELECT
        count(*) FILTER (WHERE a.score_proprio < 60)::bigint AS below,
        count(*) FILTER (WHERE u.semestre = ANY (ARRAY[11,12]))::bigint AS sy_n,
        count(*) FILTER (WHERE u.semestre = ANY (ARRAY[11,12]) AND a.is_proficient_proprio)::bigint AS sy_prof
      FROM public.resultados_alunos_tri a
      JOIN public.users u ON u.id = a.student_id
      WHERE a.college_id = v_target_ies
        AND a.simulado_id = p_simulado_id
    )
    SELECT
      r.college_id, r.simulado_id, r.num_students, r.num_proficient, r.pcp,
      r.mean_score, r.median_score, r.std_score, r.min_score, r.max_score,
      r.concept, r.sanctions, r.is_restricted,
      sy.below, sy.sy_n, sy.sy_prof,
      CASE WHEN sy.sy_n > 0
           THEN round((100.0 * sy.sy_prof / sy.sy_n)::numeric, 2)::double precision
           ELSE NULL END
    FROM public.resultados_ies_tri r
    CROSS JOIN sy
    WHERE r.college_id = v_target_ies
      AND r.simulado_id = p_simulado_id;
  ELSE
    -- BASE RECORTADA POR SEMESTRE: computa a partir da tabela por-aluno.
    RETURN QUERY
    WITH scoped AS (
      SELECT a.score_proprio AS score, a.is_proficient_proprio AS prof
      FROM public.resultados_alunos_tri a
      JOIN public.users u ON u.id = a.student_id
      WHERE a.college_id = v_target_ies
        AND a.simulado_id = p_simulado_id
        AND u.semestre = ANY (v_sems)
    ),
    agg AS (
      SELECT
        count(*)::bigint AS n,
        count(*) FILTER (WHERE prof)::bigint AS n_prof,
        count(*) FILTER (WHERE score < 60)::bigint AS n_below,
        avg(score)::double precision AS mean_s,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY score)::double precision AS median_s,
        stddev_samp(score)::double precision AS std_s,
        min(score)::double precision AS min_s,
        max(score)::double precision AS max_s
      FROM scoped
    )
    SELECT
      v_target_ies, p_simulado_id, agg.n, agg.n_prof,
      CASE WHEN agg.n > 0 THEN round((100.0 * agg.n_prof / agg.n)::numeric, 2)::double precision ELSE 0::double precision END,
      agg.mean_s, agg.median_s, agg.std_s, agg.min_s, agg.max_s,
      CASE
        WHEN agg.n = 0 THEN NULL
        WHEN (100.0 * agg.n_prof / agg.n) >= 90 THEN 5
        WHEN (100.0 * agg.n_prof / agg.n) >= 75 THEN 4
        WHEN (100.0 * agg.n_prof / agg.n) >= 60 THEN 3
        WHEN (100.0 * agg.n_prof / agg.n) >= 40 THEN 2
        ELSE 1
      END::bigint,
      CASE
        WHEN agg.n = 0 THEN NULL
        WHEN (100.0 * agg.n_prof / agg.n) < 30 THEN 'Suspensão imediata de ingresso de novos estudantes'
        WHEN (100.0 * agg.n_prof / agg.n) < 40 THEN 'Redução de 50% das vagas autorizadas do curso'
        WHEN (100.0 * agg.n_prof / agg.n) < 50 THEN 'Redução de 25% das vagas autorizadas do curso'
        WHEN (100.0 * agg.n_prof / agg.n) < 60 THEN 'Abertura de processo de supervisão para monitoramento'
        ELSE NULL
      END,
      CASE WHEN agg.n > 0 AND (100.0 * agg.n_prof / agg.n) < 60 THEN true ELSE false END,
      agg.n_below,
      NULL::bigint, NULL::bigint, NULL::double precision
    FROM agg;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_institutional_tri(uuid, uuid, integer[], integer) TO authenticated;