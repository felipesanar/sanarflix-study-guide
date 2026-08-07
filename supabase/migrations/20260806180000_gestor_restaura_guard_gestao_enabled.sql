-- Lote D (06/08): restaura o guard de feature 'gestao.enabled' (master) nas
-- 11 RPCs get_gestor_*, sem trazer de volta 'gestao.portal_v2'.
--
-- O QUE ACONTECEU
-- ----------------
-- A migration 20260806144647 (GA total) removeu do banco o guard de feature
-- 'gestao.portal_v2' das 11 RPCs do gestor -- remocao intencional e
-- ratificada, o portal v2 vale para todo mundo sem checagem de feature no
-- front nem no banco. O efeito colateral que ninguem viu: o guard removido
-- era
--
--   IF NOT public.user_has_feature_for_ies('gestao.portal_v2', v_ies) THEN
--     RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
--   END IF;
--
-- e public.user_has_feature_for_ies (20260804120000_user_has_feature_for_ies.sql,
-- linhas 67-80) embute o master: antes de olhar a chave especifica, ela exige
-- que 'gestao.enabled' esteja ligada para aquela IES. Tirar a checagem de
-- portal_v2 levou junto a checagem de modulo contratado -- que nao estava no
-- escopo da limpeza e e o interruptor mestre do produto. Hoje as 14 IES tem
-- gestao.enabled = true, sem exposicao real, mas o servidor deixou de validar
-- modulo contratado e o controle virou so comercial.
--
-- A CORRECAO -- SOMENTE gestao.enabled volta
-- --------------------------------------------
-- Decisao do Felipe (06/08): restaurar SOMENTE o guard de 'gestao.enabled'.
-- 'gestao.portal_v2' e as 5 chaves por modulo (gestao.visao_institucional,
-- gestao.diagnostico_curricular, gestao.alunos, gestao.insights_pedagogicos,
-- gestao.inteligencia_decisoria) continuam mortas e apagadas -- nao
-- reintroduzidas aqui, nem em feature_catalog/ies_features.
--
-- Esta migration recria as 11 RPCs por inteiro, usando como base o corpo
-- vigente de cada uma (a mais recente que a recria: 20260806144647 para dez
-- delas; 20260806170000_get_gestor_detalhamento_alunos.sql para
-- get_gestor_detalhamento, que ja tinha sido recriada depois de 144647 para
-- emitir a chave 'alunos' -- usar o corpo de 144647 para essa funcao
-- reverteria aquele fix em silencio). A UNICA diferenca introduzida em cada
-- corpo e o bloco de guard abaixo; nenhuma outra linha muda.
--
-- A ARMADILHA DE POSICAO -- JA REGREDIU ANTES, NAO REPETIR
-- -----------------------------------------------------------
-- O guard NAO pode ser a primeira instrucao do BEGIN nem vir antes da
-- resolucao de v_ies: p_ies_id e opcional, e ha um fallback que resolve
-- v_ies a partir de users.id_ies ou de get_accessible_ies(v_uid)[1] quando
-- p_ies_id vem NULL. Como user_has_feature_for_ies e fail-closed para
-- p_ies_id/v_ies NULL, um guard cedo faria toda chamada sem IES explicita
-- estourar 'feature_not_enabled' -- regressao documentada em
-- 20260804120000_user_has_feature_for_ies.sql:99-127. Nas 10 RPCs que
-- resolvem v_ies (todas exceto get_gestor_contexto), o guard fica DEPOIS do
-- bloco IF p_ies_id IS NOT NULL ... ELSE ... END IF, depois do IF v_ies IS
-- NULL THEN RAISE ... END IF, e depois da autorizacao por IES
-- (gestor_pode_acessar_ies ou, em get_gestor_aluno_contato, o IF combinado
-- que ja checa v_ies IS NULL). Nunca passa p_ies_id para a helper, sempre
-- v_ies.
--
-- get_gestor_contexto E DIFERENTE: nao recebe p_ies_id (enumera as IES do
-- switcher, nao le dado de uma IES so -- excecao ja documentada em
-- 20260804120000_user_has_feature_for_ies.sql:124-127 para 'gestao.portal_v2',
-- aqui repetida para 'gestao.enabled'). Guard logo apos o Access denied
-- inicial, via public.user_has_feature('gestao.enabled') (bool_or sobre as
-- IES acessiveis) -- nao a variante _for_ies, que exige uma IES so. Efeito:
-- um gestor_grupo com ao menos uma IES contratada carrega o contexto e e
-- bloqueado nas outras 10 RPCs ao escolher uma IES sem contrato.
--
-- get_gestor_aluno_contato tambem nao recebe p_ies_id (recebe p_aluno_id);
-- v_ies vem de users.id_ies DO ALUNO, nao de um parametro do chamador. O
-- guard entra do mesmo jeito, depois do IF v_ies IS NULL OR NOT
-- gestor_pode_acessar_ies(v_ies) THEN ... END IF que ja resolve e autoriza
-- essa IES.
--
-- RESTRICOES DESTA MIGRATION
-- ---------------------------
-- Aditiva: so CREATE OR REPLACE FUNCTION das 11 RPCs, nenhum DROP. Nao
-- recria public.user_has_feature_for_ies nem public.user_has_feature -- a
-- segunda e compartilhada com 19 RPCs legadas e seu corpo real nao existe em
-- nenhum .sql do repo (guard injetado pela migration 20260709171344); um
-- CREATE OR REPLACE nela apagaria esse guard em silencio. Nao reintroduz
-- 'gestao.portal_v2' nem as 5 chaves por modulo em feature_catalog/
-- ies_features -- essas seguem apagadas pela 20260806144647.
--
-- STATUS DE APLICACAO -- NAO CONFUNDIR ARQUIVO COM BANCO
-- ---------------------------------------------------------
-- Esta migration NAO FOI APLICADA em producao ainda (escrita em 06/08/2026).
-- Neste repositorio o banco nao sobe por push/deploy automatico -- DDL vai
-- por um caminho manual, separado do deploy do front. Ate a aplicacao
-- acontecer de verdade, o servidor CONTINUA sem validar 'gestao.enabled'
-- nas 11 RPCs do gestor, exatamente como a 20260806144647 deixou. Quem ler
-- este arquivo e concluir que o guard ja esta ativo em producao esta lendo
-- o repo, nao o banco -- confirme o estado real antes de assumir qualquer
-- coisa sobre modulo contratado.
--
-- A ARMADILHA QUE JA ACONTECEU UMA VEZ -- NAO REPETIR UMA TERCEIRA
-- --------------------------------------------------------------------
-- Foi um CREATE OR REPLACE FUNCTION (a propria 20260806144647, ao limpar
-- 'gestao.portal_v2') que apagou este guard em silencio, sem intencao,
-- porque o guard vive DENTRO do corpo de cada uma das 11 funcoes, nao numa
-- trigger ou policy separada que sobreviveria a um CREATE OR REPLACE. Quem
-- recriar qualquer uma das 11 RPCs get_gestor_* (get_gestor_contexto,
-- get_gestor_aluno_contato, e as outras 9 listadas nesta migration) por
-- QUALQUER motivo -- fix, feature nova, refactor -- precisa reinserir este
-- mesmo bloco de guard 'gestao.enabled' no novo corpo, ou ele desaparece de
-- novo sem nenhum erro, nenhum teste de tipo, nada que avise em compile-time.

