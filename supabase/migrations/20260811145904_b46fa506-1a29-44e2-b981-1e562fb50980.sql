DO $do$
DECLARE
  v_def text;
  v_old text := '''participantes'',     GREATEST(m.n_resp, m.n_tri),';
  v_new text := '''participantes'',     GREATEST(m.n_resp, m.n_tri),
                 ''proficientesPct'',   CASE WHEN m.n_tri > 0 THEN round(100.0 * m.n_prof / m.n_tri, 0) END,';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_gestor_detalhamento';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'get_gestor_detalhamento nao encontrada';
  END IF;

  IF position('proficientesPct' in v_def) > 0 THEN
    RAISE NOTICE 'proficientesPct ja presente, nada a fazer';
    RETURN;
  END IF;

  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'ancora de patch nao encontrada em get_gestor_detalhamento';
  END IF;

  EXECUTE replace(v_def, v_old, v_new);
END
$do$;