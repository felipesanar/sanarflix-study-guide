CREATE OR REPLACE FUNCTION public.admin_lookup_users_by_ra_in_ies(p_ies_ids uuid[], p_ras text[])
RETURNS TABLE(ra text, user_id uuid, nome text, email text, id_ies uuid, semestre integer, match_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH input AS (SELECT DISTINCT lower(trim(x)) AS ra FROM unnest(p_ras) x WHERE trim(coalesce(x,'')) <> ''),
  m AS (
    SELECT i.ra, u.id, u.nome, u.email, u.id_ies, u.semestre,
           count(*) OVER (PARTITION BY i.ra)::int AS c
    FROM input i JOIN public.users u
      ON lower(trim(u.matricula_ra)) = i.ra AND u.id_ies = ANY(p_ies_ids)
  )
  SELECT m.ra, m.id, m.nome, m.email, m.id_ies, m.semestre, m.c FROM m;
END $$;
REVOKE ALL ON FUNCTION public.admin_lookup_users_by_ra_in_ies(uuid[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_lookup_users_by_ra_in_ies(uuid[], text[]) TO authenticated, service_role;