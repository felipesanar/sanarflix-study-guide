
-- Helper: institutional TRI snapshot for a given simulado + IES
CREATE OR REPLACE FUNCTION public.get_institutional_tri(
  p_simulado_id uuid,
  p_ies_id uuid DEFAULT NULL
)
RETURNS TABLE (
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
  is_restricted boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_ies uuid;
  v_user_ies uuid;
BEGIN
  -- Resolve target IES
  IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'b2b_partner'::app_role) THEN
    v_target_ies := COALESCE(p_ies_id, get_current_user_ies_id());
  ELSIF has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'professor'::app_role) THEN
    v_user_ies := get_current_user_ies_id();
    IF p_ies_id IS NOT NULL AND p_ies_id <> v_user_ies THEN
      RAISE EXCEPTION 'Permission denied: cannot access other IES';
    END IF;
    v_target_ies := v_user_ies;
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF v_target_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  RETURN QUERY
  SELECT
    r.college_id,
    r.simulado_id,
    r.num_students,
    r.num_proficient,
    r.pcp,
    r.mean_score,
    r.median_score,
    r.std_score,
    r.min_score,
    r.max_score,
    r.concept,
    r.sanctions,
    r.is_restricted
  FROM public.resultados_ies_tri r
  WHERE r.college_id = v_target_ies
    AND r.simulado_id = p_simulado_id;
END;
$$;

-- Evolution: all simulados available for the IES, ordered by simulado release date
CREATE OR REPLACE FUNCTION public.get_institutional_evolution_tri(
  p_ies_id uuid DEFAULT NULL
)
RETURNS TABLE (
  simulado_id uuid,
  simulado_nome text,
  data_liberacao timestamptz,
  num_students bigint,
  mean_score double precision,
  pcp double precision,
  concept bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_ies uuid;
  v_user_ies uuid;
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'b2b_partner'::app_role) THEN
    v_target_ies := COALESCE(p_ies_id, get_current_user_ies_id());
  ELSIF has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'professor'::app_role) THEN
    v_user_ies := get_current_user_ies_id();
    IF p_ies_id IS NOT NULL AND p_ies_id <> v_user_ies THEN
      RAISE EXCEPTION 'Permission denied: cannot access other IES';
    END IF;
    v_target_ies := v_user_ies;
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF v_target_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  RETURN QUERY
  SELECT
    r.simulado_id,
    s.nome AS simulado_nome,
    s.data_liberacao,
    r.num_students,
    r.mean_score,
    r.pcp,
    r.concept
  FROM public.resultados_ies_tri r
  JOIN public.simulados_admin s ON s.id = r.simulado_id
  WHERE r.college_id = v_target_ies
  ORDER BY s.data_liberacao NULLS LAST, s.nome;
END;
$$;
