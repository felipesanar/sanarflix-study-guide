-- 20260804170000_get_gestor_cronograma_helper_ies_e_participantes_prova_aberta.sql
--
-- SUCEDE 20260804140100_get_gestor_cronograma_guard_precedencia_datas.sql (achados 2 e 10,
-- cards Ordem 101/114) e DEPENDE de 20260804160000_gestor_pode_acessar_ies.sql (achado 15,
-- card Ordem 119). NAO edita nenhum dos dois arquivos.
--
-- POR QUE UMA MIGRATION NOVA E NAO UMA EDICAO
-- -------------------------------------------
-- As migrations de 04/08 JA FORAM APLICADAS EM PRODUCAO (gvqv, 04/08 16:11). O Supabase
-- registra migration aplicada pelo PREFIXO da versao: editar o conteudo de um arquivo ja
-- aplicado faz o conteudo novo NUNCA rodar, em silencio -- a correcao ficaria no repo com
-- cara de pronta e jamais chegaria ao produto. Por isso esta correcao nasce em arquivo novo,
-- com timestamp posterior a 20260804140100 (o corpo de partida real) e a 20260804160000 (o
-- helper de que este arquivo passa a depender), nunca editando qualquer um dos dois.
--
-- OS DOIS GAPS QUE ESTA MIGRATION FECHA
-- --------------------------------------
-- Uma verificacao independente das correcoes de 04/08 leu cada card do Notion contra o que
-- foi de fato aplicado e achou dois gaps que tocam esta funcao:
--
-- (1) Card Ordem 119 (achado 15) -- vetor RPC do gap de autorizacao por papel. 20260804140100
--     ja trocou o guard de FEATURE (achado 2, user_has_feature_for_ies), mas a AUTORIZACAO de
--     IES nesta funcao ainda e public.user_can_access_ies(v_uid, p_ies_id) /
--     get_accessible_ies(v_uid)[1] no fallback -- o mesmo helper generico que as outras 9 RPCs
--     get_gestor_* usavam e que a verificacao do card 119 identificou como vazamento: um
--     usuario com papel SO 'gestor' (users.id_ies = A) e uma linha orfa em user_groups
--     (residuo de downgrade gestor_grupo -> gestor, que a UI de admin permite hoje sem limpar
--     user_groups) passa em user_can_access_ies para a IES B do grupo antigo, porque
--     get_accessible_ies e a UNIAO de users.id_ies com TODO grupo em que o usuario aparece em
--     user_groups, sem olhar o papel. Um POST direto em
--     /rest/v1/rpc/get_gestor_cronograma com p_ies_id = B devolveria o cronograma de
--     contrato/simulados da IES B para quem a UI diz que nao troca de IES. Fechado troc
--     ando a autorizacao por public.gestor_pode_acessar_ies(v_ies) -- funcao nova, aditiva, de
--     20260804160000, que para papel 'gestor' usa SOMENTE users.id_ies, nunca
--     get_accessible_ies. Ver "COMO CONSUMIR NAS 10 RPCs" naquele arquivo para o preambulo
--     completo e a justificativa de por que a troca so NEGA casos, nunca LIBERA um caso hoje
--     negado.
--
-- (2) Card Ordem 114 (achado 10), gap remanescente -- "participantes de prova aberta". A
--     revisao independente confirmou que a precedencia de datas do achado 10 foi corrigida em
--     20260804140100 (a prova online aberta com 276 respondentes deixou de sair como
--     'processing' e passou a sair como 'agendado'/'reagendado', que e o estado correto
--     enquanto ela nao encerra por status/data) MAS achou que o SEGUNDO checkbox do card --
--     "participantes desse simulado aparecem no cronograma enquanto ele esta aberto, nao fica
--     null" -- continuava nao atendido: em 20260804140100, a CTE `itens` so expunha
--     `participantes` quando `status = 'realizado'` (ver os dois CASE em `itens`, um por ramo
--     do UNION ALL). Como a prova aberta agora sai como 'agendado'/'reagendado' (nunca mais
--     'realizado' enquanto nao encerra), o campo `participantes` ficava suprimido para null
--     mesmo com 276 alunos respondendo -- a mesma informacao que a Task 17 do painel ja mostra
--     para o MESMO simulado (ela usa o mesmo fallback via answer_progress). O bug mudou de
--     forma (antes: status errado escondia o dado por tras de 'processing'; depois do achado
--     10: status certo, mas o filtro de exibicao de `participantes` ficou hardcoded em
--     'realizado' e nao acompanhou a mudanca de arvore de decisao). Fechado removendo a
--     amarra a `status = 'realizado'`: `participantes` agora aparece em QUALQUER status,
--     bastando existir pelo menos um registro (n > 0) em simulados_finalizados ou
--     answer_progress -- e continua null (nunca 0) quando nao ha nenhum registro, exatamente
--     como antes (§4.10). `meta.criterio` foi atualizado para descrever a regra nova.
--
-- O QUE NAO MUDA (herdado de 20260804140100, preservado aqui)
-- -------------------------------------------------------------
-- A arvore de decisao do STATUS (achado 10: encerramento so por status/data, participacao
-- nunca decide status) NAO e tocada por esta migration -- so o filtro de EXIBICAO do campo
-- informativo `participantes` muda. A CTE `participacao` (simulados_finalizados UNIAO
-- answer_progress, deduplicada por aluno) continua identica. `meta.fonte` continua incluindo
-- `answer_progress` -- esse trecho e o patch de producao sem .sql no repo (migration
-- 20260729203514, "get_gestor_cronograma_participantes_fallback") que 20260804140100 ja havia
-- reconciliado manualmente; perde-lo aqui apagaria produto. SECURITY DEFINER, SET search_path,
-- STABLE, a assinatura de 1 parametro e os grants tambem sao preservados integralmente.
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv) -- rodar e comparar, ABORTAR se qualquer
-- divergencia aparecer:
--
--   -- (a) o corpo hoje em producao deve ser exatamente o de 20260804140100 (o ponto de
--   --     partida assumido aqui). Se divergir de qualquer forma, investigar antes de seguir:
--   SELECT pg_get_functiondef('public.get_gestor_cronograma(uuid)'::regprocedure);
--
--   -- (b) a dependencia precisa existir E bater com 20260804160000 -- sem isso, esta migration
--   --     nao pode ser aplicada (a chamada a gestor_pode_acessar_ies falharia em runtime):
--   SELECT pg_get_functiondef('public.gestor_pode_acessar_ies(uuid)'::regprocedure);
--
--   -- (c) sanidade das funcoes de que o fallback de v_ies continua dependendo (nao alteradas
--   --     por este arquivo, so lidas):
--   SELECT pg_get_functiondef('public.get_accessible_ies(uuid)'::regprocedure);
--   SELECT pg_get_functiondef('public.user_has_feature_for_ies(text, uuid)'::regprocedure);
--
CREATE OR REPLACE FUNCTION public.get_gestor_cronograma(p_ies_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_ies    uuid;
  v_result jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- resolucao de v_ies (ainda NAO autoriza -- ver achado 15/card 119)
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

  -- autorizacao da IES RESOLVIDA, por papel (achado 15/card 119 -- troca de
  -- user_can_access_ies por gestor_pode_acessar_ies, que para 'gestor' puro usa SOMENTE
  -- users.id_ies, nunca get_accessible_ies; uma linha orfa em user_groups nao amplia mais o
  -- acesso de quem a UI diz que nao troca de IES). Ver 20260804160000_gestor_pode_acessar_ies.sql.
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  IF NOT public.user_has_feature_for_ies('gestao.portal_v2', v_ies) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  WITH alunos AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ),
  -- simulados visíveis da IES (pais); cronograma inclui futuros, então NÃO filtra liberacao_desempenho
  sims AS (
    SELECT sa.id,
           sa.nome,
           sa.modalidade,
           sa.status,
           sa.data_encerramento,
           COALESCE(sa.data_realizacao, sa.data_liberacao) AS data_efetiva,
           sa.data_agendada_original
    FROM public.simulados_admin sa
    WHERE v_ies = ANY (sa.ies_ids)
      AND sa.simulado_pai_id IS NULL
      AND lower(sa.status) NOT IN ('rascunho','draft','arquivado','cancelado')
  ),
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  -- Participacao = simulados_finalizados UNIAO answer_progress. Alimenta o campo informativo
  -- `participantes`, exibido agora em QUALQUER status com pelo menos um registro (gap 114 --
  -- antes so aparecia com status = 'realizado', o que escondia o dado de uma prova aberta
  -- ainda sendo respondida). NAO decide o status (achado 10, inalterado por esta migration --
  -- ver a CASE de sim_status abaixo). O fallback answer_progress NAO e redundancia:
  -- simulados_finalizados esta populada para apenas 20 simulados e 9 IES, enquanto
  -- answer_progress cobre todas. Sem ele, um simulado com 276 respondentes reportaria 0
  -- participantes -- violando "nunca zero onde nao ha dado" (§4.10) e divergindo do numero
  -- que a Task 17 devolve para o MESMO simulado (ela ja usa esse fallback via `ultima_fb`). O
  -- UNION deduplica o par (pai_id, user_id), entao a contagem e de alunos distintos, nao de
  -- linhas.
  participacao AS (
    SELECT p.pai_id, count(DISTINCT p.user_id) AS n
    FROM (
      SELECT g.pai_id, sf.user_id
      FROM public.simulados_finalizados sf
      JOIN grupo g ON g.simulado_id = sf.simulado_id
      WHERE sf.user_id IN (SELECT id FROM alunos)
      UNION
      SELECT g.pai_id, ap.user_id
      FROM public.answer_progress ap
      JOIN grupo g ON g.simulado_id = ap.simulado
      WHERE ap.user_id IN (SELECT id FROM alunos)
    ) p
    GROUP BY p.pai_id
  ),
  com_tri AS (
    SELECT DISTINCT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.resultados_ies_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
  ),
  sim_status AS (
    SELECT s.id, s.nome, s.modalidade, s.data_efetiva,
           COALESCE(p.n, 0) AS participantes,
           CASE
             -- Encerramento decidido SÓ por status/data (achado 10) -- participação (p.n) não
             -- entra aqui: uma prova aberta sendo respondida não é uma prova encerrada.
             WHEN (lower(s.status) = 'encerrado'
                   OR (s.data_encerramento IS NOT NULL AND s.data_encerramento < now()))
                  AND EXISTS (SELECT 1 FROM com_tri c WHERE c.pai_id = s.id)
               THEN 'realizado'
             WHEN lower(s.status) = 'encerrado'
                  OR (s.data_encerramento IS NOT NULL AND s.data_encerramento < now())
               THEN 'processing'
             WHEN s.data_efetiva IS NULL THEN 'previsto'
             WHEN s.data_agendada_original IS NOT NULL
                  AND s.data_agendada_original <> s.data_efetiva THEN 'reagendado'
             ELSE 'agendado'
           END AS status
    FROM sims s
    LEFT JOIN participacao p ON p.pai_id = s.id
  ),
  slots AS (
    SELECT sp.id        AS slot_id,
           sp.ordem     AS ordem,
           sp.nome_previsto,
           sp.simulado_id
    FROM public.ies_simulado_previsto sp
    WHERE sp.ies_id = v_ies
  ),
  itens AS (
    -- slots do contrato (com ou sem simulado vinculado)
    SELECT COALESCE(ss.id, sl.slot_id)                       AS id,
           COALESCE(ss.nome, sl.nome_previsto, 'A definir')  AS nome,
           ss.data_efetiva                                   AS data,
           COALESCE(ss.status, 'previsto')                   AS status,
           ss.modalidade                                     AS modalidade,
           -- gap 114: participantes aparece em QUALQUER status com pelo menos um registro --
           -- inclui a prova aberta ainda sendo respondida, não só 'realizado'. 0 vira NULL,
           -- porque zero aqui significa "sem dado", não "ninguém compareceu" (§4.10).
           CASE WHEN ss.participantes > 0
                THEN ss.participantes END                    AS participantes,
           sl.ordem                                          AS ordem
    FROM slots sl
    LEFT JOIN sim_status ss ON ss.id = sl.simulado_id
    UNION ALL
    -- simulados reais da IES que não estão em nenhum slot
    SELECT ss.id, ss.nome, ss.data_efetiva, ss.status, ss.modalidade,
           CASE WHEN ss.participantes > 0
                THEN ss.participantes END,
           NULL::int
    FROM sim_status ss
    WHERE NOT EXISTS (SELECT 1 FROM slots sl WHERE sl.simulado_id = ss.id)
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',          i.id,
               'nome',        i.nome,
               'data',        CASE WHEN i.data IS NULL THEN NULL
                                   ELSE to_char(i.data AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') END,
               'status',      i.status,
               'modalidade',  i.modalidade,
               'participantes', i.participantes,
               'indisponivelPorque', CASE
                                       WHEN i.status = 'previsto'   THEN 'Data a definir pela Sanar'
                                       WHEN i.status = 'processing' THEN 'Gabarito em processamento'
                                       ELSE NULL
                                     END
             ) ORDER BY i.data NULLS LAST, i.ordem NULLS LAST, i.nome)
      FROM itens i
    ), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((
                        SELECT to_char(c.vigencia_inicio,'DD/MM/YYYY') || ' — ' || to_char(c.vigencia_fim,'DD/MM/YYYY')
                        FROM public.ies_contrato_simulados c
                        WHERE c.ies_id = v_ies
                        ORDER BY (current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim) DESC, c.vigencia_fim DESC
                        LIMIT 1
                      ), 'sem contrato cadastrado'),
      'fonte',        'ies_contrato_simulados · ies_simulado_previsto · simulados_admin · simulados_finalizados · answer_progress · resultados_ies_tri',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     'Encerramento decidido só por status=encerrado ou data_encerramento passada (nunca por participação: uma prova aberta sendo respondida não é uma prova encerrada). realizado = encerrado E tem linha em resultados_ies_tri; processing = encerrado sem TRI ainda; reagendado = data futura cuja data_agendada_original difere da data efetiva; agendado = data futura sem reagendamento (ou dentro da janela, sem sinal de encerramento); previsto = slot sem simulado ou simulado sem data. Data efetiva = data_realizacao (presencial) ou data_liberacao (online). Participantes = alunos distintos da IES (sem role em user_roles) com registro em simulados_finalizados ou em answer_progress, exibido em qualquer status havendo pelo menos um registro -- inclui prova aberta ainda sendo respondida, não só a realizada; null quando não há nenhum registro, nunca 0.',
      'partial',      (SELECT count(*) FROM itens WHERE status IN ('previsto','processing')) > 0,
      'lowSample',    false
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_cronograma(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_cronograma(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_gestor_cronograma(uuid) IS
'Cronograma de simulados contratados do Portal do Gestor v2. Guard de feature por IES via user_has_feature_for_ies (achado 2, herdado de 20260804140100). Autorizacao de IES via gestor_pode_acessar_ies -- gestor puro usa SOMENTE users.id_ies, nunca get_accessible_ies, entao uma linha orfa em user_groups (residuo de downgrade gestor_grupo->gestor) nao amplia mais o acesso (achado 15/card 119, gap fechado nesta migration). Encerramento (que decide entre realizado/processing e os ramos de data) depende só de status/data, nunca de participação -- uma prova aberta sendo respondida não conta como encerrada (achado 10, herdado). Participantes aparece em qualquer status com pelo menos um registro, incluindo prova aberta ainda sendo respondida -- não fica mais preso a status=realizado (achado 10/card 114, gap fechado nesta migration); continua null, nunca 0, quando não há registro. meta.fonte inclui answer_progress, patch de produção reconciliado em 20260804140100 e preservado aqui. Revisão de 03/08 + verificação independente de gaps.';

-- ---------------------------------------------------------------------------
-- VERIFICACAO -- rodar manualmente em gvqv, autenticado como o gestor/gestor_grupo
-- do cenario (nao como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
--
-- 1) Readback -- confirma que a versao aplicada e esta (comparar corpo e comentario):
--
--    SELECT pg_get_functiondef('public.get_gestor_cronograma(uuid)'::regprocedure);
--    SELECT obj_description('public.get_gestor_cronograma(uuid)'::regprocedure);
--
-- 2) Achado 15/card 119 -- gestor puro com user_groups orfao (:uid, users.id_ies = :ies_a,
--    linha em user_groups cobrindo :ies_a E :ies_b) nao alcanca mais a IES do grupo antigo:
--
--    SELECT public.user_can_access_ies(:uid::uuid, :ies_b::uuid) AS antigo_libera_b; -- true (o gap)
--    SELECT public.gestor_pode_acessar_ies(:ies_b::uuid)         AS novo_nega_b;      -- false
--    SELECT public.get_gestor_cronograma(:ies_b::uuid);
--    -- ESPERADO: EXCEPTION 'Permission denied: cannot access this IES'
--    SELECT (public.get_gestor_cronograma(:ies_a::uuid) -> 'data') IS NOT NULL AS ies_a_responde;
--    -- ESPERADO: true (IES da propria conta continua servindo dado)
--
-- 3) Achado 2 -- guard de feature por IES ainda vale (:ies_c ligada, :ies_d desligada, mesmo
--    grupo, gestor_grupo com users.id_ies NULL):
--
--    SELECT public.get_gestor_cronograma(:ies_d::uuid);
--    -- ESPERADO: exception 'feature_not_enabled' (ERRCODE 42501)
--
-- 4) Achado 10 (regressao, herdado de 20260804140100), em transação revertida. Escolher um
--    simulado :sim_aberto ONLINE cuja data_efetiva já passou mas que NÃO está encerrado
--    (status <> 'encerrado' e data_encerramento nula ou futura), com pelo menos uma linha em
--    answer_progress (aluno que só começou a responder):
--
--    BEGIN;
--      SELECT i ->> 'status' AS status
--      FROM jsonb_array_elements(public.get_gestor_cronograma(:ies_id::uuid) -> 'data') i
--      WHERE (i ->> 'id') = :sim_aberto::text;
--      -- ESPERADO: status IN ('agendado','reagendado') -- NUNCA 'processing' nem 'realizado'.
--    ROLLBACK;
--
-- 5) Gap 114 -- participantes da prova aberta do passo 4 NAO fica mais null (o gap desta
--    migration), na MESMA transação/cenario do passo 4:
--
--    BEGIN;
--      SELECT i ->> 'status' AS status, i ->> 'participantes' AS participantes
--      FROM jsonb_array_elements(public.get_gestor_cronograma(:ies_id::uuid) -> 'data') i
--      WHERE (i ->> 'id') = :sim_aberto::text;
--      -- ESPERADO: status IN ('agendado','reagendado') E participantes = '276' (texto do
--      -- jsonb), NAO null -- antes desta migration, participantes vinha null porque o filtro
--      -- de exibicao exigia status = 'realizado'.
--    ROLLBACK;
--
-- 6) Nunca zero onde nao ha dado -- um simulado futuro (data_efetiva no futuro, sem NENHUM
--    registro em simulados_finalizados/answer_progress) continua com participantes = null,
--    nao 0:
--
--    SELECT i ->> 'status' AS status, i -> 'participantes' AS participantes
--    FROM jsonb_array_elements(public.get_gestor_cronograma(:ies_id::uuid) -> 'data') i
--    WHERE (i ->> 'id') = :sim_futuro_sem_participacao::text;
--    -- ESPERADO: participantes IS NULL (jsonb null), nunca 0.
--
-- 7) Nao-regressao gestor_grupo e admin (autenticados como cada papel, sobre :ies_b):
--
--    SELECT (public.get_gestor_cronograma(:ies_b::uuid) -> 'data') IS NOT NULL; -- true nos dois
--
-- 8) meta.fonte preserva answer_progress (regressao do patch de producao reconciliado em
--    20260804140100) e meta.criterio descreve a regra nova de participantes:
--
--    SELECT (public.get_gestor_cronograma(:ies_a::uuid) -> 'meta' ->> 'fonte') LIKE '%answer_progress%' AS fonte_ok,
--           (public.get_gestor_cronograma(:ies_a::uuid) -> 'meta' ->> 'criterio') LIKE '%prova aberta%' AS criterio_ok;
--    -- ESPERADO: as duas true.
