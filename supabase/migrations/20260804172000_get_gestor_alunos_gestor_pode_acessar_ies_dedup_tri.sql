-- 20260804172000_get_gestor_alunos_gestor_pode_acessar_ies_dedup_tri.sql
--
-- SUCEDE 20260804140000_get_gestor_alunos_guard_grupo_tendencia.sql. NAO edita
-- aquele arquivo -- as migrations de 04/08 JA FORAM APLICADAS EM PRODUCAO
-- (gvqv, 04/08 16:11) e o Supabase registra migration aplicada pelo PREFIXO
-- da versao: editar o conteudo de um arquivo ja aplicado faz o conteudo novo
-- NUNCA rodar, em silencio -- a correcao ficaria no repo com cara de pronta e
-- jamais chegaria ao produto. Por isso esta correcao nasce em arquivo novo,
-- com timestamp posterior tanto a 20260804140000 quanto a 20260804160000 (a
-- funcao nova de que este arquivo depende).
--
-- Uma verificacao independente das 21 correcoes de 04/08 leu cada uma contra
-- o criterio do card Notion correspondente e achou, para get_gestor_alunos,
-- 1 achado NOVO (card Ordem 119) mais 1 achado INCOMPLETO (card Ordem 112, a
-- correcao andou mas a causa raiz ficou). Esta migration fecha os dois.
--
-- (A) ACHADO 15 / CARD ORDEM 119 -- autorizacao por IES ainda usava
--     public.user_can_access_ies(v_uid, p_ies_id), que autoriza um 'gestor'
--     puro (users.id_ies = A) para a IES de QUALQUER grupo em que ele tenha
--     ficado com uma linha orfa em user_groups -- residuo de downgrade
--     gestor_grupo -> gestor, que a UI de admin permite hoje sem limpar
--     user_groups. A UI nao oferece o switcher para esse usuario
--     (podeTrocarIes = false, desde 20260804130200) -- mas isso e so a UI: um
--     POST direto em /rest/v1/rpc/get_gestor_alunos com p_ies_id = B (a IES
--     irma) devolvia normalmente nome, semestre e desempenho individual dos
--     alunos da IES B.
--
--     CORRECAO: troca public.user_can_access_ies(v_uid, p_ies_id) por
--     public.gestor_pode_acessar_ies(v_ies) -- a funcao nova e aditiva de
--     20260804160000_gestor_pode_acessar_ies.sql, que para o papel 'gestor'
--     autoriza SOMENTE users.id_ies, nunca get_accessible_ies. O guard tambem
--     sai de DENTRO do `IF p_ies_id IS NOT NULL` e passa a rodar DEPOIS da
--     resolucao de v_ies: o guard antigo so cobria aquele ramo -- o ramo ELSE
--     (p_ies_id omitido) cai em `(get_accessible_ies(v_uid))[1]`, que para o
--     mesmo gestor puro com users.id_ies NULL e user_groups orfao devolve uma
--     IES do grupo -- o mesmo vazamento, por outra porta, sem p_ies_id nenhum.
--     Autorizar v_ies (o valor que a query vai de fato usar), e nao p_ies_id,
--     fecha os dois ramos com um unico IF. Nada e emitido antes do guard,
--     logo continua negando antes de revelar qualquer coisa sobre a IES. Ver
--     o cabecalho de 20260804160000 para a prova completa do gap e a tabela
--     de coerencia com podeTrocarIes/iesDisponiveis. NAO manter as duas
--     chamadas (e substituicao, nao adicao): o conjunto autorizado por
--     gestor_pode_acessar_ies e subconjunto do de user_can_access_ies em todo
--     papel, entao a troca so NEGA casos, nunca libera um caso hoje negado.
--     NAO alterada a mensagem 'Permission denied: cannot access this IES' --
--     o front-end mapeia essa string.
--
-- (B) GAP 112 / CARD ORDEM 112 -- "o mesmo aluno no mesmo simulado sai com
--     avg() na tabela (get_gestor_alunos) e max() no drawer (get_gestor_aluno)
--     quando ha 2+ linhas de TRI para filhos do mesmo pai -- a causa raiz
--     (nenhuma CTE unica de 1 linha por (student_id, pai_id) com criterio de
--     desempate) nao foi feita." MECANISMO: resultados_alunos_tri e
--     (student_id, simulado_id); um "pai" pode ter 2+ "filhos"
--     (simulados-irmaos, mesmo simulado_pai_id), e o mesmo aluno pode ter uma
--     linha de TRI por filho. A CTE `aluno_sim` fazia
--     `(SELECT avg(t.score_proprio) FROM tri t WHERE t.student_id = a.id AND
--     t.pai_id = s.id)` sobre a fonte crua, com 2+ linhas por aluno quando
--     havia 2+ filhos com resultado -- o drawer (get_gestor_aluno) usa
--     `max(tr.score_proprio)` no mesmo cenario, e os dois numeros divergiam
--     para o mesmo aluno no mesmo simulado.
--
--     CORRECAO: a fonte crua foi renomeada para `tri_raw` (mesmo corpo de
--     antes, sem nenhuma mudanca), e uma nova CTE `tri` faz a dedup -- UMA
--     linha por (student_id, pai_id), com o CRITERIO DE DESEMPATE CANONICO
--     definido na migration do mesmo gap em get_gestor_visao_geral
--     (20260804170000_get_gestor_visao_geral_multicontrato_dedup_nivel.sql,
--     bloco "CRITERIO DE DESEMPATE -- REFERENCIA CANONICA" daquele arquivo):
--     MAIOR score_proprio (melhor tentativa) por (student_id, pai_id), via
--     `DISTINCT ON (student_id, pai_id) ... ORDER BY student_id, pai_id,
--     score_proprio DESC`. E o MESMO criterio que get_gestor_aluno (o
--     "drawer") ja usa via `max(...)`, e e exatamente por isso que unificar
--     aqui faz os dois numeros baterem: depois da dedup, `avg()` sobre
--     exatamente 1 linha por (aluno, pai) e numericamente IGUAL a essa unica
--     linha -- o mesmo valor que `max()` devolveria sobre o mesmo conjunto
--     deduplicado. `tri_raw` continua filtrando `r.score_proprio IS NOT NULL`
--     (like antes), entao nao ha linha nula para o `ORDER BY ... DESC`
--     desambiguar -- nenhum `NULLS LAST` e necessario aqui (diferente do
--     ajuste equivalente em get_gestor_aluno, que preserva linhas nulas para
--     o estado `aguardando_resultado` e por isso PRECISA de `DESC NULLS LAST`
--     -- ver o cabecalho daquela migration, 20260804173000, para o motivo).
--     Tudo que ja lia `tri` (a CTE `sims_com_tri`, via EXISTS, e a propria
--     `aluno_sim`) passa a ler a versao deduplicada sem nenhuma outra
--     mudanca de forma.
--
--     Este arquivo tambem CRIA o teste de assercao que a verificacao apontou
--     como ausente: src/test/unit/gestorMigrationsAlunosAlunoDedupTri.test.ts,
--     cobrindo guard/autorizacao, grupo anulavel (achado 4), tendencia
--     (achado 17) e o denominador/dedup de TRI (gap 112) desta migration, no
--     padrao estatico de src/test/unit/gestorMigrationsVisaoGeralDetalhamento.test.ts.
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv)
-- ----------------------------------------------
-- Rodar os tres readbacks abaixo e comparar com o que este arquivo assume
-- como corpo atualmente em producao. Se QUALQUER um divergir, ABORTAR esta
-- migration e reconciliar manualmente antes de prosseguir -- nao aplicar por
-- cima as cegas:
--
--   (a) esta migration parte do corpo de 20260804140000 como "o que esta em
--       producao agora":
--       SELECT pg_get_functiondef('public.get_gestor_alunos(uuid,text,int,int,text,text,text)'::regprocedure);
--       -- ESPERADO: identico ao corpo de 20260804140000 (guard
--       -- user_can_access_ies dentro do `IF p_ies_id IS NOT NULL`, CTE `tri`
--       -- sem dedup, grupo anulavel quando n_com = 0, tendencia por
--       -- bool_or(diff>0)/bool_or(diff<0)). Qualquer diferenca (outra
--       -- migration aplicada direto em prod, fora do repo) invalida o ponto
--       -- de partida assumido aqui.
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
-- STABLE, o guard de papel, o guard de feature via user_has_feature_for_ies
-- (achado 2 da rodada anterior, preservado), o quarto estado implicito de
-- grupo anulavel (achado 4), a tendencia sem banda morta (achado 17), os
-- grants e a assinatura (p_ies_id uuid, p_semestre text, p_page int,
-- p_page_size int, p_sort text, p_order text, p_q text) seguem integralmente.
CREATE OR REPLACE FUNCTION public.get_gestor_alunos(
  p_ies_id    uuid,
  p_semestre  text,
  p_page      int,
  p_page_size int,
  p_sort      text,
  p_order     text,
  p_q         text
)
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
  -- gap 112: UMA linha por (student_id, pai_id) ANTES de qualquer avg/contagem.
  -- Critério de desempate CANÔNICO (igual ao de get_gestor_visao_geral,
  -- 20260804170000, e ao max() que get_gestor_aluno já usava): MAIOR
  -- score_proprio por (student_id, pai_id). Sem NULLS LAST aqui porque
  -- tri_raw já filtrou score_proprio IS NOT NULL -- não há linha nula para o
  -- ORDER BY desambiguar (diferente de get_gestor_aluno, que precisa
  -- preservar linha nula para aguardando_resultado).
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
    SELECT a.id, s.ord,
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
    -- Sinal puro, sem banda morta: identico a regras.ts::tendencia (achado 17).
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
             SELECT jsonb_agg(CASE WHEN s.score IS NULL THEN 'null'::jsonb
                                   ELSE to_jsonb(round(s.score::numeric, 1)) END ORDER BY s.ord)
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
           -- Sem nenhum resultado de TRI ainda => grupo indefinido (NULL), nunca 'em_variacao'
           -- (achado 4). "Em variação" pressupõe pelo menos um ponto para variar.
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
      'criterio',     format('Uma posição em proficiencias por simulado com TRI na janela, em ordem cronológica; null onde o aluno não participou (nunca 0). Quando o simulado tem 2+ "filhos" (simulados-irmãos) com resultado, considera a MELHOR tentativa do aluno por filho (maior score_proprio), a mesma linha que o detalhamento do aluno mostra. Grupo: sem nenhum resultado de TRI ainda = null (nota chega depois, por pipeline); todas proficientes (>= 60) = consistentemente_proficiente; nenhuma = consistentemente_nao_proficiente; misto = em_variacao. Tendência sobre a janela toda: existe alguma variação consecutiva positiva E alguma negativa = alternando; só positiva = subindo; só negativa = descendo; nenhuma variação diferente de zero (ou menos de dois pontos com resultado) = estável — sem banda morta, qualquer diferença de sinal conta. Ordenação: %s %s. Recorte: %s.', v_sort, v_order, v_recorte),
      'partial',      (SELECT count(*) FROM sims_ord) > (SELECT count(*) FROM sims_com_tri),
      'lowSample',    (SELECT total FROM totais) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_alunos(uuid, text, int, int, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_alunos(uuid, text, int, int, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.get_gestor_alunos(uuid, text, int, int, text, text, text) IS
'Tabela de alunos paginada do Portal do Gestor v2. Autorização de IES via gestor_pode_acessar_ies (achado 15/card 119, substitui user_can_access_ies). Guard de feature por IES via user_has_feature_for_ies (achado 2). tri é deduplicada em UMA linha por (student_id, pai_id) por maior score_proprio, mesmo critério canônico de get_gestor_visao_geral e get_gestor_aluno (gap 112) -- o mesmo aluno no mesmo simulado passa a bater entre esta tabela e o drawer. grupo é anulável -- null quando o aluno não tem nenhum resultado de TRI na janela (achado 4). tendência é sinal puro sem banda morta, espelha regras.ts::tendencia (achado 17). Revisão de 03/08 e verificação independente de 04/08.';

-- ---------------------------------------------------------------------------
-- VERIFICACAO -- rodar manualmente em gvqv, autenticado como o gestor/gestor_grupo
-- do cenario (nao como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
--
-- 1) Readback do corpo aplicado -- confirma o guard novo e a dedup:
--
--    SELECT pg_get_functiondef('public.get_gestor_alunos(uuid,text,int,int,text,text,text)'::regprocedure);
--    -- confirmar: contém 'gestor_pode_acessar_ies(v_ies)' e NÃO contém mais
--    -- 'user_can_access_ies'; contém 'tri_raw' e
--    -- 'DISTINCT ON (tr.student_id, tr.pai_id)' seguido de
--    -- 'ORDER BY tr.student_id, tr.pai_id, tr.score_proprio DESC'.
--    SELECT obj_description('public.get_gestor_alunos(uuid,text,int,int,text,text,text)'::regprocedure);
--
-- 2) Cenario do gap 119 (:uid = gestor PURO de teste, users.id_ies = :ies_a,
--    com linha orfa em user_groups cobrindo :ies_a E :ies_b):
--
--    SELECT public.user_can_access_ies(:uid::uuid, :ies_b::uuid) AS antigo_libera_b,
--           public.gestor_pode_acessar_ies(:ies_b::uuid)         AS novo_nega_b,
--           public.gestor_pode_acessar_ies(:ies_a::uuid)         AS novo_libera_a;
--    -- ESPERADO: antigo_libera_b = true (o gap), novo_nega_b = false, novo_libera_a = true.
--
-- 3) Gap 119 fechado ponta a ponta, em transacao revertida:
--
--    BEGIN;
--      SELECT public.get_gestor_alunos(:ies_b::uuid, 'geral', 1, 25, 'nome', 'asc', NULL);
--      -- ESPERADO: RAISE 'Permission denied: cannot access this IES'
--      -- (antes desta migration: devolvia nome/semestre/desempenho nominal dos alunos da IES B)
--      SELECT public.get_gestor_alunos(:ies_a::uuid, 'geral', 1, 25, 'nome', 'asc', NULL);
--      -- ESPERADO: payload normal da própria IES.
--    ROLLBACK;
--
-- 4) Nao-regressao do achado 2 (feature por IES, :ies_c com a flag desligada,
--    :ies_d irma com a flag ligada, mesmo gestor_grupo):
--
--    BEGIN;
--      SELECT public.get_gestor_alunos(:ies_c::uuid, 'geral', 1, 25, 'nome', 'asc', NULL);
--      -- ESPERADO: exception 'feature_not_enabled' (ERRCODE 42501)
--      SELECT (public.get_gestor_alunos(:ies_d::uuid, 'geral', 1, 25, 'nome', 'asc', NULL)
--               -> 'data' -> 'data') IS NOT NULL AS ies_d_responde;
--      -- ESPERADO: true
--    ROLLBACK;
--
-- 5) Nao-regressao de gestor_grupo e admin (autenticados como cada um,
--    testando :ies_a e :ies_b): ambos continuam com acesso a qualquer IES do
--    grupo (gestor_grupo) ou qualquer IES (admin) -- so o 'gestor' puro muda.
--
-- 6) Fail-closed de professor (autenticado como 'professor'):
--
--    SELECT public.get_gestor_alunos(:ies_a::uuid, 'geral', 1, 25, 'nome', 'asc', NULL);
--    -- ESPERADO: RAISE 'Access denied' (o guard de papel, anterior a
--    -- qualquer chamada ao helper, ja barra professor -- sem regressao).
--
-- 7) Invariante de coerencia podeTrocarIes/iesDisponiveis/servidor, como o
--    gestor puro do cenario de (2):
--
--    SELECT (public.get_gestor_contexto() -> 'data' -> 'podeTrocarIes')  AS pode_trocar,
--           (public.get_gestor_contexto() -> 'data' -> 'iesDisponiveis') AS disponiveis,
--           public.gestor_pode_acessar_ies(:ies_b::uuid)                 AS servidor_libera_b;
--    -- ESPERADO: pode_trocar = false, disponiveis = [{ id: :ies_a, ... }] (só a própria),
--    -- servidor_libera_b = false. UI e servidor concordam.
--
-- 8) Caso funcional do gap 112 (aluno com 2+ linhas de TRI para filhos do
--    mesmo pai), em transação revertida -- o mesmo aluno tem de bater entre
--    esta tabela e o drawer (get_gestor_aluno):
--
--    BEGIN;
--      -- escolher :aluno com 2+ linhas em resultados_alunos_tri para
--      -- simulados com o mesmo simulado_pai_id (:pai_id), scores diferentes
--      -- entre si (ex.: 55 e 78).
--      SELECT max(r.score_proprio) AS esperado
--      FROM public.resultados_alunos_tri r
--      JOIN public.simulados_admin sa ON sa.id = r.simulado_id
--      WHERE r.student_id = :aluno::uuid
--        AND COALESCE(sa.simulado_pai_id, sa.id) = :pai_id::uuid;
--
--      SELECT l -> 'proficiencias'
--      FROM jsonb_array_elements(
--             public.get_gestor_alunos(:ies::uuid, 'geral', 1, 100, 'nome', 'asc', NULL)
--               -> 'data' -> 'data'
--           ) l
--      WHERE (l ->> 'id') = :aluno::text;
--      -- ESPERADO: a posição correspondente a :pai_id contém :esperado (a
--      -- MELHOR tentativa), não uma média distorcida pela duplicata.
--
--      SELECT (public.get_gestor_aluno(:ies::uuid, :aluno::uuid, NULL)
--               -> 'data') AS drawer;
--      -- ESPERADO: 'proficiencia' do mesmo :pai_id em 'drawer' é IGUAL ao
--      -- valor lido em 'proficiencias' acima -- o mesmo aluno, o mesmo
--      -- simulado, o mesmo número nas duas telas.
--    ROLLBACK;
