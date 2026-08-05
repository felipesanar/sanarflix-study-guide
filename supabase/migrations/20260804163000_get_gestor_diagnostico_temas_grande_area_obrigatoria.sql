-- 20260804163000_get_gestor_diagnostico_temas_grande_area_obrigatoria.sql
--
-- SUCEDE 20260804132000_get_gestor_diagnostico_temas_escopo_grande_area.sql.
-- NAO edita aquele arquivo -- as migrations de 04/08 JA FORAM APLICADAS EM
-- PRODUCAO (gvqv, 04/08 16:11) e o Supabase registra migration aplicada pelo
-- PREFIXO da versao: editar o conteudo de um arquivo ja aplicado faz o
-- conteudo novo NUNCA rodar, em silencio. A correcao ficaria no repo com
-- cara de pronta e jamais chegaria ao produto. Por isso esta correcao nasce
-- em arquivo novo, com timestamp posterior tanto a 20260804132000 quanto a
-- 20260804160000 (a funcao nova de que a parte do achado 2/119 depende).
--
-- ESTA MIGRATION FECHA DOIS GAPS DISTINTOS, achados pela verificacao
-- independente das 21 correcoes de 04/08 -- um no card 115 (escopo por
-- grande área), outro no card 119 (autorizacao de IES). Tratados juntos
-- porque incidem na mesma função e a ordem de raciocínio de um afeta o
-- outro (ver "ORDEM DAS VALIDACOES" abaixo).
--
-- ============================================================================
-- GAP 1 -- CARD 115: o escopo por grande área não vale na prática
-- ============================================================================
-- 20260804132000 acrescentou `p_grande_area text DEFAULT NULL` e, quando
-- informado, restringiu a soma de temas à combinação (grande_area,
-- especialidade) exata -- corrigindo o achado 11 (especialidade de mesmo
-- nome em duas grandes áreas somava temas das duas). Mas o default NULL é
-- permissivo: `(p_grande_area IS NULL OR q.grande_area = p_grande_area)`
-- preserva o comportamento AMBÍGUO sempre que o chamador não envia o
-- parâmetro -- e a verificação independente confirmou que, até agora,
-- NENHUM chamador envia: `useDiagnosticoTemas` em
-- src/features/gestor/api/queries.ts só passa { p_ies_id, p_semestre,
-- p_especialidade }. Ou seja: o achado 11 foi corrigido no SQL mas continua
-- se manifestando em toda chamada real -- o drawer de temas continua somando
-- as duas grandes áreas quando a especialidade se repete entre elas.
--
-- Um agente irmão está, em paralelo a esta migration, alterando
-- src/features/gestor/api/queries.ts para passar `p_grande_area` com a
-- grande_area do nó pai que originou o clique no drawer (o mesmo dado já
-- usado para montar a chamada de get_gestor_diagnostico com p_node) -- este
-- arquivo NÃO toca em TS, essa é a única metade que falta para o front.
--
-- A DECISÃO, E POR QUÊ: `p_grande_area` deixa de ser opcional NA PRÁTICA.
-- Passa a ser exigido -- se chegar NULL (ou string vazia, que continua
-- equivalendo a NULL), a função RAISE EXCEPTION 'grande_area_obrigatoria' em
-- vez de silenciosamente somar as duas grandes áreas.
--
-- O contrário -- manter o default permissivo -- foi descartado. Preservar o
-- comportamento antigo para "não quebrar quem ainda não migrou" significa,
-- na prática, continuar publicando um percentual de tema que não bate com o
-- percentual de especialidade mostrado um nível acima na cascata, sem
-- NENHUM sinal de que algo está errado -- exatamente o estado que já existe
-- hoje e que a verificação independente classificou como o card ainda
-- incompleto. Errar CALADO numa tela que a coordenadora acadêmica leva para
-- reunião de colegiado é o pior desfecho possível: o número sai errado e
-- ninguém percebe até alguém cruzar manualmente. Exigir o parâmetro troca
-- esse silêncio por um erro ALTO e imediato ('grande_area_obrigatoria'),
-- com um ERRCODE que a UI já sabe tratar (mesmo padrão de
-- 'especialidade_obrigatoria', abaixo) -- visível na primeira chamada, não
-- descoberto meses depois num relatório.
--
-- O momento é o correto para essa troca: o card 115 nasceu HOJE (04/08) e
-- nunca chegou a rodar em produção com o parâmetro opcional sendo de fato
-- usado -- não existe base de chamadores legítimos "no ar" que dependam do
-- default permissivo. Trocar por uma exceção de domínio (não um erro de
-- assinatura Postgres) é o pior caso mais barato possível: se esta migration
-- for aplicada antes do deploy do front que envia `p_grande_area`, o drawer
-- mostra um erro claro e recuperável em vez de expor um número silenciosamente
-- errado -- e o pior caso melhora, não piora, à medida que o front for
-- atualizado.
--
-- A assinatura NÃO muda (mantém `p_grande_area text DEFAULT NULL`, sem novo
-- DROP FUNCTION): o default é só para não quebrar a resolução de overload do
-- PostgREST em quem já chama com 3 argumentos nomeados -- a obrigatoriedade
-- agora é IMPOSTA EM RUNTIME, com mensagem de domínio, não pela ausência do
-- argumento. Isso é estritamente melhor para quem depura um 400 no front: a
-- mensagem diz exatamente o que falta, em vez de "function is not unique" ou
-- "function does not exist".
--
-- String vazia ('' ou só espaço) continua equivalendo a NULL -- mesmo
-- tratamento de 20260804132000 -- e portanto também dispara a exceção.
--
-- ============================================================================
-- GAP 2 -- CARD 119: autorizacao de IES ignora o papel (mesmo gap das outras
-- 8 RPCs get_gestor_* com p_ies_id)
-- ============================================================================
-- 20260804132000 corrigiu o achado 2 (feature por IES) mas continuou
-- autorizando por public.user_can_access_ies(v_uid, p_ies_id), que delega
-- para public.get_accessible_ies(_user) quando a IES não é a do próprio
-- cadastro -- união de users.id_ies com as IES de TODO grupo em que o
-- usuário aparece em user_groups, SEM olhar o papel. Um usuário com role
-- SOMENTE 'gestor' (users.id_ies = A) com linha órfã em user_groups
-- (resíduo de downgrade gestor_grupo -> gestor, permitido pela UI de admin
-- hoje) apontando para um grupo que cobre {A, B} passava em
-- user_can_access_ies para a IES B -- um POST direto em
-- /rest/v1/rpc/get_gestor_diagnostico_temas com p_ies_id = B ainda devolvia
-- os temas da IES B, mesmo sem a UI oferecer o switcher para esse usuário.
--
-- A CORREÇÃO: troca public.user_can_access_ies(v_uid, p_ies_id) por
-- public.gestor_pode_acessar_ies(v_ies) -- a função criada em
-- 20260804160000_gestor_pode_acessar_ies.sql, que para o papel 'gestor'
-- autoriza SOMENTE users.id_ies, nunca get_accessible_ies. O guard sai de
-- dentro do `IF p_ies_id IS NOT NULL` e passa a rodar DEPOIS da resolução de
-- v_ies, pela mesma razão das outras 8 RPCs: o guard antigo só cobria aquele
-- ramo -- o ramo ELSE (p_ies_id omitido) cai em
-- `(get_accessible_ies(v_uid))[1]`, que para o mesmo gestor puro com
-- users.id_ies NULL e user_groups órfão devolve uma IES do grupo -- o mesmo
-- vazamento, por outra porta, sem p_ies_id nenhum. Autorizar v_ies (o valor
-- que a query vai de fato usar), e não p_ies_id, fecha os dois ramos com um
-- único IF.
--
-- ============================================================================
-- ORDEM DAS VALIDAÇÕES -- por que "grande_area_obrigatoria" fica ANTES da
-- resolução/autorização de IES
-- ============================================================================
-- Segue o padrão já estabelecido no corpo desta função para
-- 'especialidade_obrigatoria': validações de parâmetro de negócio (o
-- chamador mandou o que a função precisa para responder a pergunta certa)
-- vêm ANTES de qualquer coisa envolvendo IES, papel ou feature -- rejeitar
-- um p_grande_area ausente não revela nada sobre a IES ou o usuário, então
-- não há motivo de segurança para adiar essa checagem, e adiantá-la dá o
-- erro mais específico primeiro. A ordem final das checagens de IES/papel/
-- feature (Access denied -> resolução de v_ies -> IES not resolved ->
-- Permission denied -> feature_not_enabled) é a mesma das outras 8 RPCs.
--
-- NENHUMA outra lógica foi alterada: mesmo SECURITY DEFINER, SET
-- search_path, STABLE, guard de papel, obrigatoriedade de p_especialidade,
-- parsing de p_semestre, CTEs de simulados/alunos/tentativas, ordenação
-- (pior tema primeiro), grants e assinatura (uuid, text, text, text) ->
-- jsonb.
--
-- NAO alterada a mensagem 'Permission denied: cannot access this IES' -- o
-- front-end mapeia essa string; mudar o texto quebraria o tratamento de erro
-- sem trocar nada de seguranca.
--
-- PENDÊNCIA DE FRONT, ATUALIZADA: com esta migration, `useDiagnosticoTemas`
-- (src/features/gestor/api/queries.ts) PRECISA enviar `p_grande_area` antes
-- desta migration chegar a produção, ou toda chamada do drawer de temas
-- passa a devolver 'grande_area_obrigatoria' em vez do jsonb de temas. Ver
-- decisões_tomadas: coordenar a ordem de deploy com o agente de front, ou
-- aplicar esta migration só depois de confirmar que o front já envia o
-- parâmetro.
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv) -- rodar os dois readbacks
-- abaixo e ABORTAR se qualquer um divergir do que este arquivo assume:
--
--   -- (a) o corpo hoje em producao tem que ser o de 20260804132000:
--   SELECT pg_get_functiondef('public.get_gestor_diagnostico_temas(uuid, text, text, text)'::regprocedure);
--   -- ESPERADO: guard de papel + 'especialidade_obrigatoria' +
--   -- normalização de string vazia de p_grande_area para NULL +
--   -- `user_can_access_ies(v_uid, p_ies_id)` dentro do
--   -- `IF p_ies_id IS NOT NULL` + WHERE com
--   -- `(p_grande_area IS NULL OR q.grande_area = p_grande_area)`, seguido
--   -- de `user_has_feature_for_ies('gestao.portal_v2', v_ies)`. Se vier
--   -- diferente (patch aplicado direto em prod, fora do repo), PARAR.
--
--   -- (b) a funcao de que a parte do achado 119 depende precisa existir:
--   SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'gestor_pode_acessar_ies';
--   -- ESPERADO: 1 linha (aplicada por 20260804160000). Se vier 0, aplicar
--   -- aquela migration ANTES desta -- esta funcao nao compila sem ela.

