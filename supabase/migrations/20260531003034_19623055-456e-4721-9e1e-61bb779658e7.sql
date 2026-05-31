
CREATE OR REPLACE FUNCTION public.get_simulados_questoes_count(p_simulado_ids uuid[])
RETURNS TABLE(simulado_id uuid, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT q.simulado_id, count(*)::bigint AS total
  FROM public.questoes_simulado q
  WHERE q.simulado_id = ANY(p_simulado_ids)
  GROUP BY q.simulado_id;
$$;

REVOKE ALL ON FUNCTION public.get_simulados_questoes_count(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_simulados_questoes_count(uuid[]) TO authenticated, service_role;
