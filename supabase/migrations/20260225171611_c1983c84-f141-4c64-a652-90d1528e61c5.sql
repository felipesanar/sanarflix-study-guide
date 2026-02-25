CREATE OR REPLACE FUNCTION public.get_distinct_semestres(p_ies_id uuid)
RETURNS TABLE(semestre text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT c.semestre
  FROM public.conteudos c
  WHERE c.id_ies = p_ies_id
  ORDER BY c.semestre;
$$;