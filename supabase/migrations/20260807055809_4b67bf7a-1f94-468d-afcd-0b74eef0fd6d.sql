-- Simplificacao do acesso ao Portal do Gestor (spec 2026-08-07): o acesso
-- passa a depender SOMENTE de papel e escopo de IES, nunca mais de uma feature
-- ligada ou desligada por IES. Esta migration remove o guard de
-- 'gestao.enabled' das onze RPCs get_gestor_* -- o interruptor mestre que uma
-- IES podia ter desligado no banco (ies_features) mesmo com o gestor tendo o
-- papel certo.
--
-- Efeito de produto, explicito: depois desta migration, NAO HA MAIS via
-- tecnica para desligar o Portal do Gestor de uma IES especifica. Quem tem
-- papel de gestor/gestor_grupo/admin e acesso a IES enxerga o portal, sempre.
-- Isso e decisao de produto (spec 2026-08-07), nao efeito colateral.
--
-- Os outros tres blocos do preambulo de cada uma das onze RPCs FICAM, e nessa
-- ordem -- so o guard de feature (o quarto bloco) sai:
--   1) papel        -- RAISE EXCEPTION 'Access denied' se nao for
--                       admin/gestor/gestor_grupo;
--   2) resolucao de v_ies -- RAISE EXCEPTION 'IES not resolved' quando
--                       p_ies_id vem NULL e nao ha fallback (users.id_ies ou
--                       get_accessible_ies(v_uid)[1]);
--   3) gestor_pode_acessar_ies(v_ies) -- RAISE EXCEPTION 'Permission denied:
--                       cannot access this IES'.
-- (get_gestor_contexto nao resolve uma IES so, so passa pelo bloco 1;
-- get_gestor_aluno_contato funde 2 e 3 num unico IF anti-enumeracao, mas a
-- ordem relativa -- resolve+autoriza antes de qualquer guard -- e a mesma.)
--
-- QUEM RECRIAR QUALQUER UMA DAS ONZE PRECISA PRESERVAR ESSES TRES BLOCOS, NESSA
-- ORDEM. Ja aconteceu duas vezes neste projeto uma RPC ser recriada a partir de
-- uma base desatualizada e reverter em silencio um fix que estava em producao
-- -- ver o docblock de src/test/unit/gestorMigrationsAcessoPorPapel.test.ts
-- para o historico completo.
--
-- Fatiada por funcao, nunca por transcricao, a partir das duas migrations mais
-- recentes que recriam as onze RPCs em producao:
--   20260807021546_a19e4160-6f1c-4f0d-9cc8-f9743ff340dc.sql (9 funcoes)
--   20260807022207_de63e0ae-b9a7-4108-9c1f-81734944dace.sql
--     (get_gestor_detalhamento e get_gestor_questoes)
-- Verificado por script que, reinserindo o bloco removido, o corpo de cada
-- uma das onze funcoes reproduz byte-a-byte a fonte -- nenhuma outra linha
-- muda.
--
-- public.user_has_feature_for_ies(text, uuid) e public.user_has_feature(text)
-- NAO sao recriadas aqui -- so deixam de ser chamadas por estas onze funcoes.
-- user_has_feature_for_ies fica orfa depois desta migration (nenhum outro
-- chamador em supabase/migrations/*.sql); e removida por uma migration
-- SEGUINTE, que depende desta. public.user_has_feature(text) NUNCA e tocada:
-- 19 RPCs institucionais legadas dependem dela para chaves aluno.%.
--
-- NAO FOI APLICADA em producao (07/08/2026).

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