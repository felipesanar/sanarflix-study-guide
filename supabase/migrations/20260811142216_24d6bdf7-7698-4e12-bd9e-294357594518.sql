DO $mig$
DECLARE
  d text;
  antes text;
BEGIN
  -- 1) get_gestor_visao_geral: expõe proficientesPct na evolução + corte 50
  SELECT pg_get_functiondef(p.oid) INTO d
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_gestor_visao_geral';
  IF d IS NULL THEN RAISE EXCEPTION 'get_gestor_visao_geral não encontrada'; END IF;
  antes := d;
  d := replace(d,
    '''participantes'', GREATEST(m.n_tri, m.n_resp)',
    '''proficientesPct'', m.prof_pct,
                 ''participantes'', GREATEST(m.n_tri, m.n_resp)');
  d := replace(d, 'acerto_pct <  30 THEN ''critico''', 'acerto_pct <  50 THEN ''critico''');
  d := replace(d, 't.acerto_pct < 30', 't.acerto_pct < 50');
  d := replace(d, 'crítico < 30, mediano 30–80', 'crítico < 50, mediano 50–80');
  IF d = antes THEN RAISE EXCEPTION 'nenhuma substituição aplicada em get_gestor_visao_geral'; END IF;
  IF position('''proficientesPct''' in d) = 0
     OR position('acerto_pct <  50' in d) = 0
     OR position('t.acerto_pct < 50' in d) = 0
     OR position('crítico < 50, mediano 50–80' in d) = 0 THEN
    RAISE EXCEPTION 'substituição incompleta em get_gestor_visao_geral';
  END IF;
  EXECUTE d;

  -- 2) get_gestor_diagnostico: corte 50
  SELECT pg_get_functiondef(p.oid) INTO d
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_gestor_diagnostico';
  IF d IS NULL THEN RAISE EXCEPTION 'get_gestor_diagnostico não encontrada'; END IF;
  antes := d;
  d := replace(d, 'acerto_pct <  30 THEN ''critico''', 'acerto_pct <  50 THEN ''critico''');
  d := replace(d, 'crítico < 30, mediano 30–80', 'crítico < 50, mediano 50–80');
  IF d = antes THEN RAISE EXCEPTION 'nenhuma substituição aplicada em get_gestor_diagnostico'; END IF;
  EXECUTE d;

  -- 3) get_gestor_detalhamento_temas: corte 50
  SELECT pg_get_functiondef(p.oid) INTO d
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_gestor_detalhamento_temas';
  IF d IS NULL THEN RAISE EXCEPTION 'get_gestor_detalhamento_temas não encontrada'; END IF;
  antes := d;
  d := replace(d, 'acerto_pct <  30 THEN ''critico''', 'acerto_pct <  50 THEN ''critico''');
  d := replace(d, 'crítico < 30, mediano 30–80', 'crítico < 50, mediano 50–80');
  IF d = antes THEN RAISE EXCEPTION 'nenhuma substituição aplicada em get_gestor_detalhamento_temas'; END IF;
  EXECUTE d;
END
$mig$;