CREATE OR REPLACE FUNCTION public.get_gestor_contexto()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_papel     text;
  v_ies_list  uuid[];
  v_ies_atual uuid;
  v_result    jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Lote D (06/08): restaura SOMENTE o guard de 'gestao.enabled' (master),
  -- removido por engano junto com 'gestao.portal_v2' na migration
  -- 20260806144647 (GA total). get_gestor_contexto nao recebe p_ies_id
  -- (enumera as IES do switcher, nao le dado de uma IES so), por isso usa
  -- user_has_feature (bool_or sobre as IES acessiveis), nao a variante
  -- _for_ies -- mesmo padrao ja documentado para 'gestao.portal_v2' em
  -- 20260804120000_user_has_feature_for_ies.sql:124-127. Um gestor_grupo com
  -- ao menos uma IES contratada carrega o contexto e e bloqueado nas 10 RPCs
  -- de dado ao escolher uma IES sem contrato.
  IF NOT public.user_has_feature('gestao.enabled') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF has_role(v_uid,'admin'::app_role) THEN
    v_papel := 'admin';
  ELSIF has_role(v_uid,'gestor_grupo'::app_role) THEN
    v_papel := 'gestor_grupo';
  ELSE
    v_papel := 'gestor';
  END IF;

  IF v_papel = 'admin' THEN
    SELECT COALESCE(array_agg(i.id ORDER BY i.nome), ARRAY[]::uuid[])
      INTO v_ies_list
    FROM public.ies i;
  ELSIF v_papel = 'gestor_grupo' THEN
    v_ies_list := COALESCE(public.get_accessible_ies(v_uid), ARRAY[]::uuid[]);
  ELSE
    -- papel = 'gestor': nunca pode trocar de IES (podeTrocarIes abaixo), logo
    -- iesDisponiveis so pode conter a IES do proprio cadastro. NUNCA
    -- get_accessible_ies aqui -- ver "O DEFEITO" no topo: um gestor puro pode
    -- estar (erroneamente ou nao) inscrito num user_groups multi-IES, e isso
    -- nao deve vazar para o payload de quem nao pode trocar.
    SELECT COALESCE(array_agg(u.id_ies), ARRAY[]::uuid[])
      INTO v_ies_list
    FROM public.users u
    WHERE u.id = v_uid AND u.id_ies IS NOT NULL;
  END IF;

  SELECT u.id_ies INTO v_ies_atual FROM public.users u WHERE u.id = v_uid;
  IF v_ies_atual IS NULL THEN
    v_ies_atual := v_ies_list[1];
  END IF;
  IF v_ies_atual IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'usuario', jsonb_build_object(
        'id',    v_uid,
        'nome',  COALESCE((SELECT u.nome FROM public.users u WHERE u.id = v_uid), 'Usuário'),
        'papel', v_papel
      ),
      'iesDisponiveis', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome) ORDER BY i.nome)
        FROM public.ies i
        WHERE i.id = ANY (v_ies_list)
      ), '[]'::jsonb),
      'iesAtual', (
        SELECT jsonb_build_object('id', i.id, 'nome', i.nome)
        FROM public.ies i WHERE i.id = v_ies_atual
      ),
      'contrato', (
        SELECT jsonb_build_object(
                 'nome',                 c.nome_contrato,
                 'simuladosContratados', c.simulados_contratados,
                 'vigencia',             to_char(c.vigencia_inicio,'DD/MM/YYYY') || ' — ' || to_char(c.vigencia_fim,'DD/MM/YYYY')
               )
        FROM public.ies_contrato_simulados c
        WHERE c.ies_id = v_ies_atual
        ORDER BY (current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim) DESC,
                 c.vigencia_fim DESC
        LIMIT 1
      ),
      'podeTrocarIes', (v_papel IN ('admin','gestor_grupo')),
      'podeExportar',  true
    ),
    'meta', jsonb_build_object(
      'periodo',     COALESCE((
                       SELECT to_char(c.vigencia_inicio,'DD/MM/YYYY') || ' — ' || to_char(c.vigencia_fim,'DD/MM/YYYY')
                       FROM public.ies_contrato_simulados c
                       WHERE c.ies_id = v_ies_atual
                       ORDER BY (current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim) DESC, c.vigencia_fim DESC
                       LIMIT 1
                     ), 'sem contrato cadastrado'),
      'fonte',       'users · user_roles · ies · educational_groups · ies_contrato_simulados',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',    'Papel derivado de user_roles (admin > gestor_grupo > gestor). IES disponíveis: todas para admin; get_accessible_ies (IES do grupo) para gestor_grupo; SOMENTE users.id_ies do próprio usuário para gestor puro, que nunca pode trocar de IES. Contrato: o vigente na data de hoje; se não houver vigente, o de vigência mais recente. podeExportar é true para os três papéis do portal.',
      'partial',     false,
      'lowSample',   false
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_gestor_cronograma(p_ies_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Lote D (06/08): restaura SOMENTE o guard de 'gestao.enabled' (master),
  -- removido por engano junto com 'gestao.portal_v2' na migration
  -- 20260806144647 (GA total). Fica DEPOIS da resolucao de v_ies e da
  -- autorizacao por IES -- nunca antes, pois a helper e fail-closed para
  -- p_ies_id NULL (armadilha documentada em
  -- 20260804120000_user_has_feature_for_ies.sql:99-127). 'gestao.portal_v2'
  -- e as 5 chaves por modulo continuam mortas, nao voltam aqui.
  IF NOT public.user_has_feature_for_ies('gestao.enabled', v_ies) THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.get_gestor_avisos(p_ies_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- resolucao de v_ies (ainda NAO autoriza -- ver "A CORRECAO" no cabecalho)
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

  -- autorizacao da IES RESOLVIDA, por papel (gap 119: gestor puro so acessa
  -- users.id_ies, nunca get_accessible_ies, mesmo com user_groups orfao)
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  -- Lote D (06/08): restaura SOMENTE o guard de 'gestao.enabled' (master),
  -- removido por engano junto com 'gestao.portal_v2' na migration
  -- 20260806144647 (GA total). Fica DEPOIS da resolucao de v_ies e da
  -- autorizacao por IES -- nunca antes, pois a helper e fail-closed para
  -- p_ies_id NULL (armadilha documentada em
  -- 20260804120000_user_has_feature_for_ies.sql:99-127). 'gestao.portal_v2'
  -- e as 5 chaves por modulo continuam mortas, nao voltam aqui.
  IF NOT public.user_has_feature_for_ies('gestao.enabled', v_ies) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  WITH visiveis AS (
    SELECT a.id, a.titulo, a.descricao, a.created_at,
           EXISTS (SELECT 1 FROM public.announcements_viewed av
                   WHERE av.announcement_id = a.id AND av.user_id = v_uid) AS lido
    FROM public.announcements a
    WHERE a.ativo = true
      AND (a.data_expiracao IS NULL OR a.data_expiracao > now())
      AND 'gestor' = ANY (COALESCE(a.publico_alvo, ARRAY['aluno']::text[]))
      AND (
            a.visibilidade = 'todas'
        OR (a.visibilidade = 'seletivo' AND v_ies = ANY (COALESCE(a.ies_selecionadas, ARRAY[]::uuid[])))
        OR (a.visibilidade = 'exceto'   AND NOT (v_ies = ANY (COALESCE(a.ies_excluidas, ARRAY[]::uuid[]))))
      )
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',     v.id,
               'titulo', v.titulo,
               'resumo', CASE WHEN length(v.descricao) > 180
                              THEN left(v.descricao, 180) || '…'
                              ELSE v.descricao END,
               'data',   to_char(v.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
               'lido',   v.lido
             ) ORDER BY v.lido ASC, v.created_at DESC)
      FROM visiveis v
    ), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      'avisos ativos e não expirados',
      'fonte',        'announcements · announcements_viewed',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     'Aviso ativo, não expirado, com ''gestor'' em publico_alvo e visível para a IES pelas regras de visibilidade (todas/seletivo/exceto). semestre_destino é ignorado: gestor não tem semestre. Não lidos primeiro, depois mais recentes.',
      'partial',      false,
      'lowSample',    false
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_gestor_aluno_contato(p_aluno_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_ies      uuid;
  v_telefone text;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_aluno_id IS NULL THEN
    RAISE EXCEPTION 'aluno_obrigatorio' USING ERRCODE = '22023';
  END IF;

  SELECT u.id_ies, u.telefone
    INTO v_ies, v_telefone
  FROM public.users u
  WHERE u.id = p_aluno_id
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id);

  -- GAP 1 (achado 119): trocado de user_can_access_ies(v_uid, v_ies) para
  -- gestor_pode_acessar_ies(v_ies). Mesma posicao, mesma mensagem generica
  -- (aluno_nao_encontrado -- anti-enumeracao preservada), unica troca desta migration.
  IF v_ies IS NULL OR NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'aluno_nao_encontrado' USING ERRCODE = '42501';
  END IF;

  -- Lote D (06/08): restaura SOMENTE o guard de 'gestao.enabled' (master),
  -- removido por engano junto com 'gestao.portal_v2' na migration
  -- 20260806144647 (GA total). Fica DEPOIS da resolucao de v_ies e da
  -- autorizacao por IES -- nunca antes, pois a helper e fail-closed para
  -- p_ies_id NULL (armadilha documentada em
  -- 20260804120000_user_has_feature_for_ies.sql:99-127). 'gestao.portal_v2'
  -- e as 5 chaves por modulo continuam mortas, nao voltam aqui.
  IF NOT public.user_has_feature_for_ies('gestao.enabled', v_ies) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'id',       p_aluno_id,
    'telefone', v_telefone
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_gestor_visao_geral(p_ies_id uuid, p_semestre text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Lote D (06/08): restaura SOMENTE o guard de 'gestao.enabled' (master),
  -- removido por engano junto com 'gestao.portal_v2' na migration
  -- 20260806144647 (GA total). Fica DEPOIS da resolucao de v_ies e da
  -- autorizacao por IES -- nunca antes, pois a helper e fail-closed para
  -- p_ies_id NULL (armadilha documentada em
  -- 20260804120000_user_has_feature_for_ies.sql:99-127). 'gestao.portal_v2'
  -- e as 5 chaves por modulo continuam mortas, nao voltam aqui.
  IF NOT public.user_has_feature_for_ies('gestao.enabled', v_ies) THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.get_gestor_diagnostico(p_ies_id uuid, p_semestre text, p_node text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_ies      uuid;
  v_sems     int[];
  v_recorte  text;
  v_nivel    text;
  v_result   jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- resolucao de v_ies (ainda NAO autoriza -- ver "A CORRECAO" no cabecalho)
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

  -- autorizacao da IES RESOLVIDA, por papel (gap 119: gestor puro so acessa
  -- users.id_ies, nunca get_accessible_ies, mesmo com user_groups orfao)
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  -- Lote D (06/08): restaura SOMENTE o guard de 'gestao.enabled' (master),
  -- removido por engano junto com 'gestao.portal_v2' na migration
  -- 20260806144647 (GA total). Fica DEPOIS da resolucao de v_ies e da
  -- autorizacao por IES -- nunca antes, pois a helper e fail-closed para
  -- p_ies_id NULL (armadilha documentada em
  -- 20260804120000_user_has_feature_for_ies.sql:99-127). 'gestao.portal_v2'
  -- e as 5 chaves por modulo continuam mortas, nao voltam aqui.
  IF NOT public.user_has_feature_for_ies('gestao.enabled', v_ies) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  v_nivel := CASE WHEN p_node IS NULL THEN 'grande_area' ELSE 'especialidade' END;

  WITH sims AS (
    SELECT sa.id
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
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  alunos AS (
    SELECT u.id
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
    SELECT t.user_id, ap.correct, q.grande_area, q.especialidade, q.tema
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
  ),
  base AS (
    SELECT CASE WHEN p_node IS NULL THEN r.grande_area ELSE r.especialidade END AS nome,
           r.user_id, r.correct
    FROM respostas r
    WHERE (p_node IS NULL AND r.grande_area IS NOT NULL)
       OR (p_node IS NOT NULL AND r.grande_area = p_node AND r.especialidade IS NOT NULL)
  ),
  agg AS (
    SELECT b.nome,
           count(*) AS total,
           count(*) FILTER (WHERE b.correct) AS acertos,
           count(DISTINCT b.user_id) AS amostra,
           round(100.0 * count(*) FILTER (WHERE b.correct) / NULLIF(count(*),0), 0) AS acerto_pct
    FROM base b GROUP BY b.nome
  ),
  nos AS (
    SELECT a.nome,
           a.acerto_pct,
           a.amostra,
           -- achado 18: classifica sobre a MESMA base arredondada que sai em
           -- `acertoPct` -- nunca sobre a razão bruta (100.0 * acertos / total).
           CASE WHEN a.total = 0 THEN NULL
                WHEN a.acerto_pct <  30 THEN 'critico'
                WHEN a.acerto_pct >= 80 THEN 'excelente'
                ELSE 'mediano' END AS desempenho,
           CASE
             WHEN p_node IS NULL THEN EXISTS (
               SELECT 1 FROM respostas r2 WHERE r2.grande_area = a.nome AND r2.especialidade IS NOT NULL)
             ELSE EXISTS (
               SELECT 1 FROM respostas r3 WHERE r3.especialidade = a.nome AND r3.tema IS NOT NULL)
           END AS tem_filhos
    FROM agg a
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',         n.nome,
               'nome',       n.nome,
               'nivel',      v_nivel,
               'acertoPct',  n.acerto_pct,
               'desempenho', n.desempenho,
               'amostra',    n.amostra,
               'lowSample',  (n.amostra < 10),
               'temFilhos',  n.tem_filhos
             ) ORDER BY n.acerto_pct NULLS LAST, n.nome)
      FROM nos n), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      'todos os simulados com desempenho liberado para a IES',
      'fonte',        'answer_progress · questoes_simulado · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Desempenho em %% de acerto (crítico < 30, mediano 30–80, excelente >= 80) sobre o mesmo valor arredondado exposto em acertoPct, calculado a partir da última tentativa de cada aluno, questão anulada ignorada. Nível retornado: %s. Amostra = alunos distintos com resposta no nó; lowSample quando < 10. Recorte: %s.', v_nivel, v_recorte),
      'partial',      (SELECT count(*) FROM respostas r WHERE r.grande_area IS NULL) > 0,
      'lowSample',    COALESCE((SELECT max(n.amostra) FROM nos n), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_gestor_diagnostico_temas(p_ies_id uuid, p_semestre text, p_especialidade text, p_grande_area text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_ies     uuid;
  v_sems    int[];
  v_recorte text;
  v_result  jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_especialidade IS NULL OR btrim(p_especialidade) = '' THEN
    RAISE EXCEPTION 'especialidade_obrigatoria' USING ERRCODE = '22023';
  END IF;

  -- string vazia equivale a "grande área não informada" -- mesmo tratamento
  -- de 20260804132000, preservado. A diferença é o que acontece a seguir:
  -- antes, NULL era um valor válido (comportamento ambíguo); agora, NULL é
  -- rejeitado (ver "GAP 1 -- CARD 115" no cabeçalho).
  IF p_grande_area IS NOT NULL AND btrim(p_grande_area) = '' THEN
    p_grande_area := NULL;
  END IF;

  -- gap 115: escopo por grande área deixou de ser opcional na prática.
  -- Sem ele, a mesma especialidade cadastrada em duas grandes áreas somaria
  -- temas das duas -- o bug que 20260804132000 corrigiu no SQL mas que
  -- continuava se manifestando porque nenhum chamador enviava o parâmetro.
  IF p_grande_area IS NULL THEN
    RAISE EXCEPTION 'grande_area_obrigatoria' USING ERRCODE = '22023';
  END IF;

  -- resolucao de v_ies (ainda NAO autoriza -- ver "GAP 2 -- CARD 119" no
  -- cabecalho)
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

  -- autorizacao da IES RESOLVIDA, por papel (gap 119: gestor puro so acessa
  -- users.id_ies, nunca get_accessible_ies, mesmo com user_groups orfao)
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  -- Lote D (06/08): restaura SOMENTE o guard de 'gestao.enabled' (master),
  -- removido por engano junto com 'gestao.portal_v2' na migration
  -- 20260806144647 (GA total). Fica DEPOIS da resolucao de v_ies e da
  -- autorizacao por IES -- nunca antes, pois a helper e fail-closed para
  -- p_ies_id NULL (armadilha documentada em
  -- 20260804120000_user_has_feature_for_ies.sql:99-127). 'gestao.portal_v2'
  -- e as 5 chaves por modulo continuam mortas, nao voltam aqui.
  IF NOT public.user_has_feature_for_ies('gestao.enabled', v_ies) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  WITH sims AS (
    SELECT sa.id
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
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  alunos AS (
    SELECT u.id
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
  temas AS (
    SELECT q.tema AS nome,
           count(*) AS total,
           count(*) FILTER (WHERE ap.correct) AS acertos,
           count(DISTINCT t.user_id) AS amostra
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
      AND q.especialidade = p_especialidade
      -- gap 115: p_grande_area agora é sempre NOT NULL neste ponto (a
      -- exceção acima já teria interrompido a função). Filtro direto, sem
      -- o "OR" permissivo que existia em 20260804132000.
      AND q.grande_area = p_grande_area
      AND q.tema IS NOT NULL
    GROUP BY q.tema
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',        t.nome,
               'nome',      t.nome,
               'acertoPct', round(100.0 * t.acertos / NULLIF(t.total,0), 0),
               'amostra',   t.amostra,
               'lowSample', (t.amostra < 10)
             ) ORDER BY round(100.0 * t.acertos / NULLIF(t.total,0), 0) NULLS LAST, t.nome)
      FROM temas t), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      'todos os simulados com desempenho liberado para a IES',
      'fonte',        'answer_progress · questoes_simulado · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Tema em %% de acerto sobre a última tentativa de cada aluno, questão anulada ignorada. Proficiência não se aplica a tema. Especialidade: %s. Grande área de origem: %s. Recorte: %s.', p_especialidade, p_grande_area, v_recorte),
      'partial',      false,
      'lowSample',    COALESCE((SELECT max(t.amostra) FROM temas t), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_gestor_alunos(p_ies_id uuid, p_semestre text, p_page integer, p_page_size integer, p_sort text, p_order text, p_q text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_ies     uuid;
  v_sems    int[];
  v_recorte text;
  v_sort    text;
  v_order   text;
  v_page    int;
  v_size    int;
  v_q       text;
  v_result  jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- resolucao de v_ies (ainda NAO autoriza -- guard vem logo abaixo)
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

  -- autorizacao da IES RESOLVIDA, por papel (achado 15/card 119, substitui
  -- public.user_can_access_ies -- gestor puro so acessa users.id_ies, nunca
  -- get_accessible_ies, mesmo com user_groups orfao). Intocado nesta migration.
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  -- Lote D (06/08): restaura SOMENTE o guard de 'gestao.enabled' (master),
  -- removido por engano junto com 'gestao.portal_v2' na migration
  -- 20260806144647 (GA total). Fica DEPOIS da resolucao de v_ies e da
  -- autorizacao por IES -- nunca antes, pois a helper e fail-closed para
  -- p_ies_id NULL (armadilha documentada em
  -- 20260804120000_user_has_feature_for_ies.sql:99-127). 'gestao.portal_v2'
  -- e as 5 chaves por modulo continuam mortas, nao voltam aqui.
  IF NOT public.user_has_feature_for_ies('gestao.enabled', v_ies) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  v_sort  := lower(COALESCE(NULLIF(btrim(p_sort),''),  'nome'));
  v_order := lower(COALESCE(NULLIF(btrim(p_order),''), 'asc'));
  IF v_sort  NOT IN ('nome','semestre','proficiencia','tendencia') THEN
    RAISE EXCEPTION 'sort_invalido' USING ERRCODE = '22023';
  END IF;
  IF v_order NOT IN ('asc','desc') THEN
    RAISE EXCEPTION 'order_invalido' USING ERRCODE = '22023';
  END IF;
  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_size := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  v_q    := NULLIF(btrim(COALESCE(p_q,'')), '');

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
  alunos AS (
    SELECT u.id, u.nome, u.semestre
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
      AND (v_q IS NULL OR u.nome ILIKE '%' || v_q || '%')
  ),
  tri_raw AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, r.score_proprio
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
      AND r.score_proprio IS NOT NULL
  ),
  tri AS (
    SELECT DISTINCT ON (tr.student_id, tr.pai_id)
           tr.pai_id, tr.student_id, tr.score_proprio
    FROM tri_raw tr
    ORDER BY tr.student_id, tr.pai_id, tr.score_proprio DESC
  ),
  sims_com_tri AS (
    SELECT s.* FROM sims_ord s WHERE EXISTS (SELECT 1 FROM tri t WHERE t.pai_id = s.id)
  ),
  aluno_sim AS (
    SELECT a.id, s.id AS sim_id, s.ord,
           (SELECT avg(t.score_proprio) FROM tri t WHERE t.student_id = a.id AND t.pai_id = s.id) AS score
    FROM alunos a
    CROSS JOIN sims_com_tri s
  ),
  diffs AS (
    SELECT d.id, d.diff
    FROM (
      SELECT s.id, s.score - lag(s.score) OVER (PARTITION BY s.id ORDER BY s.ord) AS diff
      FROM aluno_sim s WHERE s.score IS NOT NULL
    ) d
    WHERE d.diff IS NOT NULL
  ),
  tend AS (
    SELECT x.id,
           CASE WHEN x.subiu AND x.desceu THEN 'alternando'
                WHEN x.subiu             THEN 'subindo'
                WHEN x.desceu             THEN 'descendo'
                ELSE 'estavel' END AS tendencia
    FROM (
      SELECT d.id, bool_or(d.diff > 0) AS subiu, bool_or(d.diff < 0) AS desceu
      FROM diffs d GROUP BY d.id
    ) x
  ),
  agg AS (
    SELECT a.id, a.nome, a.semestre,
           COALESCE((
             SELECT jsonb_agg(
                      jsonb_build_object(
                        'simuladoId', s.sim_id,
                        'valor',      CASE WHEN s.score IS NULL THEN NULL ELSE round(s.score::numeric, 1) END
                      ) ORDER BY s.ord)
             FROM aluno_sim s WHERE s.id = a.id), '[]'::jsonb) AS proficiencias,
           (SELECT count(*) FROM aluno_sim s WHERE s.id = a.id AND s.score IS NOT NULL) AS n_com,
           (SELECT count(*) FROM aluno_sim s WHERE s.id = a.id AND s.score >= 60)       AS n_prof,
           (SELECT s.score FROM aluno_sim s WHERE s.id = a.id AND s.score IS NOT NULL
             ORDER BY s.ord DESC LIMIT 1)                                               AS prof_atual,
           COALESCE((SELECT t.tendencia FROM tend t WHERE t.id = a.id), 'estavel')      AS tendencia
    FROM alunos a
  ),
  linhas AS (
    SELECT g.*,
           CASE WHEN g.n_com = 0                 THEN NULL
                WHEN g.n_prof = g.n_com          THEN 'consistentemente_proficiente'
                WHEN g.n_prof = 0                THEN 'consistentemente_nao_proficiente'
                ELSE 'em_variacao' END AS grupo
    FROM agg g
  ),
  ordenado AS (
    SELECT l.*, row_number() OVER (
             ORDER BY
               CASE WHEN v_sort='semestre'     AND v_order='asc'  THEN l.semestre    END ASC  NULLS LAST,
               CASE WHEN v_sort='semestre'     AND v_order='desc' THEN l.semestre    END DESC NULLS LAST,
               CASE WHEN v_sort='proficiencia' AND v_order='asc'  THEN l.prof_atual  END ASC  NULLS LAST,
               CASE WHEN v_sort='proficiencia' AND v_order='desc' THEN l.prof_atual  END DESC NULLS LAST,
               CASE WHEN v_sort='tendencia'    AND v_order='asc'  THEN l.tendencia   END ASC,
               CASE WHEN v_sort='tendencia'    AND v_order='desc' THEN l.tendencia   END DESC,
               CASE WHEN v_sort='nome'         AND v_order='desc' THEN l.nome        END DESC,
               l.nome ASC
           ) AS rn
    FROM linhas l
  ),
  totais AS (SELECT count(*) AS total FROM linhas)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'data', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'id',            o.id,
                 'nome',          o.nome,
                 'semestre',      o.semestre,
                 'grupo',         o.grupo,
                 'proficiencias', o.proficiencias,
                 'tendencia',     o.tendencia
               ) ORDER BY o.rn)
        FROM ordenado o
        WHERE o.rn > (v_page - 1) * v_size AND o.rn <= v_page * v_size), '[]'::jsonb),
      'page',       v_page,
      'pageSize',   v_size,
      'total',      (SELECT total FROM totais),
      'totalPages', CASE WHEN (SELECT total FROM totais) = 0 THEN 0
                         ELSE ceil((SELECT total FROM totais)::numeric / v_size)::int END
    ),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(min(s.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(s.data_ref),'DD/MM/YYYY')
                                FROM sims_com_tri s), 'sem simulado com resultado'),
      'fonte',        'resultados_alunos_tri · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Uma posição em proficiencias por simulado com TRI na janela, cada posição com o id do simulado (simuladoId) e o valor correspondente (número ou null onde o aluno não participou — nunca 0), em ordem cronológica. Quando o simulado tem 2+ "filhos" (simulados-irmãos) com resultado, considera a MELHOR tentativa do aluno por filho (maior score_proprio), a mesma linha que o detalhamento do aluno mostra. Grupo: sem nenhum resultado de TRI ainda = null (nota chega depois, por pipeline); todas proficientes (>= 60) = consistentemente_proficiente; nenhuma = consistentemente_nao_proficiente; misto = em_variacao. Tendência sobre a janela toda: existe alguma variação consecutiva positiva E alguma negativa = alternando; só positiva = subindo; só negativa = descendo; nenhuma variação diferente de zero (ou menos de dois pontos com resultado) = estável — sem banda morta, qualquer diferença de sinal conta. Ordenação: %s %s. Recorte: %s.', v_sort, v_order, v_recorte),
      'partial',      (SELECT count(*) FROM sims_ord) > (SELECT count(*) FROM sims_com_tri),
      'lowSample',    (SELECT total FROM totais) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_gestor_aluno(p_ies_id uuid, p_aluno_id uuid, p_simulados uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- resolucao de v_ies (ainda NAO autoriza -- ver "(A) ACHADO 15" no cabecalho)
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

  -- autorizacao da IES RESOLVIDA, por papel (achado 15/card 119, substitui
  -- public.user_can_access_ies -- gestor puro so acessa users.id_ies, nunca
  -- get_accessible_ies, mesmo com user_groups orfao).
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  -- Lote D (06/08): restaura SOMENTE o guard de 'gestao.enabled' (master),
  -- removido por engano junto com 'gestao.portal_v2' na migration
  -- 20260806144647 (GA total). Fica DEPOIS da resolucao de v_ies e da
  -- autorizacao por IES -- nunca antes, pois a helper e fail-closed para
  -- p_ies_id NULL (armadilha documentada em
  -- 20260804120000_user_has_feature_for_ies.sql:99-127). 'gestao.portal_v2'
  -- e as 5 chaves por modulo continuam mortas, nao voltam aqui.
  IF NOT public.user_has_feature_for_ies('gestao.enabled', v_ies) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF p_aluno_id IS NULL THEN
    RAISE EXCEPTION 'aluno_obrigatorio' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_aluno_id
      AND u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ) THEN
    RAISE EXCEPTION 'aluno_nao_encontrado' USING ERRCODE = '42501';
  END IF;

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
      AND (p_simulados IS NULL OR array_length(p_simulados,1) IS NULL OR sa.id = ANY (p_simulados))
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
    SELECT u.id, u.nome, u.semestre
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
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
  tri_raw AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, r.score_proprio, r.num_correct
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  -- gap 112: UMA linha por (student_id, pai_id) ANTES de qualquer max/contagem.
  -- Critério de desempate CANÔNICO (igual ao de get_gestor_visao_geral,
  -- 20260804170000, e ao de get_gestor_alunos, 20260804172000): MAIOR
  -- score_proprio por (student_id, pai_id). NULLS LAST é OBRIGATÓRIO aqui
  -- (diferente das outras duas consumidoras do critério): esta função NÃO
  -- filtra score_proprio IS NOT NULL em tri_raw -- precisa preservar a linha
  -- pendente quando é a ÚNICA para aquele (aluno, pai), para não regredir o
  -- achado 4 (aguardando_resultado). Sem NULLS LAST, o padrão do Postgres
  -- para ORDER BY ... DESC é NULLS FIRST, e uma linha NULL "venceria" um
  -- score real do MESMO aluno no MESMO pai_id quando há 2+ linhas -- exatamente
  -- o cenário que este gap precisa fechar sem regredir. Ver bloco "(B) GAP
  -- 112" no cabeçalho para a prova completa.
  tri AS (
    SELECT DISTINCT ON (tr.student_id, tr.pai_id)
           tr.pai_id, tr.student_id, tr.score_proprio, tr.num_correct
    FROM tri_raw tr
    ORDER BY tr.student_id, tr.pai_id, tr.score_proprio DESC NULLS LAST
  ),
  areas_ies AS (
    SELECT q.grande_area AS area,
           count(*) AS total, count(*) FILTER (WHERE ap.correct) AS acertos
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false AND q.grande_area IS NOT NULL
    GROUP BY q.grande_area
  ),
  linha AS (
    SELECT s.id AS pai_id, s.nome, s.data_ref, s.ord,
           EXISTS (SELECT 1 FROM tentativas t WHERE t.user_id = p_aluno_id AND t.pai_id = s.id) AS participou,
           (SELECT count(*) FILTER (WHERE ap.correct)
              FROM tentativas t
              JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
              JOIN public.questoes_simulado q ON q.id = ap.question_id
             WHERE t.user_id = p_aluno_id AND t.pai_id = s.id AND COALESCE(q.anulada,false) = false) AS acertos_calc,
           (SELECT max(tr.score_proprio) FROM tri tr WHERE tr.student_id = p_aluno_id AND tr.pai_id = s.id) AS proficiencia,
           (SELECT count(*) FROM tri tr WHERE tr.pai_id = s.id AND tr.score_proprio IS NOT NULL) AS n_total,
           (SELECT count(*) FROM tri tr WHERE tr.pai_id = s.id AND tr.score_proprio >
                   COALESCE((SELECT max(t2.score_proprio) FROM tri t2 WHERE t2.student_id = p_aluno_id AND t2.pai_id = s.id), -1)) AS n_acima
    FROM sims_ord s
  ),
  linha_var AS (
    SELECT l.*,
           l.proficiencia - lag(l.proficiencia) OVER (ORDER BY l.ord) AS variacao
    FROM linha l
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',           p_aluno_id,
               'nome',         (SELECT a.nome FROM alunos a WHERE a.id = p_aluno_id),
               'semestre',     (SELECT a.semestre FROM alunos a WHERE a.id = p_aluno_id),
               'simuladoId',   lv.pai_id,
               'simuladoNome', lv.nome,
               'simuladoData', to_char(lv.data_ref AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
               'participou',   lv.participou,
               'acertos',      CASE WHEN lv.participou THEN lv.acertos_calc END,
               'proficiencia', CASE WHEN lv.proficiencia IS NULL THEN NULL
                                    ELSE round(lv.proficiencia::numeric, 1) END,
               'situacao',     CASE WHEN NOT lv.participou           THEN 'nao_participou'
                                    WHEN lv.proficiencia IS NULL     THEN 'aguardando_resultado'
                                    WHEN lv.proficiencia >= 60       THEN 'proficiente'
                                    ELSE 'abaixo_do_limiar' END,
               'posicao',      CASE WHEN lv.proficiencia IS NOT NULL AND lv.n_total > 0
                                    THEN jsonb_build_object(
                                           'lugar',     lv.n_acima + 1,
                                           'total',     lv.n_total,
                                           'percentil', round(100.0 * (lv.n_total - lv.n_acima) / lv.n_total, 0))
                               END,
               'acertoPorArea', CASE WHEN lv.participou THEN COALESCE((
                                  SELECT jsonb_agg(jsonb_build_object(
                                           'area',      x.area,
                                           'acertoPct', round(100.0 * x.acertos / NULLIF(x.total,0), 0),
                                           'critica',   COALESCE((SELECT (100.0 * ai.acertos / NULLIF(ai.total,0)) < 30
                                                                  FROM areas_ies ai WHERE ai.area = x.area), false)
                                         ) ORDER BY x.area)
                                  FROM (
                                    SELECT q.grande_area AS area,
                                           count(*) AS total,
                                           count(*) FILTER (WHERE ap.correct) AS acertos
                                    FROM tentativas t
                                    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
                                    JOIN public.questoes_simulado q ON q.id = ap.question_id
                                    WHERE t.user_id = p_aluno_id AND t.pai_id = lv.pai_id
                                      AND COALESCE(q.anulada,false) = false AND q.grande_area IS NOT NULL
                                    GROUP BY q.grande_area
                                  ) x), '[]'::jsonb) END,
               'variacao',     CASE WHEN lv.variacao IS NULL THEN NULL ELSE round(lv.variacao::numeric, 1) END
             ) ORDER BY lv.ord)
      FROM linha_var lv), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(min(s.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(s.data_ref),'DD/MM/YYYY')
                                FROM sims_ord s), 'sem simulado na seleção'),
      'fonte',        'resultados_alunos_tri · answer_progress · questoes_simulado · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',    'Proficiência = score_proprio (0–100); proficiente >= 60. Quando o simulado tem 2+ "filhos" (simulados-irmãos) com resultado, considera a MELHOR tentativa do aluno por filho (maior score_proprio), a mesma linha que a tabela de alunos mostra. Aluno que não participou: participou=false e todas as métricas null, nunca 0. Aluno que participou e ainda não tem nota TRI processada: situacao=aguardando_resultado e proficiencia null (não é abaixo do limiar). Posição calculada só entre alunos com proficiência no mesmo simulado. Variação = diferença de proficiência em relação ao simulado imediatamente anterior da seleção; null quando falta um dos dois valores. acertoPorArea em % de acerto, questão anulada ignorada.',
      'partial',     (SELECT count(*) FROM linha_var WHERE participou AND proficiencia IS NULL) > 0,
      'lowSample',   COALESCE((SELECT max(lv.n_total) FROM linha_var lv), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_gestor_detalhamento(p_ies_id uuid, p_semestre text, p_simulados uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Lote D (06/08): restaura SOMENTE o guard de 'gestao.enabled' (master),
  -- removido por engano junto com 'gestao.portal_v2' na migration
  -- 20260806144647 (GA total). Fica DEPOIS da resolucao de v_ies e da
  -- autorizacao por IES -- nunca antes, pois a helper e fail-closed para
  -- p_ies_id NULL (armadilha documentada em
  -- 20260804120000_user_has_feature_for_ies.sql:99-127). 'gestao.portal_v2'
  -- e as 5 chaves por modulo continuam mortas, nao voltam aqui.
  IF NOT public.user_has_feature_for_ies('gestao.enabled', v_ies) THEN
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
    SELECT u.id, u.nome, u.semestre
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
  -- Simulado que a lista de alunos descreve: o MAIS RECENTE do recorte, a mesma
  -- convencao da CTE `dispersao` acima (ORDER BY ord DESC). Com 1 simulado
  -- selecionado e ele proprio; com 2+, e o ultimo, e `variacao` compara com o
  -- imediatamente anterior DO RECORTE.
  alvo AS (
    SELECT s.id, s.ord FROM sims_ord s ORDER BY s.ord DESC LIMIT 1
  ),
  anterior AS (
    SELECT s.id FROM sims_ord s, alvo a WHERE s.ord = a.ord - 1
  ),
  aluno_linha AS (
    SELECT a.id, a.nome, a.semestre,
           EXISTS (SELECT 1 FROM tentativas t, alvo v
                    WHERE t.user_id = a.id AND t.pai_id = v.id) AS participou,
           -- Contagem absoluta de acertos, nao percentual: e o mesmo contrato de
           -- `acertos_calc` em get_gestor_aluno, e o front formata igual nos dois.
           (SELECT count(*) FILTER (WHERE r.correct)
              FROM respostas r, alvo v
             WHERE r.user_id = a.id AND r.pai_id = v.id) AS acertos_calc,
           (SELECT t.score_proprio FROM tri t, alvo v
             WHERE t.student_id = a.id AND t.pai_id = v.id) AS prof_atual,
           (SELECT t.score_proprio FROM tri t, anterior p
             WHERE t.student_id = a.id AND t.pai_id = p.id) AS prof_anterior
    FROM alunos a
  ),
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
             'correta',    CASE WHEN v_aberta THEN NULL ELSE (a.letra = f.correta) END,
             'marcadaPct', CASE WHEN f.marcadas > 0 THEN round(100.0 * a.n / f.marcadas, 0) END
           ) ORDER BY a.letra) AS alternativas,
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
      -- Lacuna fechada: nenhuma versao desta funcao jamais emitiu `alunos`, e a
      -- rota lia `dados.alunos ?? []` -- o bloco "Visao de alunos" do
      -- Detalhamento afirmava "Nenhum aluno neste recorte / 0 participantes"
      -- para IES com centenas de alunos participantes. Sem paginacao de
      -- proposito: a TabelaAlunosSimulado pagina no cliente.
      'alunos', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'id',           l.id,
                 'nome',         l.nome,
                 'semestre',     l.semestre,
                 'participou',   l.participou,
                 'acertos',      CASE WHEN l.participou THEN l.acertos_calc END,
                 'proficiencia', CASE WHEN l.prof_atual IS NULL THEN NULL
                                      ELSE round(l.prof_atual::numeric, 1) END,
                 -- Quatro estados, e `aguardando_resultado` NAO e o mesmo que
                 -- `abaixo_do_limiar`: quem participou e ainda nao tem TRI nao
                 -- pode ser dito "abaixo do limiar", que afirmaria uma nota
                 -- baixa inexistente. Proficiente e >= 60, como em todas as
                 -- outras RPCs do gestor.
                 'situacao',     CASE WHEN NOT l.participou     THEN 'nao_participou'
                                      WHEN l.prof_atual IS NULL THEN 'aguardando_resultado'
                                      WHEN l.prof_atual >= 60   THEN 'proficiente'
                                      ELSE 'abaixo_do_limiar' END,
                 -- So existe com nota nos DOIS simulados. Faltando qualquer uma,
                 -- e null e a UI mostra traco -- nunca zero, que leria como
                 -- "nao mudou".
                 'variacao',     CASE WHEN l.prof_atual IS NOT NULL AND l.prof_anterior IS NOT NULL
                                      THEN round((l.prof_atual - l.prof_anterior)::numeric, 1) END
               ) ORDER BY l.nome)
        FROM aluno_linha l
      ), '[]'::jsonb),
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
          FROM semestres s), '[]'::jsonb),
        'matriz', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'areaId',    m.grande_area,
                   'semestre',  m.semestre,
                   'acertoPct', round(100.0 * m.acertos / NULLIF(m.total,0), 0),
                   'amostra',   m.total
                 ) ORDER BY m.grande_area, m.semestre)
          FROM (
            SELECT r.grande_area, r.semestre,
                   count(*) AS total,
                   count(*) FILTER (WHERE r.correct) AS acertos
            FROM respostas r
            WHERE r.grande_area IS NOT NULL AND r.semestre IS NOT NULL
            GROUP BY r.grande_area, r.semestre
          ) m), '[]'::jsonb)
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
$function$;

