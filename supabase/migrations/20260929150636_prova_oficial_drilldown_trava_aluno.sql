-- get_questions_by_subspecialty (drill-down Área → Especialidade → Tema do Desempenho do aluno)
-- devolvia questões da prova oficial (gabarito, resposta, comentário) na visão "Todos"
-- (p_simulado_id NULL) e pelo caminho explícito, sem trava de liberação do aluno.
-- Agora: na visão "Todos" a prova oficial nunca entra; no caminho explícito só com
-- prova_oficial_liberada_aluno = true. Reescrita server-side da definição viva, com backup.
-- Obs.: depende do corpo vivo em prod (âncora exata); não é reexecutável num banco novo.
DO $mig$
DECLARE v_oid oid := 'public.get_questions_by_subspecialty(text,uuid,text,text)'::regprocedure; d text; n int;
  a text := E'    and (p_simulado_id is null or q.simulado_id = p_simulado_id)\n  limit 10;';
  r text := E'    and (p_simulado_id is null or q.simulado_id = p_simulado_id)\n    and not exists (select 1 from public.simulados_admin sa where sa.id = q.simulado_id and sa.prova_oficial and (p_simulado_id is null or not sa.prova_oficial_liberada_aluno))\n  limit 10;';
BEGIN
  d := pg_get_functiondef(v_oid);
  IF position(r IN d) > 0 THEN RAISE NOTICE 'já aplicado'; RETURN; END IF;
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'anchor count % (esperado 1)', n; END IF;
  INSERT INTO public.function_def_backups (fn_oid, fn_signature, reason, def) VALUES (v_oid, v_oid::regprocedure::text, 'prova_oficial_drilldown_trava_aluno', d);
  EXECUTE replace(d, a, r);
END $mig$;
