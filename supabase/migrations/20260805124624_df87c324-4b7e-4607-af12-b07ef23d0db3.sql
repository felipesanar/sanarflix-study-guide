CREATE OR REPLACE FUNCTION public.tmp_exec_sql_l2(p_sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  EXECUTE p_sql;
END;
$$;

REVOKE ALL ON FUNCTION public.tmp_exec_sql_l2(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tmp_exec_sql_l2(text) TO service_role;