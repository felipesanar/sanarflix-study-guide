-- Fecha o caminho explícito de get_user_performance_aggregates para a prova oficial:
-- o predicado de liberação anterior tinha um OR (liberacao_desempenho='imediato') que
-- reabria a prova para o aluno assim que o gestor era liberado. A exclusão agora vale
-- para qualquer caminho enquanto prova_oficial_liberada_aluno = false.
-- Reescrita server-side a partir da definição viva, com backup em function_def_backups.
-- Obs.: depende do corpo vivo em prod (âncora exata); não é reexecutável num banco novo
-- sem as migrations anteriores de prova_oficial aplicadas sobre o mesmo corpo.
DO $mig$
DECLARE v_oid oid := 'public.get_user_performance_aggregates(uuid)'::regprocedure; d text; n int;
  a text := E'      AND ((p_simulado_id IS NULL AND NOT sa.prova_oficial) OR ap.simulado = p_simulado_id)';
  r text := E'      AND ((p_simulado_id IS NULL AND NOT sa.prova_oficial) OR ap.simulado = p_simulado_id)\n      AND NOT (sa.prova_oficial AND NOT sa.prova_oficial_liberada_aluno)';
BEGIN
  d := pg_get_functiondef(v_oid);
  IF position(r IN d) > 0 THEN RAISE NOTICE 'já aplicado'; RETURN; END IF;
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'anchor count % (esperado 1)', n; END IF;
  INSERT INTO public.function_def_backups (fn_oid, fn_signature, reason, def) VALUES (v_oid, v_oid::regprocedure::text, 'prova_oficial_agregados_trava_aluno', d);
  EXECUTE replace(d, a, r);
END $mig$;

-- Helper usado na RLS de resultados_alunos_tri: só authenticated/service_role precisam executar.
REVOKE ALL ON FUNCTION public.is_simulado_prova_oficial(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_simulado_prova_oficial(uuid) TO authenticated, service_role;
