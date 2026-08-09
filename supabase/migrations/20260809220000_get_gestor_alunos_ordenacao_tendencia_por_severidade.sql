-- Corrige bug confirmado por auditoria (2026-08-09): ORDER BY tendencia em
-- get_gestor_alunos ordenava a string alfabeticamente ('alternando' < 'descendo'
-- < 'estavel' < 'subindo'), sem relacao com severidade de negocio. Rank aprovado
-- pelo produto: descendo (pior) < alternando < estavel < subindo (melhor).
--
-- Patch textual, nao CREATE OR REPLACE de corpo fixo, pelo mesmo motivo
-- documentado em 20260807194927_gestor_recorte_6ano_semestres_11_12_rpcs_secundarias.sql:
-- o Lovable empurra codigo pra producao varias vezes ao dia, entao colar o corpo
-- inteiro arrisca reverter em silencio uma mudanca concorrente. Le a definicao
-- VIVA, troca as duas linhas exatas do ORDER BY e reexecuta.
--
-- Aplicado em produção (gvqvrmkizemwsasmupmo) em 2026-08-09 via apply_migration,
-- confirmado com sucesso (patch_presente = true, 2 ocorrências do CASE novo).
DO $patch$
DECLARE
  v_qtd    int;
  v_oid    oid;
  v_def    text;
  v_novo   text;
  v_alvo1  text := 'CASE WHEN v_sort=''tendencia''    AND v_order=''asc''  THEN l.tendencia   END ASC,';
  v_troca1 text := 'CASE WHEN v_sort=''tendencia''    AND v_order=''asc''  THEN CASE l.tendencia WHEN ''descendo'' THEN 1 WHEN ''alternando'' THEN 2 WHEN ''estavel'' THEN 3 WHEN ''subindo'' THEN 4 END END ASC,';
  v_alvo2  text := 'CASE WHEN v_sort=''tendencia''    AND v_order=''desc'' THEN l.tendencia   END DESC,';
  v_troca2 text := 'CASE WHEN v_sort=''tendencia''    AND v_order=''desc'' THEN CASE l.tendencia WHEN ''descendo'' THEN 1 WHEN ''alternando'' THEN 2 WHEN ''estavel'' THEN 3 WHEN ''subindo'' THEN 4 END END DESC,';
BEGIN
  SELECT count(*), min(p.oid) INTO v_qtd, v_oid
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_gestor_alunos';

  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'tendencia_rank_funcao_ausente: get_gestor_alunos';
  END IF;
  IF v_qtd > 1 THEN
    RAISE EXCEPTION 'tendencia_rank_funcao_sobrecarregada: get_gestor_alunos (% assinaturas)', v_qtd;
  END IF;

  v_def := pg_get_functiondef(v_oid);

  IF position(v_alvo1 IN v_def) = 0 OR position(v_alvo2 IN v_def) = 0 THEN
    RAISE EXCEPTION 'tendencia_rank_alvo_nao_encontrado';
  END IF;
  IF (length(v_def) - length(replace(v_def, v_alvo1, ''))) / length(v_alvo1) <> 1 THEN
    RAISE EXCEPTION 'tendencia_rank_alvo1_ambiguo';
  END IF;
  IF (length(v_def) - length(replace(v_def, v_alvo2, ''))) / length(v_alvo2) <> 1 THEN
    RAISE EXCEPTION 'tendencia_rank_alvo2_ambiguo';
  END IF;

  v_novo := replace(replace(v_def, v_alvo1, v_troca1), v_alvo2, v_troca2);
  IF v_novo = v_def THEN
    RAISE EXCEPTION 'tendencia_rank_patch_sem_efeito';
  END IF;

  EXECUTE v_novo;
  RAISE NOTICE 'ordenacao de tendencia corrigida em get_gestor_alunos';
END
$patch$;
