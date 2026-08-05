-- 20260804173000_get_gestor_visao_geral_multicontrato_dedup_nivel.sql
--
-- SUCEDE 20260804130000_get_gestor_visao_geral_guard_kpi_lowsample.sql. NAO edita aquele
-- arquivo.
--
-- POR QUE UMA MIGRATION NOVA E NAO UMA EDICAO
-- -------------------------------------------
-- As migrations de 04/08 JA FORAM APLICADAS EM PRODUCAO (gvqv, 04/08 16:11). O Supabase
-- registra migration aplicada pelo PREFIXO da versao: editar o conteudo de um arquivo ja
-- aplicado faz o conteudo novo NUNCA rodar, em silencio -- a correcao ficaria no repo com
-- cara de pronta e jamais chegaria ao produto. Toda correcao posterior nasce em arquivo
-- novo, com timestamp posterior a 20260804150000. Sem excecao.
--
-- OS GAPS QUE ESTA MIGRATION FECHA
-- --------------------------------
-- Uma verificacao independente das 21 correcoes de 04/08 leu cada uma contra o criterio do
-- card Notion correspondente e achou, para get_gestor_visao_geral, 3 achados INCOMPLETOS
-- (a correcao andou, a causa raiz ficou) mais 1 achado NOVO (card Ordem 119, autorizacao
-- por papel):
--
-- (A) ACHADO 15 / CARD ORDEM 119 -- autorizacao por IES ainda usava user_can_access_ies,
--     que autoriza um 'gestor' puro para a IES de QUALQUER grupo em que ele tenha ficado
--     com linha orfa em user_groups (residuo de downgrade gestor_grupo -> gestor, que a UI
--     de admin permite hoje sem limpar user_groups). Substituido por
--     public.gestor_pode_acessar_ies(v_ies) -- funcao nova e aditiva de
--     20260804160000_gestor_pode_acessar_ies.sql, que para 'gestor' autoriza SOMENTE
--     users.id_ies, nunca get_accessible_ies. Ver o cabecalho daquele arquivo para a prova
--     completa do gap e a tabela de coerencia com podeTrocarIes/iesDisponiveis.
--
--     O guard de autorizacao sai de DENTRO do `IF p_ies_id IS NOT NULL` (so cobria aquele
--     ramo) e vai para DEPOIS da resolucao de v_ies, autorizando o valor que a query vai de
--     fato usar -- o ramo ELSE (sem p_ies_id) cai em (get_accessible_ies(v_uid))[1], que
--     para o MESMO gestor puro com user_groups orfao vazava pela outra porta, sem
--     p_ies_id nenhum. Ordem final do preambulo (identica as outras 9 RPCs que consomem o
--     mesmo helper): papel (Access denied) -> resolucao de v_ies -> IES not resolved ->
--     autorizacao (Permission denied: cannot access this IES) -> feature
--     (feature_not_enabled). E SUBSTITUICAO, nao adicao: a chamada a
--     public.user_can_access_ies sai desta funcao (justificativa completa, com a prova de
--     subconjunto por papel, no cabecalho de 20260804160000). user_can_access_ies em si nao
--     e alterada e continua servindo o console legado.
--
-- (B) GAP 109 / CARD ORDEM 109 -- "IES com dois contratos vigentes (4+3 slots) tem 7 linhas
--     no cronograma e denominador 4 (ou 3) no KPI -- o LIMIT 1 permanece e o kpi_slots
--     ainda exclui os slots dos outros contratos, entao os dois numeros do mesmo produto
--     seguem discordando." MECANISMO: `kpi_contrato` escolhia UM contrato (vigente hoje,
--     ou o mais recente encerrado) via `ORDER BY ... DESC LIMIT 1`, e `kpi_slots` so via os
--     slots daquele contrato. get_gestor_cronograma (migration 20260804140100, a fonte da
--     verdade deste numero) lista os slots de TODOS os contratos da IES sem escolher um so.
--     CORRECAO: soma os slots de TODOS os contratos VIGENTES hoje (nao so o "melhor"); sem
--     nenhum vigente, cai no fallback anterior (contrato mais recentemente encerrado), para
--     nao regressar o caso de IES sem contrato ativo.
--
-- (C) GAP 112 / CARD ORDEM 112 -- "o mesmo aluno no mesmo simulado sai com avg() na tabela e
--     max() no drawer quando ha 2+ linhas de TRI para filhos do mesmo pai -- a causa raiz
--     (nenhuma CTE unica de 1 linha por (student_id, pai_id) com criterio de desempate) nao
--     foi feita." MECANISMO: resultados_alunos_tri e (student_id, simulado_id); um "pai"
--     pode ter 2+ "filhos" (simulados-irmaos, mesmo simulado_pai_id), e o mesmo aluno pode
--     ter uma linha de TRI por filho. `count(DISTINCT student_id)` (achado 8 da rodada
--     anterior) ja neutralizava a duplicata NA CONTAGEM, mas `avg(score_proprio)`
--     (prof_media) somava as linhas duplicadas do mesmo aluno, e `dispersao` (DISTINCT ON
--     student_id ORDER BY m.ord DESC) escolhia entre elas de forma arbitraria quando o
--     "ord" mais recente do aluno caia num pai_id com 2+ linhas. CORRECAO: uma CTE de dedup
--     (`tri`, sobre a fonte crua renomeada `tri_raw`) com UMA linha por (student_id,
--     pai_id), criterio de desempate EXPLICITO e literal no corpo da funcao (ver bloco
--     "CRITERIO DE DESEMPATE" abaixo) -- consumida por TUDO que hoje le `tri` (contagens,
--     avg, dispersao), fechando a causa raiz numa unica fonte em vez de remendar cada
--     consumidor.
--
-- (D) GAP 117 / CARD ORDEM 117 -- "aplicar a mesma unificacao em get_gestor_visao_geral:
--     areas_nivel.nivel (linhas 256-259) e evolucaoPorArea.critica (linha 401). Hoje o nivel
--     sai de percentual nao arredondado enquanto acertoPct vai arredondado -- o payload se
--     contradiz (30% rotulado critico)." MECANISMO: `nivel` (e `critica`) classificavam
--     sobre o percentual BRUTO (100.0 * acertos / total), enquanto o `acerto_pct` exibido na
--     UI ja saia arredondado (round(...,0)) -- um caso com bruto 29.6% arredondava para 30%
--     na tela mas classificava 'critico' (corte < 30 sobre o bruto). CORRECAO: as duas
--     leituras (areas_nivel.nivel e evolucaoPorArea.critica) passam a classificar sobre o
--     MESMO valor ja arredondado, numa CTE intermediaria (`areas_pct`) compartilhada pelas
--     duas -- consistente com src/features/gestor/lib/regras.ts (nivelDesempenho recebe o
--     acertoPct que a API devolve, ja arredondado).
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv)
-- ----------------------------------------------
-- Rodar os tres readbacks abaixo e comparar com o que este arquivo assume como corpo
-- atualmente em producao. Se QUALQUER um divergir, ABORTAR esta migration e reconciliar
-- manualmente antes de prosseguir -- nao aplicar por cima as cegas:
--
--   (a) esta migration parte do corpo de 20260804130000 como "o que esta em producao agora":
--       SELECT pg_get_functiondef('public.get_gestor_visao_geral(uuid,text)'::regprocedure);
--       -- ESPERADO: identico ao corpo de 20260804130000 (guard user_has_feature_for_ies,
--       -- kpi_slots/kpi_contrato com LIMIT 1, n_prof com count(DISTINCT...) FILTER,
--       -- lowSample olhando so o ponto 'atual'). Qualquer diferenca (outra migration
--       -- aplicada direto em prod, fora do repo) invalida o ponto de partida assumido aqui.
--
--   (b) o helper novo que esta migration passa a consumir nao pode ja existir com outro
--       corpo, e as funcoes de que ele depende tem que bater com o repo:
--       SELECT pg_get_functiondef('public.gestor_pode_acessar_ies(uuid)'::regprocedure);
--       -- ESPERADO: identico ao corpo de 20260804160000_gestor_pode_acessar_ies.sql.
--       SELECT pg_get_functiondef('public.get_accessible_ies(uuid)'::regprocedure);
--       -- ESPERADO: identico a 20260525145930 (UNION users.id_ies + user_groups).
--
--   (c) get_gestor_contexto (a funcao com que a coerencia de podeTrocarIes e afirmada, ver
--       20260804160000) tem que bater com o esperado:
--       SELECT pg_get_functiondef('public.get_gestor_contexto()'::regprocsignature);
--       -- ESPERADO: corpo de 20260804130200 (podeTrocarIes = v_papel IN
--       -- ('admin','gestor_grupo'); ELSE de iesDisponiveis le so users.id_ies). Se
--       -- podeTrocarIes tiver mudado de regra em prod, a tabela de coerencia do helper
--       -- esta invalidada -- PARAR e nao aplicar.
--
-- NADA MAIS MUDOU alem do descrito em (A)-(D): SECURITY DEFINER, SET search_path, STABLE,
-- os guards de papel, o guard de feature via user_has_feature_for_ies (achado 2 da rodada
-- anterior, preservado), os grants e a assinatura (p_ies_id uuid, p_semestre text) seguem
-- integralmente. As correcoes dos achados 5 (KPI vinculado ao contrato -- a ESTRUTURA de
-- kpi_slots/kpi_realizados/kpi_com_tri, so o UNIVERSO de contratos mudou), 8 (n_prof
-- distinto por aluno) e 9 (lowSample no ponto atual) continuam presentes, inalteradas.
CREATE OR REPLACE FUNCTION public.get_gestor_visao_geral(p_ies_id uuid, p_semestre text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_ies      uuid;
  v_sems     int[];
  v_evid     int[];
  v_recorte  text;
  v_criterio text;
  v_result   jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- resolucao de v_ies (ainda NAO autoriza -- ver o IF de gestor_pode_acessar_ies abaixo)
  IF p_ies_id IS NOT NULL THEN
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_uid))[1];
    END IF;
  END IF;
  IF v_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  -- achado 15 / card 119: autorizacao da IES RESOLVIDA, por papel, via
  -- gestor_pode_acessar_ies -- SUBSTITUI a checagem antiga (função de autorização por IES da
  -- rodada de 04/08), que autorizava 'gestor' puro para IES de fora do proprio cadastro
  -- quando havia linha orfa em user_groups (residuo de downgrade gestor_grupo -> gestor).
  -- Ver 20260804160000_gestor_pode_acessar_ies.sql para a prova completa do gap, a regra
  -- por papel e por que o guard fica DEPOIS da resolucao de v_ies (cobre os dois ramos --
  -- p_ies_id explicito E o fallback via get_accessible_ies -- com um unico IF). NAO manter
  -- as duas chamadas: o conjunto autorizado por gestor_pode_acessar_ies e subconjunto do
  -- autorizado pela checagem antiga em todo papel, entao a troca so NEGA casos, nunca
  -- libera um caso hoje negado.
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  -- achado 2 (rodada de 04/08, preservado): guard de feature por IES, DEPOIS de v_ies
  -- resolvido e autorizado (nunca contra p_ies_id, que pode ser NULL aqui).
  IF NOT public.user_has_feature_for_ies('gestao.portal_v2', v_ies) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  -- recorte de semestre: '6ano' => todos, 11 e 12 em evidência; 'geral' => todos; '1'..'12' => só aquele
  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_evid := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_evid := ARRAY[11,12]; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_evid := v_sems;
    v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  v_criterio := format(
    'Proficiência = resultados_alunos_tri.score_proprio (0–100); proficiente >= 60. Desempenho por grande área em %% de acerto (crítico < 30, mediano 30–80, excelente >= 80). Última tentativa por aluno; questão anulada ignorada; usuários com role em user_roles fora do universo de alunos. Conceito ENAMED 1–5 derivado do %% de proficientes (>=90:5, >=75:4, >=60:3, >=40:2, senão 1), por simulado, nunca média. Recorte: %s.',
    v_recorte);

  WITH sims AS (
    SELECT sa.id, sa.nome,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
    FROM public.simulados_admin sa
    WHERE v_ies = ANY (sa.ies_ids)
      AND sa.simulado_pai_id IS NULL
      AND sa.status IN ('ativo','encerrado')
      AND (
        sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado'
            AND sa.data_liberacao_desempenho IS NOT NULL
            AND sa.data_liberacao_desempenho <= now())
        OR (sa.liberacao_desempenho = 'ao_encerrar'
            AND (sa.status = 'encerrado'
                 OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now())))
      )
  ),
  sims_ord AS (
    SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord
    FROM sims s
  ),
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  alunos AS (
    SELECT u.id, u.semestre
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id
    FROM public.simulados_finalizados sf
    JOIN grupo g ON g.simulado_id = sf.simulado_id
    WHERE sf.user_id IN (SELECT id FROM alunos)
    ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fb AS (
    SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id
    FROM public.answer_progress ap
    JOIN grupo g ON g.simulado_id = ap.simulado
    JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.user_id IN (SELECT id FROM alunos)
      AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id)
    ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST
  ),
  tentativas AS (
    SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb
  ),
  respostas AS (
    SELECT t.pai_id, t.user_id, ap.correct, q.grande_area
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
  ),
  tri_raw AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, a.semestre, r.score_proprio
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    JOIN alunos a ON a.id = r.student_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
      AND r.score_proprio IS NOT NULL
  ),
  -- gap 112: UMA linha por (student_id, pai_id) ANTES de qualquer contagem/média/dispersão.
  -- resultados_alunos_tri é (student_id, simulado_id); um "pai" pode ter 2+ "filhos"
  -- (simulados-irmãos, mesmo simulado_pai_id), e o MESMO aluno pode ter uma linha de TRI
  -- para CADA filho. Sem esta dedup, count(DISTINCT student_id) já neutralizava a
  -- duplicata na CONTAGEM (achado 8 da rodada anterior), mas avg(score_proprio)
  -- (prof_media, usada na tabela de evolução) somava as linhas duplicadas do mesmo aluno,
  -- e a escolha de linha em `dispersao` (DISTINCT ON student_id ORDER BY m.ord DESC)
  -- ficava arbitrária quando o "ord" mais recente do aluno caía num pai_id com 2+ linhas —
  -- resultado: o MESMO aluno no MESMO simulado saía com um valor na tabela (avg) e outro
  -- no drawer (max).
  --
  -- CRITÉRIO DE DESEMPATE — REFERÊNCIA CANÔNICA (get_gestor_detalhamento e
  -- get_gestor_alunos/get_gestor_aluno DEVEM adotar o MESMO, não inventar outro): MAIOR
  -- score_proprio (melhor tentativa) por (student_id, pai_id). Não é critério novo — é
  -- exatamente o que get_gestor_aluno (o "drawer": migrations 20260729210700,
  -- 20260803150000, 20260804130100) já usa via
  -- `max(tr.score_proprio) ... WHERE tr.student_id = p_aluno_id AND tr.pai_id = s.id`.
  -- Unificar aqui elimina a divergência pela raiz, numa fonte única: tudo que lê `tri` a
  -- partir daqui (contagens, avg, dispersão) vê exatamente uma linha por (student_id,
  -- pai_id), com o mesmo valor que o drawer já mostra. DISTINCT ON com
  -- ORDER BY score_proprio DESC é equivalente a max() aqui porque a única coluna que varia
  -- entre as linhas duplicadas é score_proprio (semestre vem da tabela `alunos`, igual em
  -- todas as duplicatas do mesmo aluno).
  tri AS (
    SELECT DISTINCT ON (tr.student_id, tr.pai_id)
           tr.pai_id, tr.student_id, tr.semestre, tr.score_proprio
    FROM tri_raw tr
    ORDER BY tr.student_id, tr.pai_id, tr.score_proprio DESC
  ),
  por_sim AS (
    SELECT s.id, s.nome, s.data_ref, s.ord,
           (SELECT count(DISTINCT t.student_id) FROM tri t WHERE t.pai_id = s.id)              AS n_tri,
           (SELECT avg(t.score_proprio)         FROM tri t WHERE t.pai_id = s.id)              AS prof_media,
           -- achado 8 (preservado): distinto por aluno, igual ao denominador n_tri. Agora
           -- opera sobre `tri` já deduplicada (gap 112) — count(DISTINCT) aqui é defesa em
           -- profundidade, não a correção em si.
           (SELECT count(DISTINCT t.student_id) FILTER (WHERE t.score_proprio >= 60) FROM tri t WHERE t.pai_id = s.id) AS n_prof,
           (SELECT count(DISTINCT r.user_id)    FROM respostas r WHERE r.pai_id = s.id)        AS n_resp,
           (SELECT count(*) FILTER (WHERE r.correct) FROM respostas r WHERE r.pai_id = s.id)   AS acertos,
           (SELECT count(*)                     FROM respostas r WHERE r.pai_id = s.id)        AS total
    FROM sims_ord s
  ),
  metricas AS (
    SELECT p.*,
           CASE WHEN p.n_tri > 0 THEN round(100.0 * p.n_prof / p.n_tri, 0) END AS prof_pct,
           CASE WHEN p.total > 0 THEN round(100.0 * p.acertos / p.total, 0) END AS acerto_pct,
           CASE WHEN p.n_tri = 0 THEN NULL
                WHEN 100.0 * p.n_prof / p.n_tri >= 90 THEN 5
                WHEN 100.0 * p.n_prof / p.n_tri >= 75 THEN 4
                WHEN 100.0 * p.n_prof / p.n_tri >= 60 THEN 3
                WHEN 100.0 * p.n_prof / p.n_tri >= 40 THEN 2
                ELSE 1 END AS concept
    FROM por_sim p
  ),
  realizados AS (
    SELECT * FROM metricas WHERE n_resp > 0 OR n_tri > 0
  ),
  regua AS (
    SELECT r.*, row_number() OVER (ORDER BY r.ord) AS i, count(*) OVER () AS k
    FROM realizados r
  ),
  pontos AS (
    SELECT g.*,
           CASE WHEN g.i = g.k     THEN 'atual'
                WHEN g.i = g.k - 1 THEN 'anterior'
                WHEN g.i = 1       THEN 'primeiro' END AS rotulo
    FROM regua g
    WHERE g.i = g.k OR g.i = g.k - 1 OR g.i = 1
  ),
  areas_sim AS (
    SELECT r.grande_area AS area, r.pai_id,
           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos
    FROM respostas r
    WHERE r.grande_area IS NOT NULL
    GROUP BY 1, 2
  ),
  areas_tot AS (
    SELECT a.area, sum(a.total) AS total, sum(a.acertos) AS acertos,
           (SELECT count(DISTINCT r2.user_id) FROM respostas r2 WHERE r2.grande_area = a.area) AS amostra
    FROM areas_sim a GROUP BY a.area
  ),
  -- gap 117: `nivel` (abaixo) e `evolucaoPorArea.critica` classificavam sobre o percentual
  -- BRUTO (100.0 * acertos / total), enquanto o `acertoPct` exibido na UI já saía
  -- arredondado (round(...,0)) — um caso com bruto 29.6% arredondava para 30% na tela mas
  -- classificava 'critico' (corte < 30 sobre o bruto): o payload se contradizia. Esta CTE
  -- intermediária calcula o arredondamento UMA vez, e as duas leituras da mesma pergunta
  -- ("essa área é crítica?") — areas_nivel.nivel e evolucaoPorArea.critica, mais abaixo —
  -- passam a classificar sobre este MESMO valor. Consistente com
  -- src/features/gestor/lib/regras.ts:nivelDesempenho, que recebe o acertoPct já
  -- arredondado que a API devolve.
  areas_pct AS (
    SELECT t.area, t.amostra, t.total,
           round(100.0 * t.acertos / NULLIF(t.total,0), 0) AS acerto_pct
    FROM areas_tot t
  ),
  areas_nivel AS (
    SELECT p.area, p.amostra, p.acerto_pct,
           CASE WHEN p.total = 0        THEN NULL
                WHEN p.acerto_pct <  30 THEN 'critico'
                WHEN p.acerto_pct >= 80 THEN 'excelente'
                ELSE 'mediano' END AS nivel
    FROM areas_pct p
  ),
  aluno_prof AS (
    SELECT t.student_id,
           count(DISTINCT t.pai_id) AS n_sim,
           count(DISTINCT t.pai_id) FILTER (WHERE t.score_proprio >= 60) AS n_prof
    FROM tri t GROUP BY t.student_id
  ),
  aluno_grupo AS (
    SELECT ap.student_id,
           CASE WHEN ap.n_prof = ap.n_sim THEN 'consistentemente_proficiente'
                WHEN ap.n_prof = 0        THEN 'consistentemente_nao_proficiente'
                ELSE 'em_variacao' END AS grupo
    FROM aluno_prof ap
  ),
  dispersao AS (
    SELECT DISTINCT ON (t.student_id) t.student_id, t.semestre, t.score_proprio
    FROM tri t
    JOIN metricas m ON m.id = t.pai_id
    ORDER BY t.student_id, m.ord DESC
  ),
  -- achado 5 (rodada anterior, preservado): KPI "x de y" IES-wide, alinhado ao critério de
  -- "realizado" de get_gestor_cronograma -- NÃO filtrado por v_sems (assim como o
  -- cronograma também não recebe p_semestre). Numerador = slots do(s) contrato(s)
  -- vigente(s) com simulado vinculado e "realizado"; denominador = simulados_contratados
  -- desse(s) mesmo(s) contrato(s).
  --
  -- gap 109: o LIMIT 1 escolhia só o "melhor" contrato (vigente hoje, ou o mais recente se
  -- nenhum vigente) e usava SÓ o simulados_contratados dele como denominador. O cronograma
  -- (fonte da verdade deste número, migration 20260804140100) lista os slots de TODOS os
  -- contratos da IES sem escolher um só -- uma IES com 2 contratos vigentes simultâneos
  -- (ex.: 4+3 slots) tinha 7 linhas no cronograma mas o KPI usava denominador 4 OU 3 (o de
  -- um dos dois), divergindo do mesmo produto na mesma tela. Correção: soma os slots de
  -- TODOS os contratos VIGENTES hoje. Sem NENHUM contrato vigente, cai no comportamento
  -- anterior (contrato mais recentemente encerrado), para não regressar o caso já coberto
  -- de IES sem contrato ativo.
  kpi_contratos_vigentes AS (
    SELECT c.id AS contrato_id, c.simulados_contratados
    FROM public.ies_contrato_simulados c
    WHERE c.ies_id = v_ies
      AND current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim
  ),
  kpi_contrato_fallback AS (
    SELECT c.id AS contrato_id, c.simulados_contratados
    FROM public.ies_contrato_simulados c
    WHERE c.ies_id = v_ies
      AND NOT EXISTS (SELECT 1 FROM kpi_contratos_vigentes)
    ORDER BY c.vigencia_fim DESC
    LIMIT 1
  ),
  kpi_contrato AS (
    SELECT * FROM kpi_contratos_vigentes
    UNION ALL
    SELECT * FROM kpi_contrato_fallback
  ),
  kpi_slots AS (
    SELECT sp.simulado_id AS pai_id
    FROM public.ies_simulado_previsto sp
    JOIN kpi_contrato kc ON kc.contrato_id = sp.contrato_id
    WHERE sp.ies_id = v_ies
      AND sp.simulado_id IS NOT NULL
  ),
  kpi_alunos AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ),
  kpi_grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT pai_id FROM kpi_slots)
  ),
  -- participação = simulados_finalizados UNION answer_progress, igual ao cronograma (o
  -- fallback não é redundância: simulados_finalizados não cobre todas as IES/simulados --
  -- ver comentário equivalente em 20260729210100_get_gestor_cronograma.sql).
  kpi_participacao AS (
    SELECT p.pai_id, count(DISTINCT p.user_id) AS n
    FROM (
      SELECT g.pai_id, sf.user_id
      FROM public.simulados_finalizados sf
      JOIN kpi_grupo g ON g.simulado_id = sf.simulado_id
      WHERE sf.user_id IN (SELECT id FROM kpi_alunos)
      UNION
      SELECT g.pai_id, ap.user_id
      FROM public.answer_progress ap
      JOIN kpi_grupo g ON g.simulado_id = ap.simulado
      WHERE ap.user_id IN (SELECT id FROM kpi_alunos)
    ) p
    GROUP BY p.pai_id
  ),
  kpi_com_tri AS (
    SELECT DISTINCT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.resultados_ies_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
  ),
  kpi_realizados AS (
    SELECT ks.pai_id
    FROM kpi_slots ks
    JOIN public.simulados_admin sa
      ON sa.id = ks.pai_id
     AND lower(sa.status) NOT IN ('rascunho','draft','arquivado','cancelado')
    LEFT JOIN kpi_participacao p ON p.pai_id = ks.pai_id
    WHERE (
            COALESCE(p.n,0) > 0
            OR lower(sa.status) = 'encerrado'
            OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento < now())
          )
      AND EXISTS (SELECT 1 FROM kpi_com_tri c WHERE c.pai_id = ks.pai_id)
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'kpis', jsonb_build_object(
        'enamedProjetado', jsonb_build_object(
          'valor', (SELECT p.concept FROM pontos p WHERE p.rotulo = 'atual'),
          'delta', ((SELECT p.concept FROM pontos p WHERE p.rotulo = 'atual')
                    - (SELECT p.concept FROM pontos p WHERE p.rotulo = 'anterior')),
          'serie', COALESCE((SELECT jsonb_agg(jsonb_build_object('rotulo', p.rotulo, 'valor', p.concept) ORDER BY p.i)
                             FROM pontos p), '[]'::jsonb),
          'criterio', 'Conceito 1–5 do simulado atual, derivado do % de alunos proficientes. Nunca é média entre simulados.'
        ),
        'proficientesPct', jsonb_build_object(
          'valor', (SELECT p.prof_pct FROM pontos p WHERE p.rotulo = 'atual'),
          'delta', ((SELECT p.prof_pct FROM pontos p WHERE p.rotulo = 'atual')
                    - (SELECT p.prof_pct FROM pontos p WHERE p.rotulo = 'anterior')),
          'serie', COALESCE((SELECT jsonb_agg(jsonb_build_object('rotulo', p.rotulo, 'valor', p.prof_pct) ORDER BY p.i)
                             FROM pontos p), '[]'::jsonb),
          'criterio', 'Alunos com score_proprio >= 60 sobre o total de alunos com resultado no simulado.'
        ),
        'acertoPct', jsonb_build_object(
          'valor', (SELECT p.acerto_pct FROM pontos p WHERE p.rotulo = 'atual'),
          'delta', ((SELECT p.acerto_pct FROM pontos p WHERE p.rotulo = 'atual')
                    - (SELECT p.acerto_pct FROM pontos p WHERE p.rotulo = 'anterior')),
          'serie', COALESCE((SELECT jsonb_agg(jsonb_build_object('rotulo', p.rotulo, 'valor', p.acerto_pct) ORDER BY p.i)
                             FROM pontos p), '[]'::jsonb),
          'criterio', 'Respostas corretas sobre respostas válidas (questão anulada fora), na última tentativa de cada aluno.'
        ),
        'simulados', jsonb_build_object(
          'realizados',  COALESCE((SELECT count(*) FROM kpi_realizados), 0),
          -- gap 109: soma simulados_contratados de TODOS os contratos vigentes (ou do
          -- fallback), não só de um. sum() sobre kpi_contrato vazio (IES sem contrato
          -- nenhum) devolve NULL, igual ao comportamento anterior do subselect direto --
          -- "sem contrato" continua sendo ausência de dado, nunca 0 (§4.10).
          'contratados', (SELECT sum(kc.simulados_contratados) FROM kpi_contrato kc)
        )
      ),
      'evolucao', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'simuladoId',   m.id,
                 'nome',         m.nome,
                 'data',         to_char(m.data_ref AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 'valor',        CASE WHEN m.prof_media IS NULL THEN NULL ELSE round(m.prof_media::numeric, 1) END,
                 'participantes', GREATEST(m.n_tri, m.n_resp)
               ) ORDER BY m.ord)
        FROM realizados m), '[]'::jsonb),
      'evolucaoPorArea', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'area',    t.area,
                 'pontos',  COALESCE((
                              SELECT jsonb_agg(jsonb_build_object(
                                       'rotulo', m.nome,
                                       'valor',  round(100.0 * a.acertos / NULLIF(a.total,0), 0)
                                     ) ORDER BY m.ord)
                              FROM areas_sim a JOIN metricas m ON m.id = a.pai_id
                              WHERE a.area = t.area), '[]'::jsonb),
                 -- gap 117: classifica sobre o MESMO acerto_pct já arredondado de
                 -- areas_pct, igual a areas_nivel.nivel — antes comparava o percentual
                 -- bruto (100.0 * t.acertos / NULLIF(t.total,0)) < 30, que podia divergir
                 -- do que a UI mostra arredondado.
                 'critica', COALESCE(t.acerto_pct < 30, false)
               ) ORDER BY t.area)
        FROM areas_pct t), '[]'::jsonb),
      'diagnosticoResumo', (
        SELECT jsonb_agg(jsonb_build_object(
                 'nivel', n.nivel,
                 'areas', COALESCE((
                            SELECT jsonb_agg(jsonb_build_object('id', an.area, 'nome', an.area, 'acertoPct', an.acerto_pct)
                                             ORDER BY an.acerto_pct, an.area)
                            FROM areas_nivel an WHERE an.nivel = n.nivel), '[]'::jsonb)
               ) ORDER BY n.pos)
        FROM (VALUES ('critico',1),('mediano',2),('excelente',3)) AS n(nivel,pos)),
      'distribuicaoAlunos', (
        SELECT jsonb_agg(jsonb_build_object(
                 'grupo',      g.grupo,
                 'quantidade', COALESCE(c.q, 0),
                 'percentual', CASE WHEN (SELECT count(*) FROM aluno_grupo) > 0
                                    THEN round(100.0 * COALESCE(c.q,0) / (SELECT count(*) FROM aluno_grupo), 0)
                               END
               ) ORDER BY g.pos)
        FROM (VALUES ('consistentemente_proficiente',1),
                     ('em_variacao',2),
                     ('consistentemente_nao_proficiente',3)) AS g(grupo,pos)
        LEFT JOIN (SELECT grupo, count(*) AS q FROM aluno_grupo GROUP BY grupo) c ON c.grupo = g.grupo),
      'dispersao', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'alunoId',  d.student_id,
                 'semestre', d.semestre,
                 'nota',     round(d.score_proprio::numeric, 1)))
        FROM dispersao d WHERE d.semestre IS NOT NULL), '[]'::jsonb),
      'insights', jsonb_build_array(
        jsonb_build_object('escopo','area','texto', COALESCE((
          SELECT format('%s é a grande área com o menor desempenho da instituição: %s%% de acerto no recorte analisado.',
                        an.area, an.acerto_pct)
          FROM areas_nivel an WHERE an.acerto_pct IS NOT NULL ORDER BY an.acerto_pct, an.area LIMIT 1),
          'Ainda não há respostas suficientes para gerar um insight por grande área.')),
        jsonb_build_object('escopo','aluno','texto', COALESCE((
          SELECT format('%s de %s alunos com resultado estão consistentemente abaixo do limiar de proficiência (60).',
                        x.nao_prof, x.tot)
          FROM (SELECT count(*) FILTER (WHERE grupo = 'consistentemente_nao_proficiente') AS nao_prof,
                       count(*) AS tot
                FROM aluno_grupo) x
          WHERE x.tot > 0),
          'Ainda não há resultado de proficiência para gerar um insight por aluno.'))
      )
    ),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(min(m.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(m.data_ref),'DD/MM/YYYY')
                                FROM realizados m), 'sem simulado com resultado'),
      'fonte',        'resultados_alunos_tri · resultados_ies_tri · answer_progress · questoes_simulado · simulados_admin · simulados_finalizados · users · ies_contrato_simulados · ies_simulado_previsto',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     v_criterio,
      'partial',      (SELECT count(*) FROM realizados WHERE n_tri = 0) > 0,
      -- achado 9 (rodada anterior, preservado): olha SÓ o ponto "atual" (a mesma régua dos
      -- KPIs), não o max() entre todos os simulados do recorte.
      'lowSample',    COALESCE((SELECT GREATEST(p.n_tri, p.n_resp) FROM pontos p WHERE p.rotulo = 'atual'), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_visao_geral(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_visao_geral(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.get_gestor_visao_geral(uuid, text) IS
'Visão geral do Portal do Gestor v2. Autorização de IES via gestor_pode_acessar_ies (achado 15/card 119, substitui user_can_access_ies). Guard de feature via user_has_feature_for_ies (achado 2). KPI "simulados" soma slots/contratados de TODOS os contratos vigentes da IES, não só um (gap 109). tri é deduplicada em UMA linha por (student_id, pai_id) por maior score_proprio, mesmo critério de get_gestor_aluno (gap 112) — referência para get_gestor_detalhamento e get_gestor_alunos/get_gestor_aluno. areas_nivel.nivel e evolucaoPorArea.critica classificam sobre o MESMO acerto_pct já arredondado (gap 117). Revisão de 03/08 e verificação independente de 04/08.';

-- ---------------------------------------------------------------------------
-- VERIFICACAO (rodar em gvqv, autenticado como o usuário de teste -- SECURITY
-- DEFINER + has_role/auth.uid exigem sessão real, não service_role)
-- ---------------------------------------------------------------------------
--
-- 1) Readback: a função foi recriada com o corpo esperado.
--
--    SELECT pg_get_functiondef('public.get_gestor_visao_geral(uuid,text)'::regprocedure);
--    -- confirmar: contém 'gestor_pode_acessar_ies(v_ies)' (achado 15/119) e NÃO contém
--    -- mais 'user_can_access_ies'; contém 'kpi_contratos_vigentes' e
--    -- 'sum(kc.simulados_contratados)' (gap 109); contém 'tri_raw' e
--    -- 'DISTINCT ON (tr.student_id, tr.pai_id)' seguido de
--    -- 'ORDER BY tr.student_id, tr.pai_id, tr.score_proprio DESC' (gap 112); contém
--    -- 'areas_pct' referenciada tanto por 'areas_nivel' quanto por 'evolucaoPorArea'
--    -- (gap 117).
--
-- 2) Confirmação do cenário do achado 15/119 (gestor puro com linha órfã em user_groups):
--
--    SELECT u.id, u.id_ies,
--           (SELECT array_agg(r.role) FROM public.user_roles r WHERE r.user_id = u.id) AS papeis,
--           public.get_accessible_ies(u.id) AS ies_do_grupo
--    FROM public.users u WHERE u.id = :uid;
--    -- ESPERADO: papeis = {gestor} (SÓ gestor), id_ies = :ies_a,
--    --           ies_do_grupo contendo :ies_a E :ies_b (a linha órfã).
--
-- 3) Prova do gap 15/119 lado a lado, autenticado como esse gestor:
--
--    SELECT public.user_can_access_ies(:uid::uuid, :ies_b::uuid) AS antigo_libera_b,
--           public.gestor_pode_acessar_ies(:ies_b::uuid)          AS novo_nega_b,
--           public.gestor_pode_acessar_ies(:ies_a::uuid)          AS novo_libera_a,
--           public.gestor_pode_acessar_ies(NULL)                  AS nulo_nega;
--    -- ESPERADO: antigo_libera_b = true (o gap); novo_nega_b = false (correção);
--    --           novo_libera_a = true (não quebrou o caso legítimo); nulo_nega = false.
--
-- 4) Gap 15/119 fechado ponta a ponta nesta RPC, em transação revertida:
--
--    BEGIN;
--      SELECT public.get_gestor_visao_geral(:ies_b::uuid, 'geral');
--      -- ESPERADO: EXCEPTION 'Permission denied: cannot access this IES'
--      -- (antes: devolvia o payload nominal da IES B).
--      SELECT public.get_gestor_visao_geral(:ies_a::uuid, 'geral');
--      -- ESPERADO: payload normal da própria IES.
--    ROLLBACK;
--
-- 5) Não-regressão de gestor_grupo (autenticado como gestor_grupo do mesmo grupo multi-IES):
--
--    SELECT (public.get_gestor_visao_geral(:ies_a::uuid, 'geral') -> 'data') IS NOT NULL AS libera_a,
--           (public.get_gestor_visao_geral(:ies_b::uuid, 'geral') -> 'data') IS NOT NULL AS libera_b;
--    -- ESPERADO: as duas true (comportamento preservado).
--
-- 6) Não-regressão de admin (autenticado como admin):
--
--    SELECT (public.get_gestor_visao_geral(:ies_b::uuid, 'geral') -> 'data') IS NOT NULL AS admin_libera;
--    -- ESPERADO: true (bypass preservado).
--
-- 7) Fail-closed de professor (autenticado como 'professor'):
--
--    SELECT public.get_gestor_visao_geral(:ies_a::uuid, 'geral');
--    -- ESPERADO: EXCEPTION 'Access denied' (o guard de papel, anterior a qualquer chamada
--    -- ao helper, já barra professor — sem regressão).
--
-- 8) Invariante de coerência podeTrocarIes/iesDisponiveis/servidor, como o gestor puro do
--    cenário acima:
--
--    SELECT (public.get_gestor_contexto() -> 'data' -> 'podeTrocarIes')  AS pode_trocar,
--           (public.get_gestor_contexto() -> 'data' -> 'iesDisponiveis') AS disponiveis,
--           public.gestor_pode_acessar_ies(:ies_b::uuid)                 AS servidor_libera_b;
--    -- ESPERADO: pode_trocar = false, disponiveis = [{ id: :ies_a, ... }] (só a própria),
--    --           servidor_libera_b = false. UI e servidor concordam.
--
-- 9) Caso funcional do gap 109 (IES com 2 contratos vigentes simultâneos), em transação
--    revertida:
--
--    BEGIN;
--      -- montar/confirmar cenário: :ies com dois contratos em
--      -- public.ies_contrato_simulados vigentes hoje (vigencia_inicio/fim cobrindo
--      -- current_date), um com simulados_contratados = 4 (4 slots em
--      -- ies_simulado_previsto) e outro com simulados_contratados = 3 (3 slots).
--      SELECT public.get_gestor_visao_geral(:ies::uuid, 'geral')
--             -> 'data' -> 'kpis' -> 'simulados' AS kpi_simulados;
--      -- ESPERADO: kpi_simulados.contratados = 7 (4 + 3, soma dos DOIS contratos vigentes).
--      SELECT jsonb_array_length(public.get_gestor_cronograma(:ies::uuid) -> 'data') AS linhas_cronograma;
--      -- ESPERADO: 7 (mesma soma) -- os dois números do mesmo produto concordam.
--    ROLLBACK;
--
-- 10) Caso funcional do gap 112 (aluno com 2+ linhas de TRI para filhos do mesmo pai), em
--     transação revertida:
--
--    BEGIN;
--      -- escolher :aluno com 2+ linhas em resultados_alunos_tri para simulados com o
--      -- mesmo simulado_pai_id (:pai_id), scores diferentes entre si.
--      SELECT max(r.score_proprio) AS esperado
--      FROM public.resultados_alunos_tri r
--      JOIN public.simulados_admin sa ON sa.id = r.simulado_id
--      WHERE r.student_id = :aluno::uuid
--        AND COALESCE(sa.simulado_pai_id, sa.id) = :pai_id::uuid;
--
--      SELECT (public.get_gestor_aluno(:ies::uuid, :aluno::uuid) -> 'data' -> 'proficiencias')
--             AS drawer; -- deve conter :esperado para o simulado :pai_id
--
--      SELECT (public.get_gestor_visao_geral(:ies::uuid, 'geral') -> 'data' -> 'evolucao')
--             AS tabela; -- o ponto de :pai_id (se for o simulado com o maior número de
--                         -- participantes distintos, é o que aparece em 'evolucao') deve
--                         -- refletir o mesmo score máximo por aluno, não uma média
--                         -- distorcida pela duplicata.
--    ROLLBACK;
--
-- 11) Caso funcional do gap 117 (30% arredondado não pode sair 'crítico'), em transação
--     revertida:
--
--    BEGIN;
--      -- escolher/montar :ies e recorte cujo bruto de uma grande área fique entre 29.5%
--      -- (arredonda para 30, "mediano") e 29.99% (mesma coisa) -- ou seja, bruto < 30 mas
--      -- round(...,0) = 30.
--      SELECT jsonb_path_query_array(
--               public.get_gestor_visao_geral(:ies::uuid, 'geral') -> 'data' -> 'diagnosticoResumo',
--               '$[*].areas[*] ? (@.acertoPct == 30)'
--             ) AS areas_com_30pct;
--      -- ESPERADO: nenhuma dessas áreas aparece dentro do nível 'critico' em
--      -- diagnosticoResumo (nivel='critico' só contém áreas com acertoPct < 30).
--      SELECT (public.get_gestor_visao_geral(:ies::uuid, 'geral') -> 'data' -> 'evolucaoPorArea')
--             AS evolucao_por_area;
--      -- ESPERADO: para a MESMA área com acertoPct arredondado = 30, 'critica' = false
--      -- (antes: podia sair true, comparando o bruto 29.x < 30).
--    ROLLBACK;
