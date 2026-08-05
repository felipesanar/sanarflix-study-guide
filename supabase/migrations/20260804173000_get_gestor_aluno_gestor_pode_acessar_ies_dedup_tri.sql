-- 20260804173000_get_gestor_aluno_gestor_pode_acessar_ies_dedup_tri.sql
--
-- SUCEDE 20260804130100_get_gestor_aluno_feature_por_ies.sql. NAO edita
-- aquele arquivo -- as migrations de 04/08 JA FORAM APLICADAS EM PRODUCAO
-- (gvqv, 04/08 16:11) e o Supabase registra migration aplicada pelo PREFIXO
-- da versao: editar o conteudo de um arquivo ja aplicado faz o conteudo novo
-- NUNCA rodar, em silencio -- a correcao ficaria no repo com cara de pronta e
-- jamais chegaria ao produto. Por isso esta correcao nasce em arquivo novo,
-- com timestamp posterior tanto a 20260804130100 quanto a 20260804160000 (a
-- funcao nova de que este arquivo depende).
--
-- PONTO DE PARTIDA -- NOTA IMPORTANTE SOBRE QUAL ARQUIVO DE 04/08 DESCREVE
-- PRODUCAO HOJE
-- --------------------------------------------------------------------------
-- get_gestor_aluno tem DUAS migrations no repo antes desta:
--   20260803150000_get_gestor_aluno_aguardando_resultado.sql (introduziu o
--     quarto estado 'aguardando_resultado', achado 4 da revisão de 03/08)
--   20260804130100_get_gestor_aluno_feature_por_ies.sql (04/08, achado 2 --
--     troca do guard de feature por user_has_feature_for_ies)
-- 20260804130100 é POSTERIOR a 20260803150000 e parte explicitamente dela
-- ("PARTIU de ... a versão aplicada em produção hoje"). Como a regra deste
-- round é "o ponto de partida do corpo é o arquivo de 04/08 daquela função --
-- ele descreve o que está em produção agora", o corpo assumido aqui como
-- produção é o de 20260804130100 (mais recente), não o de 20260803150000.
--
-- Uma verificação independente das 21 correções de 04/08 leu cada uma contra
-- o critério do card Notion correspondente e achou, para get_gestor_aluno,
-- 1 achado NOVO (card Ordem 119) mais 1 achado INCOMPLETO (card Ordem 112, a
-- correção andou mas a causa raiz ficou). Esta migration fecha os dois.
--
-- (A) ACHADO 15 / CARD ORDEM 119 -- autorização por IES ainda usava
--     public.user_can_access_ies(v_uid, p_ies_id), que autoriza um 'gestor'
--     puro (users.id_ies = A) para a IES de QUALQUER grupo em que ele tenha
--     ficado com uma linha órfã em user_groups -- resíduo de downgrade
--     gestor_grupo -> gestor, que a UI de admin permite hoje sem limpar
--     user_groups. Um POST direto em /rest/v1/rpc/get_gestor_aluno com
--     p_ies_id = B (a IES irmã) devolvia normalmente o detalhamento nominal
--     de um aluno da IES B.
--
--     CORREÇÃO: troca public.user_can_access_ies(v_uid, p_ies_id) por
--     public.gestor_pode_acessar_ies(v_ies) -- a função nova e aditiva de
--     20260804160000_gestor_pode_acessar_ies.sql, que para o papel 'gestor'
--     autoriza SOMENTE users.id_ies, nunca get_accessible_ies. O guard
--     também sai de DENTRO do `IF p_ies_id IS NOT NULL` e passa a rodar
--     DEPOIS da resolução de v_ies: o guard antigo só cobria aquele ramo -- o
--     ramo ELSE (p_ies_id omitido) cai em `(get_accessible_ies(v_uid))[1]`,
--     que para o mesmo gestor puro com users.id_ies NULL e user_groups órfão
--     devolve uma IES do grupo -- o mesmo vazamento, por outra porta, sem
--     p_ies_id nenhum. Autorizar v_ies (o valor que a query vai de fato
--     usar), e não p_ies_id, fecha os dois ramos com um único IF. Nada é
--     emitido antes do guard, logo continua negando antes de revelar
--     qualquer coisa sobre a IES. Ver o cabeçalho de 20260804160000 para a
--     prova completa do gap. NÃO manter as duas chamadas (é substituição, não
--     adição): o conjunto autorizado por gestor_pode_acessar_ies é
--     subconjunto do de user_can_access_ies em todo papel, então a troca só
--     NEGA casos, nunca libera um caso hoje negado.
--
--     NÃO confundir com o guard de get_gestor_aluno_contato (achado
--     separado, migration própria 20260804171500): esta função (get_gestor_
--     aluno, singular, SEM "_contato") recebe p_ies_id e adota o preâmbulo
--     padrão das 9 RPCs com p_ies_id, mensagem 'Permission denied: cannot
--     access this IES' -- NÃO a mensagem genérica 'aluno_nao_encontrado' que
--     é exclusiva de get_gestor_aluno_contato (que não recebe p_ies_id e
--     deriva v_ies do aluno). NÃO alterada a mensagem 'Permission denied:
--     cannot access this IES' aqui -- o front-end mapeia essa string.
--
-- (B) GAP 112 / CARD ORDEM 112 -- "o mesmo aluno no mesmo simulado sai com
--     avg() na tabela (get_gestor_alunos) e max() no drawer (get_gestor_aluno)
--     quando há 2+ linhas de TRI para filhos do mesmo pai -- a causa raiz
--     (nenhuma CTE única de 1 linha por (student_id, pai_id) com critério de
--     desempate) não foi feita." Do lado do drawer (esta função), o número
--     já era o CORRETO (max()) -- mas sem uma CTE de dedup explícita, três
--     consumidores da CTE `tri` ficavam vulneráveis à mesma causa raiz
--     quando o aluno tem 2+ linhas de TRI para filhos (simulados-irmãos, o
--     mesmo simulado_pai_id) com resultado:
--
--       * `n_total` (SELECT count(*) FROM tri tr WHERE tr.pai_id = s.id AND
--         tr.score_proprio IS NOT NULL) -- contava LINHAS de TRI, não
--         alunos distintos: um aluno com 2 filhos com resultado inflava o
--         denominador da posição/percentil de TODOS os alunos daquele
--         simulado em +1 por duplicata.
--       * `n_acima` (mesma tabela `tri`, comparando contra o score do
--         próprio aluno) -- pelo mesmo motivo, contava linhas duplicadas de
--         OUTROS alunos como "acima", inflando o ranking de quem estava
--         atrás deles.
--       * `proficiencia` (`max(tr.score_proprio) ... WHERE tr.student_id =
--         p_aluno_id AND tr.pai_id = s.id`) já era numericamente correto
--         (max() sobre 2 linhas do mesmo aluno = a melhor tentativa), mas
--         dependia de recalcular o max em CADA consumidor -- exatamente o
--         padrão que a migration canônica do gap (get_gestor_visao_geral,
--         20260804170000) describe como "causa raiz: remendar cada
--         consumidor em vez de fechar numa fonte única".
--
--     CORREÇÃO: a fonte crua foi renomeada para `tri_raw` (mesmo corpo de
--     antes, sem nenhuma mudança), e uma nova CTE `tri` faz a dedup -- UMA
--     linha por (student_id, pai_id), com o CRITÉRIO DE DESEMPATE CANÔNICO
--     definido na migration do mesmo gap em get_gestor_visao_geral
--     (20260804170000_get_gestor_visao_geral_multicontrato_dedup_nivel.sql,
--     bloco "CRITÉRIO DE DESEMPATE -- REFERÊNCIA CANÔNICA" daquele arquivo):
--     MAIOR score_proprio (melhor tentativa) por (student_id, pai_id), via
--     `DISTINCT ON (student_id, pai_id) ... ORDER BY student_id, pai_id,
--     score_proprio DESC`.
--
--     DIFERENÇA DELIBERADA em relação a get_gestor_alunos e a
--     get_gestor_visao_geral (as duas outras consumidoras do mesmo
--     critério): esta função NÃO filtra `score_proprio IS NOT NULL` em
--     `tri_raw` -- e não deve passar a filtrar. O guard de feature/IES
--     acontece antes, mas o `tri_raw` desta função é a única fonte de onde
--     `n_total`/`n_acima` derivam a MESMA regra de "aguardando_resultado"
--     (achado 4, migration 20260803150000): um aluno pode ter, para o MESMO
--     pai_id, uma linha de TRI já processada (score_proprio = 78, o filho
--     mais antigo) e outra ainda pendente (score_proprio = NULL, o filho
--     mais recente, nota chega depois por pipeline). Se o `ORDER BY ...
--     score_proprio DESC` desta dedup rodasse SEM qualificador de nulos, o
--     comportamento padrão do Postgres para DESC é NULLS FIRST -- a linha
--     NULL "venceria" o DISTINCT ON, e `max(tr.score_proprio)` sobre essa
--     única linha deduplicada devolveria NULL (situacao=aguardando_resultado)
--     em vez do 78 real que o `max()` sobre a fonte crua (não deduplicada)
--     hoje devolve corretamente (max() ignora NULL, a menos que TODAS as
--     linhas do grupo sejam NULL). Por isso o ORDER BY aqui é
--     `... score_proprio DESC NULLS LAST`: entre um score real e um
--     pendente para o MESMO (aluno, pai), o real vence -- reproduzindo
--     EXATAMENTE a semântica que `max()` já tinha antes desta migration.
--     Quando TODAS as linhas do (aluno, pai) são NULL, a única linha
--     deduplicada também é NULL, e o resultado é idêntico a antes
--     (aguardando_resultado, preservado). A migration canônica de
--     get_gestor_visao_geral não precisou deste NULLS LAST porque o
--     `tri_raw` DELA já filtra score_proprio IS NOT NULL antes do DISTINCT
--     ON -- aquela função não rastreia "aguardando_resultado" por linha, só
--     agrega quem já tem nota. O critério de MAIOR score_proprio é o MESMO
--     nos dois casos; a única diferença é que esta função também precisa
--     dizer "maior, e NULL nunca vence um valor real" para não regredir o
--     achado 4.
--
--     Com a dedup, `n_total` e `n_acima` (que já filtravam
--     `tr.score_proprio IS NOT NULL` na própria subquery, preservado
--     abaixo como defesa em profundidade -- mesmo padrão do comentário de
--     achado 8 na migration canônica) passam a contar sobre UMA linha por
--     aluno, nunca duas: `count(DISTINCT student_id)` implícito. `n_acima`
--     também deixa de contar duplicatas de outros alunos como "acima".
--
--     Este arquivo cria o teste de asserção correspondente para
--     get_gestor_alunos (não para esta função -- get_gestor_aluno não tinha
--     teste de asserção próprio antes desta rodada e continua sem um
--     arquivo dedicado; a cobertura do gap 112 para AS DUAS funções, lado a
--     lado, está em src/test/unit/gestorMigrationsAlunosAlunoDedupTri.test.ts,
--     criado por esta mesma migration em conjunto com
--     20260804172000_get_gestor_alunos_gestor_pode_acessar_ies_dedup_tri.sql).
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv)
-- ----------------------------------------------
-- Rodar os tres readbacks abaixo e comparar com o que este arquivo assume
-- como corpo atualmente em producao. Se QUALQUER um divergir, ABORTAR esta
-- migration e reconciliar manualmente antes de prosseguir -- nao aplicar por
-- cima as cegas:
--
--   (a) esta migration parte do corpo de 20260804130100 como "o que esta em
--       producao agora":
--       SELECT pg_get_functiondef('public.get_gestor_aluno(uuid,uuid,uuid[])'::regprocsignature);
--       -- ESPERADO: identico ao corpo de 20260804130100 (guard
--       -- user_can_access_ies dentro do `IF p_ies_id IS NOT NULL`, guard de
--       -- feature via user_has_feature_for_ies(v_ies) já presente, CTE `tri`
--       -- sem dedup, situacao com o quarto estado aguardando_resultado).
--       -- Qualquer diferença (outra migration aplicada direto em prod, fora
--       -- do repo) invalida o ponto de partida assumido aqui.
--
--   (b) o helper novo que esta migration passa a consumir nao pode ja existir
--       com outro corpo:
--       SELECT pg_get_functiondef('public.gestor_pode_acessar_ies(uuid)'::regprocedure);
--       -- ESPERADO: identico ao corpo de 20260804160000_gestor_pode_acessar_ies.sql.
--
--   (c) get_gestor_contexto (a funcao com que a coerencia de podeTrocarIes e
--       afirmada, ver 20260804160000) tem que bater com o esperado:
--       SELECT pg_get_functiondef('public.get_gestor_contexto()'::regprocsignature);
--       -- ESPERADO: corpo de 20260804130200. Se podeTrocarIes tiver mudado de
--       -- regra em prod, a tabela de coerencia do helper esta invalidada --
--       -- PARAR e nao aplicar.
--
-- NADA MAIS MUDOU alem de (A) e (B): SECURITY DEFINER, SET search_path,
-- STABLE, o guard de papel, a checagem de aluno (aluno_obrigatorio /
-- aluno_nao_encontrado), o quarto estado aguardando_resultado (achado 4), a
-- variação/posição/acertoPorArea, os grants e a assinatura
-- (p_ies_id uuid, p_aluno_id uuid, p_simulados uuid[]) -> jsonb seguem
-- integralmente.
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

  IF NOT public.user_has_feature_for_ies('gestao.portal_v2', v_ies) THEN
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