CREATE OR REPLACE FUNCTION public.get_gestor_diagnostico_temas(p_ies_id uuid, p_semestre text, p_especialidade text, p_grande_area text DEFAULT NULL)
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

  IF NOT public.user_has_feature_for_ies('gestao.portal_v2', v_ies) THEN
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
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_diagnostico_temas(uuid, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_diagnostico_temas(uuid, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICACAO (rodar manualmente em gvqv, autenticado como o usuario de
-- teste -- nao como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
-- 1) Readback do corpo aplicado:
--    SELECT pg_get_functiondef('public.get_gestor_diagnostico_temas(uuid, text, text, text)'::regprocedure);
--
-- 2) Gap 115, em transação revertida (:esp = especialidade cadastrada em
--    duas grandes áreas :ga1 e :ga2, cada uma com temas distintos e
--    respostas de alunos da IES):
--
--    BEGIN;
--      SELECT public.get_gestor_diagnostico_temas(:ies_a::uuid, 'geral', :esp, NULL);
--      -- ESPERADO: RAISE 'grande_area_obrigatoria' (antes desta migration:
--      -- retornava temas somando :ga1 e :ga2)
--      SELECT public.get_gestor_diagnostico_temas(:ies_a::uuid, 'geral', :esp, :ga1);
--      -- ESPERADO: retorna 'data' só com os temas de :ga1; soma dos totais
--      -- bate com o total de respostas usado por get_gestor_diagnostico
--      -- para o nó de especialidade :esp sob p_node = :ga1.
--    ROLLBACK;
--
-- 3) Gap 119, cenário (:uid = gestor PURO de teste, users.id_ies = :ies_a,
--    com linha órfã em user_groups cobrindo :ies_a E :ies_b):
--
--    SELECT public.user_can_access_ies(:uid::uuid, :ies_b::uuid) AS antigo_libera_b,
--           public.gestor_pode_acessar_ies(:ies_b::uuid)         AS novo_nega_b;
--    -- ESPERADO: antigo_libera_b = true (o gap), novo_nega_b = false.
--
-- 4) Gap 119 fechado ponta a ponta, em transacao revertida:
--
--    BEGIN;
--      SELECT public.get_gestor_diagnostico_temas(:ies_b::uuid, 'geral', :esp, :ga1);
--      -- ESPERADO: RAISE 'Permission denied: cannot access this IES'
--      SELECT public.get_gestor_diagnostico_temas(:ies_a::uuid, 'geral', :esp, :ga1);
--      -- ESPERADO: retorna jsonb normalmente
--    ROLLBACK;
--
-- 5) Nao-regressao do achado 2 (feature por IES) e de gestor_grupo/admin:
--    repetir os testes já descritos em 20260804132000 (feature ligada numa
--    IES do grupo e desligada na irmã) e confirmar que gestor_grupo e admin
--    continuam com acesso a qualquer IES do grupo / qualquer IES.
