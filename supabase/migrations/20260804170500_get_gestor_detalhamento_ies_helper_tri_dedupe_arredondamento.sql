-- 20260804170000_get_gestor_detalhamento_ies_helper_tri_dedupe_arredondamento.sql
--
-- SUCEDE 20260804131000_get_gestor_detalhamento_guard_prof_gabarito.sql. NAO edita
-- aquele arquivo, nem nenhum outro de 04/08.
--
-- POR QUE UMA MIGRATION NOVA E NAO UMA EDICAO
-- -------------------------------------------
-- As migrations de 04/08 JA FORAM APLICADAS EM PRODUCAO (gvqv, 04/08 16:11). O
-- Supabase registra migration aplicada pelo PREFIXO da versao: editar o conteudo
-- de um arquivo ja aplicado faz o conteudo novo NUNCA rodar, em silencio. A
-- correcao ficaria no repo com cara de pronta e jamais chegaria ao produto. Toda
-- correcao posterior nasce em arquivo novo, com timestamp posterior. Sem excecao.
--
-- PONTO DE PARTIDA: o corpo desta migration foi copiado de 20260804131000 (a
-- ultima definicao de get_gestor_detalhamento, que corrigiu os achados 2, 8 e 14
-- da revisao de 03/08). Essa migration esta em producao. Os tres achados dela
-- (feature por IES, alunos distintos em n_tri/n_prof, mascaramento de gabarito
-- em prova aberta) sao PRESERVADOS integralmente aqui.
--
-- OS TRES GAPS QUE ESTA MIGRATION FECHA (verificacao independente das 21
-- correcoes de 04/08 contra o criterio de cada card do Notion)
-- ============================================================================
--
-- GAP 1 -- card Ordem 119 (achado 15): autorizacao de IES ainda usava
-- user_can_access_ies, que delega para get_accessible_ies -- funcao que ignora
-- o PAPEL do usuario e so olha texto de user_groups. Um usuario com role SO
-- 'gestor' (users.id_ies = A) que tenha ficado com linha orfa em user_groups
-- apontando para um grupo {A, B} (residuo de downgrade gestor_grupo -> gestor,
-- que a UI de admin permite hoje) passava em user_can_access_ies(uid, B) e esta
-- RPC devolvia metricas/questoes da IES B -- a UI nao oferece o switcher
-- (podeTrocarIes = false) e desde 20260804130200 nem lista a IES B, mas a UI
-- nao e o guard: um POST direto em /rest/v1/rpc/get_gestor_detalhamento com
-- p_ies_id = B ainda respondia.
--
-- Fechado consumindo public.gestor_pode_acessar_ies(p_ies_id uuid), a funcao
-- helper criada nesta rodada (migration 20260804160000_gestor_pode_acessar_ies.sql,
-- que sucede 20260804130200 pelo mesmo motivo de nao-edicao acima). Para
-- 'gestor' puro ela autoriza SOMENTE users.id_ies (nunca get_accessible_ies);
-- para 'gestor_grupo' e 'admin' o comportamento e idêntico ao anterior (sem
-- regressao). Ver o cabecalho de 20260804160000 para a regra completa por papel
-- e a prova de que o conjunto autorizado e subconjunto do de user_can_access_ies
-- em todo papel (a troca so NEGA casos, nunca LIBERA um caso hoje negado).
--
-- O guard sai de DENTRO do `IF p_ies_id IS NOT NULL` (so cobria aquele ramo) e
-- vai para DEPOIS da resolucao de v_ies: o ramo ELSE cai em
-- (get_accessible_ies(v_uid))[1], que para o mesmo gestor puro com
-- users.id_ies NULL e user_groups orfao devolve uma IES do GRUPO -- o mesmo
-- vazamento, por outra porta, sem p_ies_id nenhum. Autorizar v_ies (o valor que
-- a query vai de fato usar) fecha os dois ramos com um unico IF, e nada e
-- emitido antes dele.
--
-- ORDEM FINAL DO PREAMBULO (identica, verbatim, nas outras 8 RPCs get_gestor_*
-- com p_ies_id que consomem o mesmo helper nesta rodada -- ver 20260804160000
-- "COMO CONSUMIR"): papel (Access denied) -> [checagens proprias desta RPC que
-- nao dependem de IES: selecao de simulados obrigatoria] -> resolucao de v_ies
-- -> IES not resolved -> autorizacao (Permission denied: cannot access this
-- IES) -> feature (feature_not_enabled) -> [demais checagens proprias: semestre,
-- elegibilidade por simulado].
--
-- NAO alterada a mensagem 'Permission denied: cannot access this IES' -- o
-- front-end mapeia essa string.
--
-- ----------------------------------------------------------------------------
--
-- GAP 2 -- card Ordem 112 (achado 8, incompleto): a correcao de 04/08 trocou
-- `count(*)` por `count(DISTINCT t.student_id)` em n_tri e n_prof, alinhando os
-- DOIS LADOS da fracao de proficientes -- isso impede prof_pct > 100%, mas nao
-- remove a causa raiz: a CTE `tri` ainda pode ter 2+ LINHAS para o mesmo
-- (student_id, pai_id), porque a PK de resultados_alunos_tri e
-- (student_id, simulado_id) e um "pai" pode ter varios "filhos" -- um aluno
-- pode ter resultado registrado contra o simulado pai E/OU contra um ou mais
-- filhos dele, todos mapeando para o mesmo pai_id apos o COALESCE.
--
-- `count(DISTINCT student_id) FILTER (WHERE score_proprio >= 60)` esconde o
-- sintoma (a fracao nao passa de 100%) mas nao resolve a ambiguidade: se um
-- aluno tem uma linha com score 55 e outra com score 65 para o MESMO pai_id,
-- ele e contado 1x em n_tri (correto) e 1x em n_prof (porque BASTA uma linha
-- com score >= 60 passar o FILTER a nivel de linha antes do DISTINCT) --
-- qual das duas notas realmente representa esse aluno para esse pai_id fica
-- indefinido. E pior em `prof_media := avg(t.score_proprio)`: a media soma AS
-- DUAS linhas (55 e 65) para um aluno que deveria contribuir uma unica vez,
-- puxando a media geral na direcao de quem tem mais linhas -- um aluno com 2
-- filhos "pesa" o dobro de um aluno com 1, na mesma media que o payload expoe
-- em 'proficienciaMedia'.
--
-- O vetor NAO e hipotetico: e o resultado natural de um "pai" com multiplas
-- turmas/modalidades (multiplos "filhos"), pratica que a migration
-- 20260804131000 (achado 14, comentario da CTE `grupo`) e o proprio schema
-- (simulado_pai_id) preveem como caso normal, nao de borda.
--
-- CRITERIO DE DESEMPATE -- NAO escolhido isoladamente aqui: get_gestor_aluno
-- (o "drawer", migrations 20260729210700 / 20260803150000 / 20260804130100)
-- JA usa, para exatamente esta mesma ambiguidade,
-- `max(tr.score_proprio) ... WHERE tr.student_id = p_aluno_id AND
-- tr.pai_id = s.id` -- ou seja, "melhor tentativa" (MAIOR score_proprio) por
-- (student_id, pai_id) e um criterio PRE-EXISTENTE no repo, nao inventado
-- nesta rodada. O agente de get_gestor_visao_geral chegou lá primeiro nesta
-- mesma rodada (migration 20260804173000_get_gestor_visao_geral_multicontrato
-- _dedup_nivel.sql) e formalizou esse mesmo criterio como REFERENCIA CANONICA
-- para as RPCs que leem `tri` -- get_gestor_visao_geral, get_gestor_detalhamento
-- e get_gestor_alunos/get_gestor_aluno devem usar o MESMO desempate, para que
-- o mesmo aluno no mesmo simulado nao saia com um numero na tabela de evolucao,
-- outro no drawer e um terceiro aqui em Detalhamento.
--
-- Esta migration ADOTA esse criterio (nao um proprio): DISTINCT ON
-- (student_id, pai_id), ORDER BY score_proprio DESC -- equivalente a max()
-- quando a unica coluna que varia entre as linhas duplicadas e score_proprio
-- (semestre vem de `alunos`, igual em todas as duplicatas do mesmo aluno).
-- Alternativa que este agente considerou ANTES de ler 20260804173000 e
-- descartou por nao ser a REFERENCIA CANONICA escolhida: desempate por
-- recencia do simulado de origem (mesma convencao de `ultima`/`ultima_fb`) --
-- teria sido defensavel isoladamente, mas divergiria do drawer (get_gestor_aluno)
-- e da Visao Geral, reintroduzindo exatamente o tipo de inconsistencia entre
-- telas que o achado 8 original denunciou. Nao inventar um terceiro criterio.
--
-- O QUE MUDA NO RESULTADO: com a linha unica por (aluno, pai) ja garantida na
-- CTE `tri`, `n_tri`, `n_prof` (que continuam usando count(DISTINCT ...) por
-- clareza e defesa em profundidade, ainda que agora redundante com a unicidade
-- da fonte) e `prof_media` (avg) deixam de poder contar/somar 2+ vezes o mesmo
-- aluno para o mesmo pai_id -- e passam a refletir a MESMA nota (a melhor) que
-- get_gestor_aluno já mostra no drawer para esse aluno/pai_id. `dispersao`
-- (que faz um segundo DISTINCT ON por aluno, atraves de TODOS os pai_id
-- selecionados, para escolher o ponto mais recente da SERIE) continua correta
-- sem mudanca -- ja operava sobre linhas que agora sao, cada uma, a
-- representante unica de um (aluno, pai).
--
-- CONFERIDO -- nao e mais pendencia: o criterio aqui e IDENTICO ao de
-- 20260804173000 (mesma DISTINCT ON, mesma ORDER BY ... score_proprio DESC).
-- Nenhum dos dois inventou desempate proprio; os dois leem o mesmo precedente
-- (get_gestor_aluno) e chegam ao mesmo lugar.
--
-- ----------------------------------------------------------------------------
--
-- GAP 3 -- card Ordem 117: em `data.acertoPorAreaESemestre.areas[].critica`
-- (linha ~385 da migration anterior), o booleano era calculado sobre a RAZAO
-- CRUA `(100.0 * a.acertos / NULLIF(a.total,0)) < 30`, enquanto o `acertoPct`
-- exposto NA MESMA LINHA do payload e essa razao ARREDONDADA
-- (`round(100.0 * a.acertos / NULLIF(a.total,0), 0)`). Para uma razao real
-- entre 29,5 e 30 (ex.: 29,6), `acertoPct` arredonda para 30 (nao critico pela
-- propria regua -- NIVEL_CRITICO_MAX = 30 e exclusivo, src/features/gestor/lib
-- /regras.ts) mas `critica` computava 29,6 < 30 = true -- o payload saia com
-- 'acertoPct': 30 e 'critica': true SIMULTANEAMENTE, uma area rotulada critica
-- na mesma tela em que mostra 30% (o piso da regra, nao abaixo dele).
--
-- FECHADO classificando `critica` sobre o MESMO valor arredondado que
-- `acertoPct` expoe -- nao sobre a razao crua. Introduzida a CTE `areas_nivel`,
-- que arredonda UMA VEZ (`acerto_pct`) e e a UNICA fonte tanto de 'acertoPct'
-- quanto de 'critica' no payload; a CTE `areas` (razao crua, agregacao) fica
-- inalterada por baixo. Nenhuma mudanca de LIMIAR (continua < 30, spec §4.4) --
-- so a base de calculo passa a ser a mesma que a UI ve.
--
-- NAO tocado: a CTE `semestres` e 'emEvidencia' (comparam INTEIRO de semestre
-- contra v_evid, sem nenhum arredondamento envolvido -- gap 117 nao se aplica
-- ali).
--
-- NAO tocada a migration de get_gestor_visao_geral (e de outro agente) --
-- observacao registrada em `pendencias`: a CTE `areas_nivel` de
-- 20260804130000_get_gestor_visao_geral_guard_kpi_lowsample.sql tem o MESMO
-- padrao (calcula `acerto_pct` arredondado E `nivel` a partir da razao crua,
-- nao de `acerto_pct`) -- mesma familia de bug, RPC e card diferentes; nao e
-- desta migration corrigir, so vale o alerta.
--
-- ============================================================================
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv) -- NAO PULAR
-- ============================================================================
-- 1) Corpo atual de get_gestor_detalhamento deve bater com o assumido aqui
--    (20260804131000):
--
--      SELECT pg_get_functiondef('public.get_gestor_detalhamento(uuid,text,uuid[])'::regprocedure);
--
--    Se divergir (outra migration mexeu na funcao fora deste repo, entre
--    04/08 16:11 e agora), ABORTAR e reconciliar manualmente -- nao aplicar
--    por cima às cegas.
--
-- 2) Tres readbacks exigidos pela regra do achado 15/119 (mesma exigencia do
--    cabecalho de 20260804160000), porque esta migration passa a DEPENDER da
--    funcao helper:
--
--      -- (a) o helper precisa existir com o corpo esperado (criado nesta
--      -- rodada, migration 20260804160000):
--      SELECT pg_get_functiondef('public.gestor_pode_acessar_ies(uuid)'::regprocedure);
--      -- ESPERADO: corpo de 20260804160000 (admin -> true; gestor_grupo ->
--      -- get_accessible_ies; gestor -> SOMENTE users.id_ies; outros -> false).
--      -- Se a funcao NAO existir ainda em producao, ABORTAR esta migration --
--      -- aplicar 20260804160000_gestor_pode_acessar_ies.sql primeiro.
--
--      -- (b) as funcoes de que o helper depende, inalteradas:
--      SELECT pg_get_functiondef('public.get_accessible_ies(uuid)'::regprocedure);
--      -- ESPERADO: identico a 20260525145930
--      SELECT pg_get_functiondef('public.user_can_access_ies(uuid,uuid)'::regprocedure);
--      -- ESPERADO: identico a 20260603174512
--
--      -- (c) coerencia com podeTrocarIes:
--      SELECT pg_get_functiondef('public.get_gestor_contexto()'::regprocsignature);
--      -- ESPERADO: corpo de 20260804130200. Se divergir, a tabela de
--      -- coerencia podeTrocarIes/iesDisponiveis/servidor do cabecalho de
--      -- 20260804160000 esta invalidada -- PARAR e investigar antes de seguir.
--
-- NADA MAIS MUDOU: SECURITY DEFINER, SET search_path, STABLE, os guards de
-- papel, a checagem de elegibilidade existente (`simulado_fora_do_escopo`,
-- inalterada), o mascaramento de gabarito (`v_aberta`, achado 14, inalterado),
-- os grants e a assinatura (p_ies_id uuid, p_semestre text, p_simulados uuid[])
-- sao preservados integralmente.
CREATE OR REPLACE FUNCTION public.get_gestor_detalhamento(p_ies_id uuid, p_semestre text, p_simulados uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid     uuid := auth.uid();
  v_ies     uuid;
  v_sems    int[];
  v_evid    int[];
  v_recorte text;
  v_n       int;
  v_aberta  boolean;
  v_result  jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_simulados IS NULL OR array_length(p_simulados,1) IS NULL THEN
    RAISE EXCEPTION 'selecao_de_simulados_obrigatoria' USING ERRCODE = '22023';
  END IF;
  v_n := array_length(p_simulados,1);

  -- gap 119: resolucao de v_ies PRIMEIRO (ainda NAO autoriza). O ramo
  -- p_ies_id IS NOT NULL so atribui; o ramo ELSE cai em users.id_ies e, na
  -- falta, no fallback de get_accessible_ies -- os dois ramos sao autorizados
  -- juntos, depois, pelo helper.
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

  -- gap 119: autorizacao da IES RESOLVIDA, por papel -- substitui a chamada
  -- antiga (ver cabecalho). O helper (migration 20260804160000) fecha o
  -- vazamento de um gestor puro com linha orfa em user_groups: para esse
  -- papel, autoriza SOMENTE users.id_ies, nunca get_accessible_ies. admin e
  -- gestor_grupo mantêm o comportamento anterior (sem regressao -- ver
  -- 20260804160000 para a prova de subconjunto).
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  -- achado 2 (04/08, preservado): guard de feature por IES, DEPOIS de v_ies
  -- resolvido E autorizado (nunca contra p_ies_id, que pode ser NULL aqui).
  IF NOT public.user_has_feature_for_ies('gestao.portal_v2', v_ies) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

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

  -- todo simulado pedido tem de ser elegível para esta IES
  IF EXISTS (
    SELECT 1 FROM unnest(p_simulados) AS pedido(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.simulados_admin sa
      WHERE sa.id = pedido.id
        AND v_ies = ANY (sa.ies_ids)
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
    )
  ) THEN
    RAISE EXCEPTION 'simulado_fora_do_escopo' USING ERRCODE = '42501';
  END IF;

  -- achado 14 (04/08, preservado): "desempenho liberado" (checagem acima) não
  -- é o mesmo que "prova ainda aberta ao aluno". v_aberta espelha
  -- simuladosApi.ts (listarSimulados, modo aluno) -- mesmo critério usado em
  -- get_gestor_questoes (migration 20260804133000). Só é calculado quando
  -- v_n = 1: é o único caso em que `questoes` (conteúdo bruto) existe; com
  -- 2+ simulados fica false sem custo de query extra.
  IF v_n = 1 THEN
    SELECT (
      sa.status = 'ativo'
      AND (sa.data_liberacao IS NULL OR sa.data_liberacao <= now())
      AND (sa.data_encerramento IS NULL OR sa.data_encerramento >= now())
    )
    INTO v_aberta
    FROM public.simulados_admin sa
    WHERE sa.id = p_simulados[1];
  ELSE
    v_aberta := false;
  END IF;

  WITH sims AS (
    SELECT sa.id, sa.nome,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
    FROM public.simulados_admin sa
    WHERE sa.id = ANY (p_simulados)
  ),
  sims_ord AS (
    SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord FROM sims s
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
  tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb),
  respostas AS (
    SELECT t.pai_id, t.user_id, a.semestre, ap.correct, ap.question_id,
           q.grande_area, q.tema
    FROM tentativas t
    JOIN alunos a ON a.id = t.user_id
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
  ),
  -- gap 112: fonte crua de TRI, ainda com possiveis 2+ linhas por
  -- (student_id, pai_id) quando um "pai" tem multiplos "filhos" e o aluno tem
  -- resultado contra mais de um. `data_ref` reusa o MESMO COALESCE de
  -- `sims`/`sims_ord`, aplicado ao simulado de origem de CADA linha de TRI
  -- (que pode ser um filho, diferente do pai selecionado em `sims`).
  tri_raw AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, a.semestre, r.score_proprio,
           sa.id AS simulado_id,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    JOIN alunos a ON a.id = r.student_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
      AND r.score_proprio IS NOT NULL
  ),
  -- gap 112: UMA linha por (student_id, pai_id), com o CRITERIO CANONICO da
  -- rodada -- `score_proprio DESC`, a MAIOR nota entre as tentativas do mesmo
  -- simulado pai.
  --
  -- POR QUE MAIOR NOTA E NAO MAIS RECENTE. A primeira versao desta migration
  -- desempatava pela tentativa mais recente (`data_ref DESC`), por coerencia
  -- interna com as CTEs `ultima`/`ultima_fb` desta propria funcao. O problema:
  -- `get_gestor_visao_geral`, `get_gestor_alunos` e `get_gestor_aluno` usam
  -- `score_proprio DESC`, e o gap 112 e exatamente "o mesmo aluno no mesmo
  -- simulado tem que dar o MESMO numero nas duas telas". Dois criterios
  -- corretos e incoerentes entre si nao fecham o gap -- so o trocam de lugar.
  --
  -- Escolhido `score_proprio DESC` por ser o que PRESERVA o comportamento
  -- observavel de antes: o drawer (`get_gestor_aluno`) usava `max()`. Mudar
  -- todas para "mais recente" mudaria numero que a coordenadora ja viu, sem
  -- ninguem ter decidido isso.
  --
  -- PENDENCIA DE PRODUTO, registrada de proposito: "o numero do aluno naquele
  -- grupo de simulados" significa a MELHOR tentativa ou a MAIS RECENTE? Afeta
  -- % de proficientes, conceito ENAMED e dispersao. Nao e questao tecnica, e
  -- decisao do Felipe. Se a resposta for "mais recente", muda nas QUATRO
  -- funcoes juntas, nunca em uma so.
  tri AS (
    SELECT DISTINCT ON (t.student_id, t.pai_id)
           t.pai_id, t.student_id, t.semestre, t.score_proprio
    FROM tri_raw t
    ORDER BY t.student_id, t.pai_id, t.score_proprio DESC
  ),
  metricas AS (
    SELECT s.id, s.nome, s.data_ref, s.ord,
           (SELECT count(DISTINCT r.user_id) FROM respostas r WHERE r.pai_id = s.id) AS n_resp,
           (SELECT count(*) FILTER (WHERE r.correct) FROM respostas r WHERE r.pai_id = s.id) AS acertos,
           (SELECT count(*) FROM respostas r WHERE r.pai_id = s.id) AS total,
           -- achado 8 (04/08): alunos distintos, não linhas de resultados_alunos_tri.
           -- gap 112 (aqui): agora redundante em segurança, não em necessidade --
           -- `tri` já garante no máximo 1 linha por (aluno, pai_id); mantido por
           -- clareza e defesa em profundidade.
           (SELECT count(DISTINCT t.student_id) FROM tri t WHERE t.pai_id = s.id) AS n_tri,
           (SELECT count(DISTINCT t.student_id) FILTER (WHERE t.score_proprio >= 60) FROM tri t WHERE t.pai_id = s.id) AS n_prof,
           (SELECT avg(t.score_proprio) FROM tri t WHERE t.pai_id = s.id) AS prof_media
    FROM sims_ord s
  ),
  areas AS (
    SELECT r.grande_area AS area,
           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos
    FROM respostas r WHERE r.grande_area IS NOT NULL GROUP BY r.grande_area
  ),
  -- gap 117: arredonda UMA vez; 'critica' no payload classifica sobre ESTE
  -- valor (acerto_pct), nunca sobre a razão crua -- para que uma área nunca
  -- saia com 'acertoPct': 30 e 'critica': true ao mesmo tempo.
  areas_nivel AS (
    SELECT a.area, round(100.0 * a.acertos / NULLIF(a.total,0), 0) AS acerto_pct
    FROM areas a
  ),
  semestres AS (
    SELECT r.semestre,
           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos
    FROM respostas r WHERE r.semestre IS NOT NULL GROUP BY r.semestre
  ),
  dispersao AS (
    SELECT DISTINCT ON (t.student_id) t.student_id, t.semestre, t.score_proprio
    FROM tri t JOIN metricas m ON m.id = t.pai_id
    ORDER BY t.student_id, m.ord DESC
  ),
  -- questões: só quando exatamente 1 simulado (primeira página, 20 itens)
  q_base AS (
    SELECT q.id, COALESCE(q.numero_questao, q.ordem) AS numero,
           q.grande_area, q.especialidade, q.tema, q.enunciado, upper(q.correta) AS correta,
           q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d, q.alternativa_e
    FROM public.questoes_simulado q
    WHERE v_n = 1
      AND q.simulado_id IN (SELECT g.simulado_id FROM grupo g)
      AND COALESCE(q.anulada,false) = false
  ),
  q_resp AS (
    SELECT ap.question_id,
           count(*) AS total,
           count(*) FILTER (WHERE ap.correct) AS acertos,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) IN ('A','B','C','D','E')) AS marcadas,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'A') AS m_a,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'B') AS m_b,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'C') AS m_c,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'D') AS m_d,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'E') AS m_e
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    GROUP BY ap.question_id
  ),
  q_full AS (
    SELECT b.*, COALESCE(r.total,0) AS total, COALESCE(r.acertos,0) AS acertos,
           COALESCE(r.marcadas,0) AS marcadas,
           COALESCE(r.m_a,0) AS m_a, COALESCE(r.m_b,0) AS m_b, COALESCE(r.m_c,0) AS m_c,
           COALESCE(r.m_d,0) AS m_d, COALESCE(r.m_e,0) AS m_e,
           CASE WHEN COALESCE(r.total,0) > 0 THEN round(100.0 * r.acertos / r.total, 0) END AS acerto_pct
    FROM q_base b LEFT JOIN q_resp r ON r.question_id = b.id
  ),
  q_alts AS (
    SELECT f.id,
           jsonb_agg(jsonb_build_object(
             'letra',      a.letra,
             'texto',      a.texto,
             -- achado 14: enquanto a prova está aberta (v_aberta), não expõe
             -- qual alternativa é a correta. NULL, nunca false.
             'correta',    CASE WHEN v_aberta THEN NULL ELSE (a.letra = f.correta) END,
             'marcadaPct', CASE WHEN f.marcadas > 0 THEN round(100.0 * a.n / f.marcadas, 0) END
           ) ORDER BY a.letra) AS alternativas,
           -- mesmo corte: distrator dominante só existe sabendo qual é a
           -- correta, então some junto enquanto a prova está aberta.
           CASE WHEN v_aberta THEN NULL ELSE (
             SELECT d.letra FROM (VALUES ('A',f.m_a),('B',f.m_b),('C',f.m_c),('D',f.m_d),('E',f.m_e)) AS d(letra,n)
               WHERE d.letra <> f.correta AND d.n > 0 ORDER BY d.n DESC, d.letra LIMIT 1
           ) END AS distrator
    FROM q_full f
    CROSS JOIN LATERAL (VALUES
      ('A', f.alternativa_a, f.m_a), ('B', f.alternativa_b, f.m_b), ('C', f.alternativa_c, f.m_c),
      ('D', f.alternativa_d, f.m_d), ('E', f.alternativa_e, f.m_e)
    ) AS a(letra, texto, n)
    WHERE a.texto IS NOT NULL
    GROUP BY f.id, f.correta, f.marcadas, f.m_a, f.m_b, f.m_c, f.m_d, f.m_e
  ),
  q_page AS (
    SELECT f.*, al.alternativas, al.distrator,
           row_number() OVER (ORDER BY f.numero) AS rn
    FROM q_full f JOIN q_alts al ON al.id = f.id
  ),
  temas_cmp AS (
    SELECT r.tema, r.pai_id,
           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos
    FROM respostas r
    WHERE v_n >= 2 AND r.tema IS NOT NULL
    GROUP BY r.tema, r.pai_id
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'metricas', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'simuladoId',        m.id,
                 'nome',              m.nome,
                 'data',              to_char(m.data_ref AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 'participantes',     GREATEST(m.n_resp, m.n_tri),
                 'acertoMedioPct',    CASE WHEN m.total > 0 THEN round(100.0 * m.acertos / m.total, 0) END,
                 'enamedProjetado',   CASE WHEN m.n_tri = 0 THEN NULL
                                           WHEN 100.0 * m.n_prof / m.n_tri >= 90 THEN 5
                                           WHEN 100.0 * m.n_prof / m.n_tri >= 75 THEN 4
                                           WHEN 100.0 * m.n_prof / m.n_tri >= 60 THEN 3
                                           WHEN 100.0 * m.n_prof / m.n_tri >= 40 THEN 2
                                           ELSE 1 END,
                 'proficienciaMedia', CASE WHEN m.prof_media IS NULL THEN NULL
                                           ELSE round(m.prof_media::numeric, 1) END
               ) ORDER BY m.ord)
        FROM metricas m), '[]'::jsonb),
      'acertoPorAreaESemestre', jsonb_build_object(
        'areas', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'id',        a.area,
                   'nome',      a.area,
                   -- gap 117: 'acertoPct' e 'critica' vêm da MESMA coluna
                   -- arredondada (areas_nivel.acerto_pct) -- nunca a razão crua.
                   'acertoPct', a.acerto_pct,
                   'critica',   COALESCE(a.acerto_pct < 30, false)
                 ) ORDER BY a.area)
          FROM areas_nivel a), '[]'::jsonb),
        'semestres', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'semestre',    s.semestre,
                   'acertoPct',   round(100.0 * s.acertos / NULLIF(s.total,0), 0),
                   'emEvidencia', COALESCE(s.semestre = ANY (v_evid), false)
                 ) ORDER BY s.semestre)
          FROM semestres s), '[]'::jsonb)
      ),
      'dispersao', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'alunoId',  d.student_id,
                 'semestre', d.semestre,
                 'nota',     round(d.score_proprio::numeric, 1)))
        FROM dispersao d WHERE d.semestre IS NOT NULL), '[]'::jsonb),
      'questoes', CASE WHEN v_n = 1 THEN jsonb_build_object(
        'data', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'numero',       p.numero,
                   'grandeArea',   p.grande_area,
                   'especialidade',p.especialidade,
                   'tema',         p.tema,
                   'acertoPct',    p.acerto_pct,
                   'enunciado',    p.enunciado,
                   'alternativas', p.alternativas,
                   'distratorDominante', p.distrator
                 ) ORDER BY p.rn)
          FROM q_page p WHERE p.rn <= 20), '[]'::jsonb),
        'page',       1,
        'pageSize',   20,
        'total',      (SELECT count(*) FROM q_page),
        'totalPages', CASE WHEN (SELECT count(*) FROM q_page) = 0 THEN 0
                           ELSE ceil((SELECT count(*) FROM q_page)::numeric / 20)::int END
      ) END,
      'comparativoTemas', CASE WHEN v_n >= 2 THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'tema', t.tema,
                 'porSimulado', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object(
                            'simuladoId', m.id,
                            'acertoPct',  round(100.0 * c.acertos / NULLIF(c.total,0), 0)
                          ) ORDER BY m.ord)
                   FROM temas_cmp c JOIN metricas m ON m.id = c.pai_id
                   WHERE c.tema = t.tema), '[]'::jsonb)
               ) ORDER BY t.tema)
        FROM (SELECT DISTINCT tema FROM temas_cmp) t), '[]'::jsonb) END
    ),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(min(m.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(m.data_ref),'DD/MM/YYYY')
                                FROM metricas m), 'seleção sem data'),
      'fonte',        'resultados_alunos_tri · answer_progress · questoes_simulado · simulados_admin · simulados_finalizados · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Uma entrada em metricas por simulado selecionado; nenhuma média entre simulados. Conceito ENAMED por simulado, derivado do %% de proficientes (>= 60, alunos distintos, uma linha de TRI por aluno por simulado-pai, desempate pela tentativa mais recente). %% de acerto sobre a última tentativa de cada aluno, questão anulada ignorada. Questões só com 1 simulado selecionado; comparativo por tema só com 2 ou mais. Prova ainda aberta ao aluno (status ativo, dentro da janela de liberação/encerramento): %s — enquanto aberta, correta e distratorDominante vêm null, gabarito não é exposto. Simulados selecionados: %s. Recorte: %s.', v_aberta, v_n, v_recorte),
      'partial',      (SELECT count(*) FROM metricas WHERE n_tri = 0) > 0,
      'lowSample',    COALESCE((SELECT min(GREATEST(m.n_resp, m.n_tri)) FROM metricas m), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_detalhamento(uuid, text, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_detalhamento(uuid, text, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICACAO (rodar em gvqv, autenticado como o usuario de teste -- SECURITY
-- DEFINER + has_role/auth.uid exigem sessão real, não service_role)
-- ---------------------------------------------------------------------------
--
-- 0) Readback: a função foi recriada com os três gaps fechados.
--
--    SELECT pg_get_functiondef('public.get_gestor_detalhamento(uuid,text,uuid[])'::regprocedure);
--    -- confirmar: contém 'gestor_pode_acessar_ies(v_ies)' (gap 119) e NÃO
--    -- mais 'user_can_access_ies'; contém a CTE 'tri_raw' e a CTE 'tri' com
--    -- 'DISTINCT ON (t.student_id, t.pai_id)' (gap 112); contém a CTE
--    -- 'areas_nivel' e 'critica', COALESCE(a.acerto_pct < 30, false)' lendo
--    -- de 'areas_nivel', não da razão crua (gap 117).
--
-- 1) Gap 119 -- cenário do card Ordem 119 (gestor puro, users.id_ies = :ies_a,
--    linha órfã em user_groups cobrindo {:ies_a, :ies_b}), em transação
--    revertida, autenticado como esse gestor:
--
--    BEGIN;
--      SELECT public.get_gestor_detalhamento(:ies_b::uuid, 'geral', ARRAY[:algum_simulado_da_ies_b]::uuid[]);
--      -- ESPERADO: EXCEPTION 'Permission denied: cannot access this IES'
--      -- (antes desta migration: devolvia métricas/questões da IES B)
--      SELECT public.get_gestor_detalhamento(:ies_a::uuid, 'geral', ARRAY[:algum_simulado_da_ies_a]::uuid[]);
--      -- ESPERADO: payload normal da própria IES (não regrediu)
--    ROLLBACK;
--
--    Não-regressão de gestor_grupo e admin (mesmo grupo multi-IES / usuário
--    admin, autenticados como cada um):
--      SELECT public.get_gestor_detalhamento(:ies_b::uuid, 'geral', ARRAY[:algum_simulado_da_ies_b]::uuid[]);
--      -- ESPERADO (gestor_grupo do grupo de :ies_b, e admin): payload normal.
--
-- 2) Gap 112 -- prova lado a lado, escolhendo um "pai" com 2+ "filhos" e um
--    aluno com resultado registrado contra mais de um filho do mesmo pai:
--
--    -- quantas linhas cruas existem para esse aluno, nesse pai (>= 2 prova o cenário):
--    SELECT count(*) FROM public.resultados_alunos_tri r
--    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
--    WHERE r.student_id = :aluno_teste::uuid
--      AND COALESCE(sa.simulado_pai_id, sa.id) = :pai_id::uuid;
--    -- ESPERADO (para provar o gap antes da correção): >= 2
--
--    -- após a correção, `tri` (dentro da função) tem no máximo 1 linha para
--    -- esse (aluno, pai) -- confirmar via 'proficienciaMedia' do simulado no
--    -- payload: não deve mais estar deslocada pela linha duplicada. Comparar
--    -- com o valor manual de uma única linha (a mais recente, por data_ref):
--    SELECT r.score_proprio
--    FROM public.resultados_alunos_tri r
--    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
--    WHERE r.student_id = :aluno_teste::uuid
--      AND COALESCE(sa.simulado_pai_id, sa.id) = :pai_id::uuid
--    ORDER BY COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) DESC NULLS LAST, sa.id
--    LIMIT 1;
--    -- ESPERADO: este é o valor que agora determina, sozinho, se esse aluno
--    -- conta como proficiente para esse pai_id -- não a OR lógica de "alguma
--    -- linha >= 60" nem a média de todas as linhas.
--
-- 3) Gap 117 -- escolher/construir (ambiente de teste, dados sintéticos) uma
--    grande área cuja razão de acerto caia em [29.5, 30) -- ex.: 30 acertos em
--    101 questões = 29,70…%:
--
--    SELECT public.get_gestor_detalhamento(:ies::uuid, 'geral', ARRAY[:simulado]::uuid[])
--           -> 'data' -> 'acertoPorAreaESemestre' -> 'areas';
--    -- ESPERADO: a área com razão em [29.5, 30) mostra 'acertoPct': 30 E
--    -- 'critica': false (NUNCA 'critica': true com 'acertoPct': 30 -- essa
--    -- combinação era exatamente o bug). Uma área com razão franca abaixo de
--    -- 29,5 (ex.: 20%) continua 'critica': true normalmente (não regrediu o
--    -- limiar).
--
-- 4) Não-regressão do achado 14 (mascaramento de gabarito, v_aberta) -- mesmo
--    roteiro de 20260804131000, confirmando que esta migration não tocou
--    nisso:
--
--    BEGIN;
--      SELECT public.get_gestor_detalhamento(:ies::uuid, 'geral', ARRAY[:simulado_ativo_dentro_da_janela]::uuid[])
--             -> 'data' -> 'questoes' -> 'data' -> 0 -> 'alternativas';
--      -- ESPERADO: todas as alternativas com 'correta': null, como antes.
--    ROLLBACK;
--
-- 5) Fail-closed de professor (autenticado como um 'professor' da IES): já
--    barrado no guard de papel (Access denied), antes de qualquer resolução
--    de IES -- não chega a acionar gestor_pode_acessar_ies.
--
--    SELECT public.get_gestor_detalhamento(:ies::uuid, 'geral', ARRAY[:simulado]::uuid[]);
--    -- ESPERADO: EXCEPTION 'Access denied'
