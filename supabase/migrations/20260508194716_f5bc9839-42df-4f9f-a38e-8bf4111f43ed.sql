-- =========================================================
-- Fase 4 TRI — Materialized view + RPCs longitudinais
-- Aditiva. Não altera tabelas existentes. Não apaga dados.
-- =========================================================

-- 1. Materialized view de evolução institucional
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_evolucao_institucional_tri AS
SELECT
  rit.college_id,
  rit.simulado_id,
  sa.nome AS simulado_nome,
  sa.data_liberacao,
  rit.mean_score,
  rit.median_score,
  rit.std_score,
  rit.pcp,
  rit.num_students,
  rit.num_proficient,
  rit.concept,
  rit.sanctions,
  rit.is_restricted
FROM public.resultados_ies_tri rit
LEFT JOIN public.simulados_admin sa ON sa.id = rit.simulado_id;

-- Índice único para permitir REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS mv_evolucao_institucional_tri_pk
  ON public.mv_evolucao_institucional_tri (college_id, simulado_id);

CREATE INDEX IF NOT EXISTS mv_evolucao_institucional_tri_ies_data_idx
  ON public.mv_evolucao_institucional_tri (college_id, data_liberacao);

-- 2. Função de refresh
CREATE OR REPLACE FUNCTION public.refresh_mv_evolucao_institucional_tri()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_evolucao_institucional_tri;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_mv_evolucao_institucional_tri() FROM public;
GRANT EXECUTE ON FUNCTION public.refresh_mv_evolucao_institucional_tri() TO service_role;

-- 3. RPC get_institutional_longitudinal_tri — série temporal com deltas
CREATE OR REPLACE FUNCTION public.get_institutional_longitudinal_tri(p_ies_id uuid DEFAULT NULL)
RETURNS TABLE (
  simulado_id uuid,
  simulado_nome text,
  data_liberacao timestamptz,
  mean_score double precision,
  pcp double precision,
  concept bigint,
  sanctions text,
  num_students bigint,
  delta_mean_score double precision,
  delta_pcp double precision,
  delta_concept bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_ies uuid;
BEGIN
  v_target_ies := COALESCE(p_ies_id, public.get_current_user_ies_id());

  IF v_target_ies IS NULL THEN
    RAISE EXCEPTION 'IES não informada e usuário sem IES vinculada';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'b2b_partner'::app_role)
    OR (
      (public.has_role(auth.uid(), 'gestor'::app_role) OR public.has_role(auth.uid(), 'professor'::app_role))
      AND public.get_current_user_ies_id() = v_target_ies
    )
  ) THEN
    RAISE EXCEPTION 'Permissão negada para a IES informada';
  END IF;

  RETURN QUERY
  WITH ordered AS (
    SELECT
      mv.simulado_id,
      mv.simulado_nome,
      mv.data_liberacao,
      mv.mean_score,
      mv.pcp,
      mv.concept,
      mv.sanctions,
      mv.num_students,
      LAG(mv.mean_score) OVER w AS prev_mean_score,
      LAG(mv.pcp) OVER w AS prev_pcp,
      LAG(mv.concept) OVER w AS prev_concept
    FROM public.mv_evolucao_institucional_tri mv
    WHERE mv.college_id = v_target_ies
    WINDOW w AS (ORDER BY mv.data_liberacao NULLS LAST, mv.simulado_id)
  )
  SELECT
    o.simulado_id,
    o.simulado_nome,
    o.data_liberacao,
    o.mean_score,
    o.pcp,
    o.concept,
    o.sanctions,
    o.num_students,
    (o.mean_score - o.prev_mean_score) AS delta_mean_score,
    (o.pcp - o.prev_pcp) AS delta_pcp,
    (o.concept - o.prev_concept) AS delta_concept
  FROM ordered o
  ORDER BY o.data_liberacao NULLS LAST, o.simulado_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_institutional_longitudinal_tri(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_institutional_longitudinal_tri(uuid) TO authenticated;

-- 4. RPC get_student_growth_tri — variação de theta por aluno
CREATE OR REPLACE FUNCTION public.get_student_growth_tri(p_ies_id uuid DEFAULT NULL)
RETURNS TABLE (
  student_id uuid,
  num_simulados bigint,
  first_theta double precision,
  last_theta double precision,
  delta_theta double precision,
  first_score_enamed double precision,
  last_score_enamed double precision,
  delta_score_enamed double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_ies uuid;
BEGIN
  v_target_ies := COALESCE(p_ies_id, public.get_current_user_ies_id());

  IF v_target_ies IS NULL THEN
    RAISE EXCEPTION 'IES não informada e usuário sem IES vinculada';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'b2b_partner'::app_role)
    OR (
      (public.has_role(auth.uid(), 'gestor'::app_role) OR public.has_role(auth.uid(), 'professor'::app_role))
      AND public.get_current_user_ies_id() = v_target_ies
    )
  ) THEN
    RAISE EXCEPTION 'Permissão negada para a IES informada';
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      r.student_id,
      r.theta,
      r.score_enamed,
      sa.data_liberacao,
      ROW_NUMBER() OVER (PARTITION BY r.student_id ORDER BY sa.data_liberacao NULLS LAST, r.simulado_id) AS rn_first,
      ROW_NUMBER() OVER (PARTITION BY r.student_id ORDER BY sa.data_liberacao DESC NULLS LAST, r.simulado_id DESC) AS rn_last,
      COUNT(*) OVER (PARTITION BY r.student_id) AS n
    FROM public.resultados_alunos_tri r
    LEFT JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_target_ies
  ),
  firsts AS (
    SELECT student_id, theta AS first_theta, score_enamed AS first_score_enamed, n
    FROM ranked WHERE rn_first = 1
  ),
  lasts AS (
    SELECT student_id, theta AS last_theta, score_enamed AS last_score_enamed
    FROM ranked WHERE rn_last = 1
  )
  SELECT
    f.student_id,
    f.n AS num_simulados,
    f.first_theta,
    l.last_theta,
    (l.last_theta - f.first_theta) AS delta_theta,
    f.first_score_enamed,
    l.last_score_enamed,
    (l.last_score_enamed - f.first_score_enamed) AS delta_score_enamed
  FROM firsts f
  JOIN lasts l USING (student_id)
  ORDER BY (l.last_theta - f.first_theta) DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_growth_tri(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_student_growth_tri(uuid) TO authenticated;

-- 5. Refresh inicial da MV (popula com dados existentes)
REFRESH MATERIALIZED VIEW public.mv_evolucao_institucional_tri;