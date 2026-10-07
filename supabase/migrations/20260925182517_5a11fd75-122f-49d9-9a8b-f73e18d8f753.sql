DO $mig$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.admin_import_responses_batch(uuid,uuid,jsonb,text)'::regprocedure);
  n := replace(d, 'IF NOT public.has_role(auth.uid(), ''admin'') THEN',
                  'IF NOT (auth.role() = ''service_role'' OR public.has_role(auth.uid(), ''admin'')) THEN');
  IF n = d THEN RAISE EXCEPTION 'guard not found'; END IF;
  EXECUTE n;
END $mig$;
GRANT EXECUTE ON FUNCTION public.admin_list_import_batches(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_batch_records(uuid) TO authenticated;