REVOKE ALL ON FUNCTION public.get_gestor_aluno(uuid, uuid, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_aluno(uuid, uuid, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_gestor_aluno(uuid, uuid, uuid[]) IS
'Detalhamento (drawer) de um aluno no Portal do Gestor v2. Autorização de IES via gestor_pode_acessar_ies (achado 15/card 119, substitui user_can_access_ies). Guard de feature por IES via user_has_feature_for_ies (achado 2). tri é deduplicada em UMA linha por (student_id, pai_id) por maior score_proprio, com NULLS LAST -- mesmo critério canônico de get_gestor_visao_geral e get_gestor_alunos (gap 112), adaptado para nunca deixar uma linha pendente vencer um score real do mesmo aluno. Quarto estado aguardando_resultado preservado (achado 4, 20260803150000). Revisão de 03/08 e verificação independente de 04/08.';

-- ---------------------------------------------------------------------------
-- VERIFICACAO -- rodar manualmente em gvqv, autenticado como o gestor/gestor_grupo
-- do cenario (nao como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
--
-- 1) Readback do corpo aplicado -- confirma o guard novo e a dedup:
--
--    SELECT pg_get_functiondef('public.get_gestor_aluno(uuid,uuid,uuid[])'::regprocsignature);
--    -- confirmar: contém 'gestor_pode_acessar_ies(v_ies)' e NÃO contém mais
--    -- 'user_can_access_ies'; contém 'tri_raw' e
--    -- 'DISTINCT ON (tr.student_id, tr.pai_id)' seguido de
--    -- 'ORDER BY tr.student_id, tr.pai_id, tr.score_proprio DESC NULLS LAST'.
--    SELECT obj_description('public.get_gestor_aluno(uuid,uuid,uuid[])'::regprocsignature);
--
-- 2) Cenario do gap 119 (:uid = gestor PURO de teste, users.id_ies = :ies_a,
--    com linha orfa em user_groups cobrindo :ies_a E :ies_b; :aluno_b um
--    aluno de id_ies = :ies_b):
--
--    SELECT public.user_can_access_ies(:uid::uuid, :ies_b::uuid) AS antigo_libera_b,
--           public.gestor_pode_acessar_ies(:ies_b::uuid)         AS novo_nega_b;
--    -- ESPERADO: antigo_libera_b = true (o gap), novo_nega_b = false.
--
-- 3) Gap 119 fechado ponta a ponta, em transacao revertida:
--
--    BEGIN;
--      SELECT public.get_gestor_aluno(:ies_b::uuid, :aluno_b::uuid, NULL);
--      -- ESPERADO: RAISE 'Permission denied: cannot access this IES'
--      -- (antes desta migration: devolvia o detalhamento nominal do aluno da IES B)
--      SELECT public.get_gestor_aluno(:ies_a::uuid, :aluno_a::uuid, NULL);
--      -- ESPERADO: payload normal (:aluno_a de id_ies = :ies_a).
--    ROLLBACK;
--
-- 4) Nao-regressao do achado 2 (feature por IES, ja coberto por
--    20260804130100 -- repetir apenas para confirmar que a migration nova
--    nao regrediu):
--
--    BEGIN;
--      SELECT public.get_gestor_aluno(:ies_c::uuid, :aluno_c::uuid, NULL); -- flag desligada
--      -- ESPERADO: RAISE 'feature_not_enabled'
--      SELECT public.get_gestor_aluno(:ies_d::uuid, :aluno_d::uuid, NULL); -- flag ligada
--      -- ESPERADO: retorna jsonb normalmente
--    ROLLBACK;
--
-- 5) Nao-regressao de gestor_grupo, admin e fail-closed de professor: mesmo
--    padrao das outras 9 RPCs (ver item 2 abaixo do proprio cabecalho de
--    20260804160000_gestor_pode_acessar_ies.sql, itens 4/5/6 da verificacao).
--
-- 6) Invariante de coerencia podeTrocarIes/iesDisponiveis/servidor, como o
--    gestor puro do cenario de (2):
--
--    SELECT (public.get_gestor_contexto() -> 'data' -> 'podeTrocarIes')  AS pode_trocar,
--           (public.get_gestor_contexto() -> 'data' -> 'iesDisponiveis') AS disponiveis,
--           public.gestor_pode_acessar_ies(:ies_b::uuid)                 AS servidor_libera_b;
--    -- ESPERADO: pode_trocar = false, disponiveis = [{ id: :ies_a, ... }] (só a própria),
--    -- servidor_libera_b = false. UI e servidor concordam.
--
-- 7) Caso funcional do gap 112 -- o número tem de ser IGUAL ao de
--    get_gestor_alunos para o MESMO aluno no MESMO simulado (a prova
--    completa, lado a lado, está no item 8 da verificação de
--    20260804172000_get_gestor_alunos_gestor_pode_acessar_ies_dedup_tri.sql):
--
--    BEGIN;
--      SELECT (public.get_gestor_aluno(:ies::uuid, :aluno::uuid, NULL) -> 'data') AS drawer;
--    ROLLBACK;
--
-- 8) Caso funcional do gap 112, cenário de NÃO-REGRESSÃO do achado 4
--    (aguardando_resultado) -- o cenário que exige o NULLS LAST desta
--    migration, em transação revertida:
--
--    BEGIN;
--      -- montar/confirmar :aluno com 2 linhas em resultados_alunos_tri para
--      -- 2 simulados com o MESMO simulado_pai_id (:pai_id): uma já
--      -- processada (score_proprio = 78, ex. o filho mais antigo) e outra
--      -- ainda pendente (score_proprio = NULL, o filho mais recente), e uma
--      -- linha em simulados_finalizados/answer_progress confirmando
--      -- participação em pelo menos um dos dois filhos:
--      -- UPDATE resultados_alunos_tri SET score_proprio = 78   WHERE student_id = :aluno AND simulado_id = :filho_antigo;
--      -- UPDATE resultados_alunos_tri SET score_proprio = NULL WHERE student_id = :aluno AND simulado_id = :filho_novo;
--
--      SELECT l ->> 'situacao' AS situacao, l ->> 'proficiencia' AS proficiencia
--      FROM jsonb_array_elements(public.get_gestor_aluno(:ies::uuid, :aluno::uuid, NULL) -> 'data') l
--      WHERE (l ->> 'simuladoId') = :pai_id::text;
--      -- ESPERADO: situacao = 'proficiente' (ou 'abaixo_do_limiar', conforme o
--      -- valor), proficiencia = 78.0 -- a linha pendente (NULL) NÃO pode
--      -- "vencer" a linha real na dedup. Se isto vier 'aguardando_resultado'
--      -- com proficiencia null, o NULLS LAST foi perdido ou invertido --
--      -- regressão do achado 4.
--    ROLLBACK;
