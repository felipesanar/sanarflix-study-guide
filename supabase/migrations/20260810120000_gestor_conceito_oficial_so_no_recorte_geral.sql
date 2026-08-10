-- Restaura o gate `v_geral` na FONTE do Conceito ENAMED de
-- get_gestor_visao_geral.
--
-- O QUE QUEBROU
-- ------------
-- A migration 20260809230000_gestor_visao_geral_conceito_unificado_e_populacao.sql
-- ("conceito unificado") reescreveu o CASE de `metricas.concept` e, no
-- caminho, DERRUBOU o `v_geral AND` da primeira condicao:
--
--     CASE
--       WHEN EXISTS (SELECT 1 FROM ies_tri it WHERE it.pai_id = p.id)   <-- sem v_geral
--         THEN (SELECT it.concept FROM ies_tri it WHERE it.pai_id = p.id)
--       WHEN p.n_tri = 0 THEN NULL
--       ...
--
-- O comentario imediatamente acima desse CASE continua descrevendo a regra
-- de 07/08 ("v_geral -> resultados_ies_tri.concept; demais -> derivado do %
-- de proficientes DO RECORTE") -- o texto sobreviveu, a condicao nao. E o
-- tipo de regressao que passa despercebida justamente porque o comentario
-- ainda afirma o comportamento certo.
--
-- Efeito: `resultados_ies_tri` guarda o consolidado da IES INTEIRA (todos os
-- semestres, uma linha por simulado). Como a FUNEPE tem linha para todos os
-- seus simulados, esse numero passou a vencer em TODO recorte -- o filtro de
-- semestre voltou a nao surtir efeito no conceito, exatamente o bug que
-- 20260807200000_gestor_recorte_6ano_e_conceito_geral.sql tinha fechado.
--
-- Medido na FUNEPE (3e51663e-8766-4881-bfd1-0921678ed014), simulado de 27/07,
-- recorte "6º ano (Padrão)":
--   exibido hoje  -> conceito 1  (o consolidado IES-wide, 37% de proficientes)
--   correto       -> conceito 2  (50% de proficientes entre os 52 alunos de 11º/12º)
-- O KPI vizinho "Alunos proficientes" JA mostra 50% no mesmo recorte -- ou
-- seja, os dois cartoes lado a lado discordavam sobre a mesma populacao.
--
-- Por que so a Visao Geral: get_gestor_detalhamento nunca teve esse CASE
-- unificado e por isso continuou correta o tempo todo (conferido pelo Joao na
-- tela de Detalhamento por Simulados).
--
-- A REGRA (Joao, 07/08, reafirmada em 10/08)
-- ------------------------------------------
--   'geral'          -> conceito vem de resultados_ies_tri.concept (oficial).
--   '6ano' / '1'..'12' -> conceito derivado do % de proficientes DO RECORTE.
--
-- O conceito oficial e uma medida da INSTITUICAO INTEIRA. Ele nao existe para
-- uma subpopulacao: nao ha "conceito oficial do 6º ano". Entao em recorte
-- parcial a unica resposta honesta e a derivada -- e e por isso que `origem`
-- passa a ser 'estimado' ali, o que faz o selo do cartao
-- (`kpi-enamed-origem-estimado`, KpisVisaoGeral.tsx) aparecer dizendo "Nota
-- oficial nao disponivel para este recorte". Esse texto ja estava escrito e
-- agora fica verdadeiro nos dois sentidos.
--
-- FORMA DA MIGRATION
-- ------------------
-- Patch textual guardado sobre a definicao VIVA, nao CREATE OR REPLACE: a
-- mudanca sao DUAS condicoes dentro da CTE `metricas`, e recolar as ~700
-- linhas da funcao para trocar duas linhas e como se perde o resto (foi assim
-- que o `v_geral` sumiu). O DO abaixo le pg_get_functiondef, troca os dois
-- trechos exatos e ABORTA se cada um nao aparecer exatamente uma vez.
--
-- Idempotencia: rodar de novo aborta com 'conceito_gate_alvo_nao_encontrado'
-- (os trechos antigos ja nao existem). Proposital -- e sinal, nao erro a ser
-- engolido.
DO $patch$
DECLARE
  v_oid   oid;
  v_qtd   int;
  v_def   text;
  v_novo  text;
  v_a1    text;
  v_t1    text;
  v_a2    text;
  v_t2    text;
  v_conta int;
BEGIN
  SELECT count(*), min(p.oid) INTO v_qtd, v_oid
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_gestor_visao_geral';

  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'conceito_gate_funcao_ausente';
  END IF;
  IF v_qtd > 1 THEN
    RAISE EXCEPTION 'conceito_gate_funcao_sobrecarregada: % assinaturas', v_qtd;
  END IF;

  v_def := pg_get_functiondef(v_oid);

  -- (1) A fonte do conceito volta a depender do recorte.
  v_a1 := 'WHEN EXISTS (SELECT 1 FROM ies_tri it WHERE it.pai_id = p.id)';
  v_t1 := 'WHEN v_geral AND EXISTS (SELECT 1 FROM ies_tri it WHERE it.pai_id = p.id)';

  -- (2) `origem` tem que contar a MESMA historia que o valor: 'oficial' so
  --     quando foi de fato a fonte oficial que alimentou o numero exibido.
  v_a2 := 'EXISTS (SELECT 1 FROM ies_tri it WHERE it.pai_id = p.id) AS concept_oficial';
  v_t2 := '(v_geral AND EXISTS (SELECT 1 FROM ies_tri it WHERE it.pai_id = p.id)) AS concept_oficial';

  -- Ordem importa: v_a2 CONTEM v_a1 como prefixo. Trocando (2) primeiro, o
  -- texto resultante deixa de casar com v_a1 naquela linha, e a troca (1)
  -- atinge so a condicao do CASE -- que e o alvo dela.
  v_conta := (length(v_def) - length(replace(v_def, v_a2, ''))) / length(v_a2);
  IF v_conta <> 1 THEN
    RAISE EXCEPTION 'conceito_gate_alvo_nao_encontrado (concept_oficial): % ocorrencias', v_conta;
  END IF;
  v_novo := replace(v_def, v_a2, v_t2);

  v_conta := (length(v_novo) - length(replace(v_novo, v_a1, ''))) / length(v_a1);
  IF v_conta <> 1 THEN
    RAISE EXCEPTION 'conceito_gate_alvo_nao_encontrado (CASE do concept): % ocorrencias', v_conta;
  END IF;
  v_novo := replace(v_novo, v_a1, v_t1);

  IF v_novo = v_def THEN
    RAISE EXCEPTION 'conceito_gate_patch_sem_efeito';
  END IF;

  EXECUTE v_novo;
  RAISE NOTICE 'conceito ENAMED: fonte oficial reservada ao recorte Geral';
END
$patch$;
