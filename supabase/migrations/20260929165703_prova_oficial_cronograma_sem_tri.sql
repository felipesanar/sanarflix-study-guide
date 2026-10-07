-- Exceção para a prova oficial no cronograma do gestor: vira 'realizado' (selecionável no
-- Detalhamento/Questões) assim que tiver participantes, sem esperar resultados_ies_tri.
-- Demais simulados seguem exigindo TRI. Proficiência/conceito continuam nulos até o TRI.
-- Reescrita server-side da definição viva (âncora exata), com backup em function_def_backups.
-- Obs.: não é reexecutável num banco novo.
DO $mig$
DECLARE v_oid oid := 'public.get_gestor_cronograma(uuid)'::regprocedure; d text; n int;
  a text := E'                  AND EXISTS (SELECT 1 FROM com_tri c WHERE c.pai_id = s.id)\n               THEN ''realizado''';
  r text := E'                  AND (EXISTS (SELECT 1 FROM com_tri c WHERE c.pai_id = s.id)\n                       OR (COALESCE(p.n, 0) > 0 AND EXISTS (SELECT 1 FROM public.simulados_admin so WHERE so.id = s.id AND so.prova_oficial)))\n               THEN ''realizado''';
BEGIN
  d := pg_get_functiondef(v_oid);
  IF position(r IN d) > 0 THEN RAISE NOTICE 'já aplicado'; RETURN; END IF;
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'anchor count % (esperado 1)', n; END IF;
  INSERT INTO public.function_def_backups (fn_oid, fn_signature, reason, def) VALUES (v_oid, v_oid::regprocedure::text, 'prova_oficial_cronograma_sem_tri', d);
  EXECUTE replace(d, a, r);
END $mig$;
