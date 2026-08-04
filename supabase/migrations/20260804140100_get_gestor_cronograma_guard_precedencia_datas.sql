-- 20260804140100_get_gestor_cronograma_guard_precedencia_datas.sql
-- Corrige os achados 2 e 10 da revisão adversarial de 03/08 (cards Ordem 101/114)
-- em public.get_gestor_cronograma.
--
-- PONTO DE PARTIDA
-- ----------------
-- O corpo abaixo parte de supabase/migrations/20260729210100_get_gestor_cronograma.sql -- a UNICA
-- migration desta função no repo. get_gestor_cronograma nasceu com o guard de feature ESCRITO NO
-- CORPO (não injetado dinamicamente como as 19 RPCs institucionais antigas da migration
-- 20260709171344), então partir da migration versionada aqui é seguro.
--
-- EXIGENCIA ANTES DE APLICAR: rodar em produção (projeto gvqv)
--   SELECT pg_get_functiondef('public.get_gestor_cronograma(uuid)'::regprocedure);
-- e comparar o resultado com o corpo de 20260729210100 (o ponto de partida assumido aqui). Se
-- divergir de qualquer forma -- mesmo um espaço --, ABORTAR esta migration e investigar antes de
-- prosseguir: o pressuposto "nasceu com o guard no corpo" deixaria de valer.
--
-- ACHADO 2 -- guard de feature por IES, não por usuário (card 101)
-- ------------------------------------------------------------------
-- Trocado public.user_has_feature('gestao.portal_v2') por
-- public.user_has_feature_for_ies('gestao.portal_v2', v_ies) -- a função nova e aditiva de
-- 20260804120000_user_has_feature_for_ies.sql. O guard antigo checava a feature contra TODAS as
-- IES acessíveis pelo usuário (bool_or via get_accessible_ies dentro de user_has_feature), então
-- uma IES do grupo com o portal ligado liberava as irmãs desligadas.
--
-- ARMADILHA EVITADA: user_has_feature_for_ies é fail-closed para p_ies_id NULL, e p_ies_id chega
-- NULL sempre que o gestor não especifica IES (o fallback pega users.id_ies ou a 1ª IES
-- acessível). Por isso o guard NÃO fica mais na primeira linha do BEGIN: foi movido para DEPOIS
-- da resolução de v_ies, e chama com v_ies (a IES que a função vai de fato consultar), nunca com
-- p_ies_id direto. Ordem final do preâmbulo: papel (Access denied) -> user_can_access_ies ->
-- resolução de v_ies -> feature (feature_not_enabled).
--
-- ACHADO 10 -- precedência de decisão, não aritmética (card 114)
-- -------------------------------------------------------------------
-- Antes, o sinal de "encerrado" que decide entre {realizado, processing} e os ramos de data
-- {previsto, reagendado, agendado} era `COALESCE(p.n,0) > 0 OR lower(status)='encerrado' OR
-- data_encerramento < now()`. `p.n` vem de `participacao`, que conta `simulados_finalizados`
-- UNIÃO `answer_progress` -- e `answer_progress` é gravado por quem apenas COMEÇOU a responder,
-- não por quem terminou. Resultado: uma prova ONLINE ABERTA (ainda dentro da janela, não
-- encerrada por data nem por status), sendo respondida "ao vivo" por 276 alunos, tinha
-- `COALESCE(p.n,0) > 0` = true e caía direto no ramo de "encerrado" -- saindo como 'processing'
-- ("Gabarito em processamento") quando na verdade a prova nem fechou.
--
-- CORREÇÃO: `p.n` (participação) deixou de ser sinal de encerramento. Encerramento passa a
-- depender SÓ de `status='encerrado'` ou `data_encerramento < now()` -- exatamente a régua de
-- "realizado" da spec §6.4 ("Existe simulados_finalizados para o simulado, ou data_encerramento
-- < now()"; a extensão por `status='encerrado'` já existia antes deste achado e não foi tocada).
-- Isso é literalmente "as datas vêm antes da participação": só depois de confirmar por data/status
-- que a prova encerrou é que a função decide entre realizado (tem TRI) e processing (não tem
-- ainda); enquanto não encerrou, cai nos ramos de data (previsto/reagendado/agendado),
-- independente de quantos alunos já começaram a responder.
--
-- O QUE NÃO MUDOU: a CTE `participacao` (e seu fallback `answer_progress`) continua exatamente
-- igual -- ela alimenta o campo informativo `participantes` (só exibido quando status =
-- 'realizado', nunca 0, conforme §4.10), e essa contagem não é o que este achado corrige. O que
-- mudou é apenas o papel de `p.n` na ÁRVORE DE DECISÃO do status: de "prova de encerramento" para
-- "não decide encerramento".
--
-- Preservados integralmente: SECURITY DEFINER, SET search_path, STABLE, os guards de papel, a
-- chamada a user_can_access_ies, os grants e a assinatura da função.
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

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_uid, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
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
  -- Participacao = simulados_finalizados UNIAO answer_progress. Alimenta SOMENTE o campo
  -- informativo `participantes` (exibido so quando status = 'realizado'); NAO decide mais o
  -- status (achado 10). O fallback NAO e redundancia: simulados_finalizados esta populada para
  -- apenas 20 simulados e 9 IES, enquanto answer_progress cobre todas. Sem ele, um simulado com
  -- 276 respondentes reportaria 0 participantes -- violando "nunca zero onde nao ha dado" (§4.10)
  -- e divergindo do numero que a Task 17 devolve para o MESMO simulado (ela ja usa esse fallback
  -- via `ultima_fb`). O UNION deduplica o par (pai_id, user_id), entao a contagem e de alunos
  -- distintos, nao de linhas.
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
           -- participantes so existe em 'realizado'; 0 vira NULL, porque zero
           -- aqui significa "sem dado", nao "ninguem compareceu"
           CASE WHEN COALESCE(ss.status,'previsto') = 'realizado' AND ss.participantes > 0
                THEN ss.participantes END                    AS participantes,
           sl.ordem                                          AS ordem
    FROM slots sl
    LEFT JOIN sim_status ss ON ss.id = sl.simulado_id
    UNION ALL
    -- simulados reais da IES que não estão em nenhum slot
    SELECT ss.id, ss.nome, ss.data_efetiva, ss.status, ss.modalidade,
           CASE WHEN ss.status = 'realizado' AND ss.participantes > 0
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
      'fonte',        'ies_contrato_simulados · ies_simulado_previsto · simulados_admin · simulados_finalizados · resultados_ies_tri',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     'Encerramento decidido só por status=encerrado ou data_encerramento passada (nunca por participação: uma prova aberta sendo respondida não é uma prova encerrada). realizado = encerrado E tem linha em resultados_ies_tri; processing = encerrado sem TRI ainda; reagendado = data futura cuja data_agendada_original difere da data efetiva; agendado = data futura sem reagendamento (ou dentro da janela, sem sinal de encerramento); previsto = slot sem simulado ou simulado sem data. Data efetiva = data_realizacao (presencial) ou data_liberacao (online). Participantes = alunos distintos da IES (sem role em user_roles) com registro em simulados_finalizados ou em answer_progress, exibido só quando realizado; null quando não há registro, nunca 0.',
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
'Cronograma de simulados contratados do Portal do Gestor v2. Guard de feature por IES via user_has_feature_for_ies (achado 2). Encerramento (que decide entre realizado/processing e os ramos de data) depende só de status/data, nunca de participação -- uma prova aberta sendo respondida não conta como encerrada (achado 10). Revisão de 03/08.';

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
-- 2) Achado 2 -- guard por IES (:ies_a ligada, :ies_b desligada, mesmo grupo, gestor_grupo com
--    users.id_ies NULL). Ver tambem a verificacao de user_has_feature_for_ies em
--    20260804120000_user_has_feature_for_ies.sql:
--
--    SELECT public.get_gestor_cronograma(:ies_b::uuid);
--    -- ESPERADO: exception 'feature_not_enabled' (ERRCODE 42501)
--    SELECT (public.get_gestor_cronograma(:ies_a::uuid) -> 'data') IS NOT NULL AS ies_a_responde;
--    -- ESPERADO: true (IES ligada continua servindo dado)
--
-- 3) Achado 10, em transação revertida (não deixa dado de teste em gvqv). Escolher um simulado
--    :sim_aberto ONLINE de uma IES com contrato, cuja data_efetiva já passou mas que NÃO está
--    encerrado (status <> 'encerrado' e data_encerramento nula ou futura), e que tenha pelo menos
--    uma linha em answer_progress (aluno que só começou a responder):
--
--    BEGIN;
--      -- Confirma o cenario antes da correção seria classificado por engano como 'processing':
--      -- SELECT status, data_encerramento FROM simulados_admin WHERE id = :sim_aberto;
--      -- (status deve ser diferente de 'encerrado', data_encerramento deve ser NULL ou futura)
--      -- SELECT count(DISTINCT user_id) FROM answer_progress WHERE simulado = :sim_aberto;
--      -- (deve ser > 0 -- é o "276 alunos respondendo" do achado)
--
--      SELECT i ->> 'status' AS status, i ->> 'participantes' AS participantes
--      FROM jsonb_array_elements(public.get_gestor_cronograma(:ies_id::uuid) -> 'data') i
--      WHERE (i ->> 'id') = :sim_aberto::text;
--      -- ESPERADO: status IN ('agendado','reagendado') -- NUNCA 'processing' nem 'realizado'
--      -- enquanto a prova não encerrar por status/data, independente de quantos já responderam.
--    ROLLBACK;