CREATE OR REPLACE FUNCTION public.get_gestor_questoes(p_ies_id uuid, p_simulado_id uuid, p_page integer, p_page_size integer, p_sort text, p_area text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_ies    uuid;
  v_sort   text;
  v_page   int;
  v_size   int;
  v_aberta boolean;
  v_result jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_simulado_id IS NULL THEN
    RAISE EXCEPTION 'simulado_obrigatorio' USING ERRCODE = '22023';
  END IF;

  -- resolucao de v_ies (ainda NAO autoriza -- ver "A CORRECAO" no cabecalho)
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

  -- autorizacao da IES RESOLVIDA, por papel (gap 119: gestor puro so acessa
  -- users.id_ies, nunca get_accessible_ies, mesmo com user_groups orfao)
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  -- Lote D (06/08): restaura SOMENTE o guard de 'gestao.enabled' (master),
  -- removido por engano junto com 'gestao.portal_v2' na migration
  -- 20260806144647 (GA total). Fica DEPOIS da resolucao de v_ies e da
  -- autorizacao por IES -- nunca antes, pois a helper e fail-closed para
  -- p_ies_id NULL (armadilha documentada em
  -- 20260804120000_user_has_feature_for_ies.sql:99-127). 'gestao.portal_v2'
  -- e as 5 chaves por modulo continuam mortas, nao voltam aqui.
  IF NOT public.user_has_feature_for_ies('gestao.enabled', v_ies) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.simulados_admin sa
    WHERE sa.id = p_simulado_id
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
  ) THEN
    RAISE EXCEPTION 'simulado_fora_do_escopo' USING ERRCODE = '42501';
  END IF;

  -- achado 14: "desempenho liberado" (checagem acima) não é o mesmo que
  -- "prova encerrada para o aluno". v_aberta espelha simuladosApi.ts
  -- (listarSimulados, modo aluno): status = 'ativo' e dentro da janela de
  -- liberação/encerramento. Enquanto true, o gabarito fica oculto.
  SELECT (
    sa.status = 'ativo'
    AND (sa.data_liberacao IS NULL OR sa.data_liberacao <= now())
    AND (sa.data_encerramento IS NULL OR sa.data_encerramento >= now())
  )
  INTO v_aberta
  FROM public.simulados_admin sa
  WHERE sa.id = p_simulado_id;

  v_sort := lower(COALESCE(NULLIF(btrim(p_sort),''), 'numero'));
  IF v_sort NOT IN ('numero','acerto') THEN
    RAISE EXCEPTION 'sort_invalido' USING ERRCODE = '22023';
  END IF;
  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_size := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);

  WITH grupo AS (
    SELECT sa.id AS simulado_id
    FROM public.simulados_admin sa
    WHERE sa.id = p_simulado_id OR sa.simulado_pai_id = p_simulado_id
  ),
  alunos AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id) sf.user_id, sf.simulado_id
    FROM public.simulados_finalizados sf
    WHERE sf.simulado_id IN (SELECT simulado_id FROM grupo)
      AND sf.user_id IN (SELECT id FROM alunos)
    ORDER BY sf.user_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fb AS (
    SELECT DISTINCT ON (ap.user_id) ap.user_id, ap.simulado AS simulado_id
    FROM public.answer_progress ap
    JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.simulado IN (SELECT simulado_id FROM grupo)
      AND ap.user_id IN (SELECT id FROM alunos)
      AND ap.user_id NOT IN (SELECT user_id FROM ultima)
    ORDER BY ap.user_id, sa_ord.created_at DESC NULLS LAST
  ),
  tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb),
  q_base AS (
    SELECT q.id, COALESCE(q.numero_questao, q.ordem) AS numero,
           q.grande_area, q.especialidade, q.tema, q.enunciado, upper(q.correta) AS correta,
           q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d, q.alternativa_e
    FROM public.questoes_simulado q
    WHERE q.simulado_id IN (SELECT simulado_id FROM grupo)
      AND COALESCE(q.anulada,false) = false
      AND (p_area IS NULL OR q.grande_area = p_area)
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
             -- achado 14: enquanto a prova está aberta, não expõe qual
             -- alternativa é a correta. NULL, nunca false.
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
  ordenado AS (
    SELECT f.*, al.alternativas, al.distrator,
           row_number() OVER (
             ORDER BY
               CASE WHEN v_sort = 'acerto' THEN f.acerto_pct END ASC NULLS LAST,
               f.numero ASC
           ) AS rn
    FROM q_full f JOIN q_alts al ON al.id = f.id
  ),
  totais AS (SELECT count(*) AS total FROM ordenado)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'data', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'numero',             o.numero,
                 'grandeArea',         o.grande_area,
                 'especialidade',      o.especialidade,
                 'tema',               o.tema,
                 'acertoPct',          o.acerto_pct,
                 'enunciado',          o.enunciado,
                 'alternativas',       o.alternativas,
                 'distratorDominante', o.distrator
               ) ORDER BY o.rn)
        FROM ordenado o
        WHERE o.rn > (v_page - 1) * v_size AND o.rn <= v_page * v_size), '[]'::jsonb),
      'page',       v_page,
      'pageSize',   v_size,
      'total',      (SELECT total FROM totais),
      'totalPages', CASE WHEN (SELECT total FROM totais) = 0 THEN 0
                         ELSE ceil((SELECT total FROM totais)::numeric / v_size)::int END
    ),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at),'DD/MM/YYYY')
                                FROM public.simulados_admin sa WHERE sa.id = p_simulado_id), 'sem data'),
      'fonte',        'answer_progress · questoes_simulado · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Índice de acerto da questão = respostas corretas / respostas na última tentativa de cada aluno da IES. marcadaPct = distribuição entre quem marcou alguma alternativa. Questão anulada não é listada. Distrator dominante = alternativa incorreta mais marcada. Ordenação: %s. Filtro de grande área: %s. Prova ainda aberta ao aluno (status ativo, dentro da janela de liberação/encerramento): %s — enquanto aberta, correta e distratorDominante vêm null, gabarito não é exposto.', v_sort, COALESCE(p_area, 'todas'), v_aberta),
      'partial',      (SELECT count(*) FROM q_full WHERE total = 0) > 0,
      'lowSample',    COALESCE((SELECT max(f.total) FROM q_full f), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Achado F3 (revisao final): o COMMENT ON gravado por
-- 20260806144647_gestor_remove_guard_portal_v2_ga_total.sql dizia que
-- public.user_has_feature_for_ies estava ORFA -- "nenhum chamador em
-- supabase/migrations/*.sql alem daquele guard". Esta migration (Lote D) da
-- funcao 10 chamadores de volta (o guard 'gestao.enabled' nas 11 RPCs
-- get_gestor_*, exceto get_gestor_contexto, que usa public.user_has_feature).
-- Esse comentario antigo vive NO BANCO, nao no repo -- e o primeiro lugar
-- onde um DBA olha, e nenhum teste automatizado le COMMENT ON. Atualiza aqui,
-- no fim da mesma migration que reintroduz os chamadores, para as duas
-- mudancas chegarem juntas em producao quando esta migration for aplicada.
COMMENT ON FUNCTION public.user_has_feature_for_ies(text, uuid) IS
'Checa se uma feature de ies_features esta ligada PARA UMA IES ESPECIFICA (master gestao.enabled + chave), sem bool_or sobre as IES do grupo. Chamada pelo guard "gestao.enabled" nas 10 RPCs get_gestor_* desta migration (Lote D, 06/08) que resolvem v_ies a partir de p_ies_id/users.id_ies/get_accessible_ies -- todas exceto get_gestor_contexto, que enumera o switcher de IES e por isso usa public.user_has_feature (bool_or) em vez desta variante. Deixou de estar orfa nesta mesma data.';
