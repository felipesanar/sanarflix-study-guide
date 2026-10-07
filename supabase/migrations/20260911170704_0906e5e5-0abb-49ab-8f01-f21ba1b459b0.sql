DO $mig$
DECLARE
  v_src text;
  v_new text;
BEGIN
  SELECT p.prosrc INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_gestor_detalhamento'
    AND pg_get_function_identity_arguments(p.oid) = 'p_ies_id uuid, p_semestre text, p_simulados uuid[]';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'get_gestor_detalhamento nao encontrada';
  END IF;

  v_new := replace(
    v_src,
    E'  semestres AS (\n    SELECT r.semestre,\n           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos\n    FROM respostas r WHERE r.semestre IS NOT NULL GROUP BY r.semestre\n  ),',
    E'  semestres AS (\n    SELECT r.semestre,\n           count(DISTINCT r.user_id) AS n_alunos,\n           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos\n    FROM respostas r WHERE r.semestre IS NOT NULL GROUP BY r.semestre\n  ),'
  );
  IF v_new = v_src THEN
    RAISE EXCEPTION 'CTE semestres nao casou';
  END IF;
  v_src := v_new;

  v_new := replace(
    v_src,
    E'                   \'emEvidencia\', COALESCE(s.semestre = ANY (v_evid), false)\n',
    E'                   \'emEvidencia\', COALESCE(s.semestre = ANY (v_evid), false),\n                   \'alunos\',      s.n_alunos\n'
  );
  IF v_new = v_src THEN
    RAISE EXCEPTION 'chave emEvidencia nao casou';
  END IF;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.get_gestor_detalhamento(p_ies_id uuid, p_semestre text, p_simulados uuid[]) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''public'' AS %L',
    v_new
  );

  REVOKE ALL ON FUNCTION public.get_gestor_detalhamento(uuid, text, uuid[]) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.get_gestor_detalhamento(uuid, text, uuid[]) TO authenticated, service_role;
END
$mig$;