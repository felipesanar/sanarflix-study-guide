-- 20260805160000_get_gestor_alunos_proficiencias_por_simulado.sql
--
-- SUCEDE 20260804172000_get_gestor_alunos_gestor_pode_acessar_ies_dedup_tri.sql
-- (aplicada em produção -- gvqv, lote de 04-05/08, ver
-- docs/superpowers/notes/2026-08-05-handoff-portal-gestor-v2.md secao 1: "23
-- aplicadas"). NAO edita aquele arquivo -- o Supabase registra migration
-- aplicada pelo PREFIXO da versao: editar o conteudo de um arquivo ja
-- aplicado faz o conteudo novo NUNCA rodar, em silencio -- a correcao ficaria
-- no repo com cara de pronta e jamais chegaria ao produto. Por isso esta
-- correcao nasce em arquivo novo, com timestamp posterior.
--
-- NAO e correcao de bug encontrado em revisao adversarial -- e MUDANCA DE
-- CONTRATO decidida por Felipe em 05/08 (item 1, "Decisoes abertas", do
-- handoff citado acima: "Contrato de proficiencias (o mais importante)").
--
-- O PROBLEMA
-- ----------
-- `get_gestor_alunos` devolve `proficiencias` como array ANONIMO
-- `(number | null)[]` -- sem dizer a que simulado cada posicao pertence. As
-- colunas de `TabelaAlunos` (`colunasSimulados`), por sua vez, vem de OUTRA
-- RPC (`get_gestor_visao_geral`, campo `evolucao`), e as duas recortam
-- simulados por CRITERIOS DIFERENTES -- `get_gestor_visao_geral` filtra por
-- semestre (CTEs `realizados`/`pontos` daquela funcao), `get_gestor_alunos`
-- não (a CTE `sims` desta funcao, abaixo, nao tem filtro de semestre nenhum,
-- so IES/status/liberacao de desempenho). Casar as duas listas por POSICAO
-- (que e o que `TabelaAlunos` fazia) desloca a nota de um simulado para a
-- coluna de outro sempre que os recortes divergem -- e como os dois SAO
-- recortes diferentes por definicao, a unica protecao ate aqui era
-- coincidencia de tamanho.
--
-- O front ja MITIGAVA parcialmente: quando os dois arrays tem TAMANHOS
-- diferentes, a linha inteira virava traco (ver o teste substituido em
-- src/features/gestor/__tests__/TabelaAlunos.test.tsx, achados 1-4 da revisao
-- de 03/08). Mas essa mitigacao so pegava o caso de tamanho diferente -- o
-- caso de MESMO TAMANHO com simulados DIFERENTES (ex.: get_gestor_alunos tem
-- TRI para os simulados [X, Y, Z] e get_gestor_visao_geral, filtrando por
-- semestre, tem [X, W, Z] -- mesmo tamanho 3, W != Y) passava batido, com um
-- numero real sob o cabecalho errado. Essa era a lacuna mais perigosa: o
-- front afirmava um dado com confianca e o dado podia estar trocado.
--
-- A CORRECAO (este arquivo)
-- --------------------------
-- `proficiencias` passa a ser um array de OBJETOS, um por posicao, cada um
-- identificando o simulado: `{ simuladoId: uuid, valor: number | null }[]`,
-- em vez de `(number | null)[]`. `simuladoId` e `simulados_admin.id` do
-- simulado "pai" (`sims_ord.id`) -- o MESMO espaco de id que
-- `get_gestor_visao_geral` ja usa em `evolucao[].simuladoId` (ver
-- 20260804174000_get_gestor_visao_geral_multicontrato_dedup_nivel.sql, o
-- `jsonb_build_object('simuladoId', m.id, ...)` dentro de `evolucao`) --
-- entao o front pode casar as duas listas por IDENTIDADE, nunca por posicao.
--
-- O front (fora do escopo deste arquivo SQL -- ver
-- src/features/gestor/components/TabelaAlunos.tsx e
-- src/features/gestor/api/queries.ts) passa a percorrer `colunasSimulados` e
-- buscar a entrada por `simuladoId` para cada celula -- coluna sem entrada
-- correspondente vira TRACO SO NAQUELA CELULA, nunca a linha inteira: a
-- mitigacao antiga (traco na linha inteira quando os tamanhos divergiam) sai,
-- porque deixa de ser necessaria -- e ela nunca cobriu o caso de mesmo
-- tamanho, que era o silencioso e mais perigoso.
--
-- DIFF EXATO em relacao ao corpo de 20260804172000 (nada mais muda):
--   (1) CTE `aluno_sim` passa a expor tambem `s.id AS sim_id` (o id do
--       simulado), alem das colunas que ja tinha (`a.id`, `s.ord`, `score`).
--   (2) CTE `agg`, subquery de `proficiencias`: em vez de
--       `jsonb_agg(CASE WHEN s.score IS NULL THEN 'null'::jsonb ELSE
--       to_jsonb(round(s.score::numeric,1)) END ORDER BY s.ord)`, agora
--       `jsonb_agg(jsonb_build_object('simuladoId', s.sim_id, 'valor', CASE
--       WHEN s.score IS NULL THEN NULL ELSE round(s.score::numeric,1) END)
--       ORDER BY s.ord)` -- mesma fonte (`aluno_sim`), mesmo filtro
--       (`s.id = a.id`), MESMA ordem (`s.ord`, cronologica) e MESMO valor
--       (`round(s.score::numeric,1)`, null quando `s.score IS NULL`) -- so
--       acrescenta `simuladoId` a cada posicao. O RECORTE de simulados
--       considerados (`sims`/`sims_ord`/`sims_com_tri`) NAO MUDA -- so o
--       formato de cada posicao do array de saida. Nenhuma posicao e omitida
--       (mesma garantia de antes: uma entrada por simulado do CROSS JOIN
--       alunos x sims_com_tri).
--   (3) `meta.criterio`: a frase que descreve `proficiencias` passa a
--       mencionar que cada posicao carrega `simuladoId`.
--   (4) `COMMENT ON FUNCTION`: acrescenta uma frase sobre o novo formato.
--
-- NADA MAIS MUDA: guard de papel (admin/gestor/gestor_grupo), resolucao de
-- `v_ies`, guard `gestor_pode_acessar_ies(v_ies)` (achado 15/card 119), guard
-- de feature `user_has_feature_for_ies('gestao.portal_v2', v_ies)` (achado
-- 2), os recortes de semestre/paginacao/ordenacao, a CTE `tri` com o
-- desempate CANONICO `DISTINCT ON (tr.student_id, tr.pai_id) ORDER BY
-- tr.student_id, tr.pai_id, tr.score_proprio DESC` (arbitrario-mas-estavel,
-- NAO e regra de negocio -- decisao 4 do handoff de 05/08: "zero duplicatas
-- medido em producao" -- NAO MEXER), `grupo`/`n_com`/`n_prof`/`prof_atual`/
-- `tendencia`, a ordenacao, a paginacao, `SECURITY DEFINER`,
-- `SET search_path = public`, `STABLE`, os grants e a assinatura
-- (p_ies_id uuid, p_semestre text, p_page int, p_page_size int, p_sort text,
-- p_order text, p_q text) seguem integralmente iguais a 20260804172000.
--
-- COMPATIBILIDADE COM O FRONT (nao e requisito deste arquivo SQL, mas e
-- requisito do produto): esta migration so chega a producao pelas maos de
-- outra pessoa, depois -- o ambiente de desenvolvimento aponta para o banco
-- de producao (gvqv, ver MEMORY "Dois projetos Supabase") e HOJE ainda fala
-- com o corpo de 20260804172000 (array anonimo). Por isso o front
-- (src/features/gestor/api/queries.ts, funcao `normalizarLinhaAluno`) aceita
-- as duas formas -- a legada e esta -- distinguindo uma da outra so pelo
-- FORMATO de cada posicao (numero solto vs. objeto), sem flag de versao. O
-- ramo legado sai de `queries.ts` quando ESTA migration estiver aplicada em
-- producao e o array anonimo parar de ser emitido.
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv)
-- ----------------------------------------------
-- Rodar o readback abaixo e comparar com o corpo assumido aqui como "o que
-- esta em producao agora" (o corpo de 20260804172000). Se divergir, ABORTAR
-- esta migration e reconciliar manualmente antes de prosseguir -- nao aplicar
-- por cima as cegas:
--
--   SELECT pg_get_functiondef('public.get_gestor_alunos(uuid,text,int,int,text,text,text)'::regprocedure);
--   -- ESPERADO: identico ao corpo de 20260804172000 (guard
--   -- gestor_pode_acessar_ies(v_ies), CTE tri deduplicada por
--   -- DISTINCT ON (tr.student_id, tr.pai_id) ORDER BY tr.student_id,
--   -- tr.pai_id, tr.score_proprio DESC, proficiencias ainda como array
--   -- anonimo de numeros/null). Qualquer diferenca (outra migration
--   -- aplicada direto em prod, fora do repo) invalida o ponto de partida
--   -- assumido aqui -- reconciliar antes de continuar.
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
  -- gap 112 (herdado de 20260804172000, intocado): UMA linha por
  -- (student_id, pai_id) ANTES de qualquer avg/contagem. Critério de
  -- desempate CANÔNICO (igual ao de get_gestor_visao_geral e ao max() que
  -- get_gestor_aluno já usava): MAIOR score_proprio por (student_id, pai_id).
  -- Sem NULLS LAST aqui porque tri_raw já filtrou score_proprio IS NOT NULL
  -- -- não há linha nula para o ORDER BY desambiguar.
  tri AS (
    SELECT DISTINCT ON (tr.student_id, tr.pai_id)
           tr.pai_id, tr.student_id, tr.score_proprio
    FROM tri_raw tr
    ORDER BY tr.student_id, tr.pai_id, tr.score_proprio DESC
  ),
  sims_com_tri AS (
    SELECT s.* FROM sims_ord s WHERE EXISTS (SELECT 1 FROM tri t WHERE t.pai_id = s.id)
  ),
  -- (1) ÚNICA mudança desta CTE em relação a 20260804172000: expõe também
  -- `s.id AS sim_id` -- o id do simulado (simulados_admin.id, nível "pai"),
  -- necessário para identificar cada posição de `proficiencias` abaixo.
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
    -- Sinal puro, sem banda morta: identico a regras.ts::tendencia. Intocado.
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
           -- (2) ÚNICA outra mudança de código desta migration: cada posição
           -- passa a ser um OBJETO com `simuladoId` (s.sim_id, o mesmo
           -- espaço de id que get_gestor_visao_geral usa em
           -- evolucao[].simuladoId) e `valor` (idêntico ao que já era
           -- calculado antes: null quando s.score IS NULL, nunca 0 --
           -- nenhuma posição é omitida). O RECORTE (aluno_sim, via
           -- sims_com_tri) e a ORDEM (s.ord, cronológica) não mudam.
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
           -- Sem nenhum resultado de TRI ainda => grupo indefinido (NULL), nunca 'em_variacao'.
           -- "Em variação" pressupõe pelo menos um ponto para variar. Intocado.
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
      -- (3) ÚNICA mudança de texto: a 1ª frase agora menciona simuladoId.
      'criterio',     format('Uma posição em proficiencias por simulado com TRI na janela, cada posição com o id do simulado (simuladoId) e o valor correspondente (número ou null onde o aluno não participou — nunca 0), em ordem cronológica. Quando o simulado tem 2+ "filhos" (simulados-irmãos) com resultado, considera a MELHOR tentativa do aluno por filho (maior score_proprio), a mesma linha que o detalhamento do aluno mostra. Grupo: sem nenhum resultado de TRI ainda = null (nota chega depois, por pipeline); todas proficientes (>= 60) = consistentemente_proficiente; nenhuma = consistentemente_nao_proficiente; misto = em_variacao. Tendência sobre a janela toda: existe alguma variação consecutiva positiva E alguma negativa = alternando; só positiva = subindo; só negativa = descendo; nenhuma variação diferente de zero (ou menos de dois pontos com resultado) = estável — sem banda morta, qualquer diferença de sinal conta. Ordenação: %s %s. Recorte: %s.', v_sort, v_order, v_recorte),
      'partial',      (SELECT count(*) FROM sims_ord) > (SELECT count(*) FROM sims_com_tri),
      'lowSample',    (SELECT total FROM totais) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_alunos(uuid, text, int, int, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_alunos(uuid, text, int, int, text, text, text) TO authenticated;

-- (4) COMMENT ON FUNCTION acrescenta uma frase sobre o novo formato de
-- proficiencias; o restante do texto (herdado de 20260804172000) fica igual.
COMMENT ON FUNCTION public.get_gestor_alunos(uuid, text, int, int, text, text, text) IS
'Tabela de alunos paginada do Portal do Gestor v2. Autorização de IES via gestor_pode_acessar_ies (achado 15/card 119, substitui user_can_access_ies). Guard de feature por IES via user_has_feature_for_ies (achado 2). tri é deduplicada em UMA linha por (student_id, pai_id) por maior score_proprio, mesmo critério canônico de get_gestor_visao_geral e get_gestor_aluno (gap 112) -- o mesmo aluno no mesmo simulado passa a bater entre esta tabela e o drawer. grupo é anulável -- null quando o aluno não tem nenhum resultado de TRI na janela (achado 4). tendência é sinal puro sem banda morta, espelha regras.ts::tendencia (achado 17). proficiencias é array de {simuladoId, valor} (não mais array anônimo de números) -- simuladoId é simulados_admin.id do simulado pai, o mesmo espaço de id de get_gestor_visao_geral.evolucao[].simuladoId; o front casa por id contra colunasSimulados em vez de por posição, célula a célula (contrato decidido em 05/08, migration 20260805160000). Revisão de 03/08, verificação independente de 04/08, contrato de proficiencias de 05/08.';

-- ---------------------------------------------------------------------------
-- VERIFICACAO -- rodar manualmente em gvqv, autenticado como o gestor/gestor_grupo
-- do cenario (nao como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
--
-- 1) Readback do corpo aplicado -- confirma o novo formato de proficiencias e
--    que o resto não mudou:
--
--    SELECT pg_get_functiondef('public.get_gestor_alunos(uuid,text,int,int,text,text,text)'::regprocedure);
--    -- confirmar: contém "'simuladoId', s.sim_id" e "'valor', CASE WHEN
--    -- s.score IS NULL THEN NULL ELSE round(s.score::numeric, 1) END"
--    -- dentro de um jsonb_build_object, dentro do jsonb_agg de
--    -- proficiencias; contém 'gestor_pode_acessar_ies(v_ies)'; contém
--    -- 'DISTINCT ON (tr.student_id, tr.pai_id)' seguido de 'ORDER BY
--    -- tr.student_id, tr.pai_id, tr.score_proprio DESC' (desempate intocado).
--
-- 2) Formato de cada posição de proficiencias, em transação revertida:
--
--    BEGIN;
--      SELECT jsonb_array_elements(
--               (public.get_gestor_alunos(:ies::uuid, 'geral', 1, 5, 'nome', 'asc', NULL)
--                 -> 'data' -> 'data' -> 0 -> 'proficiencias')
--             ) AS posicao;
--      -- ESPERADO: cada linha é um objeto {"simuladoId": "<uuid>", "valor": <número|null>},
--      -- nunca um número solto. Contagem de posições igual à de antes desta
--      -- migration (o recorte de simulados não mudou, só o formato).
--    ROLLBACK;
--
-- 3) simuladoId no MESMO espaço de id que get_gestor_visao_geral.evolucao --
--    é isso que permite o front casar por id em vez de por posição:
--
--    BEGIN;
--      SELECT DISTINCT (p ->> 'simuladoId') AS simulado_id_visto_em_alunos
--      FROM jsonb_array_elements(
--             public.get_gestor_alunos(:ies::uuid, 'geral', 1, 100, 'nome', 'asc', NULL) -> 'data' -> 'data'
--           ) linha,
--           jsonb_array_elements(linha -> 'proficiencias') p;
--
--      SELECT (e ->> 'simuladoId') AS simulado_id_visto_em_visao_geral
--      FROM jsonb_array_elements(
--             public.get_gestor_visao_geral(:ies::uuid, 'geral') -> 'data' -> 'evolucao'
--           ) e;
--      -- ESPERADO: os ids que aparecem nas duas listas identificam o MESMO
--      -- simulado (mesmo nome/data) -- não precisam ser o mesmo CONJUNTO (os
--      -- recortes continuam diferentes: visão geral filtra por semestre,
--      -- esta RPC não), só o mesmo ESPAÇO de id.
--    ROLLBACK;
--
-- 4) Caso funcional que o contrato antigo deslocava silenciosamente (mesmo
--    TAMANHO, simulados DIFERENTES) -- escolher :aluno cujo recorte de
--    get_gestor_alunos inclua um simulado fora do recorte, filtrado por
--    semestre, de get_gestor_visao_geral para a mesma IES:
--
--    BEGIN;
--      SELECT l -> 'proficiencias'
--      FROM jsonb_array_elements(
--             public.get_gestor_alunos(:ies::uuid, 'geral', 1, 100, 'nome', 'asc', NULL) -> 'data' -> 'data'
--           ) l
--      WHERE (l ->> 'id') = :aluno::text;
--      -- ESPERADO: cada posição carrega o simuladoId real -- o front (fora
--      -- deste arquivo) casa por esse id contra colunasSimulados e nunca
--      -- mais depende da suposição "os arrays têm o mesmo tamanho, logo a
--      -- posição i corresponde", que era o que causava o deslocamento.
--    ROLLBACK;
--
-- 5) Não regressão -- guard de IES, guard de feature, dedup de TRI (gap 112),
--    grupo anulável e tendência continuam idênticos a 20260804172000: repetir
--    os itens 2 a 8 do rodapé daquele arquivo. Nenhum deles depende do
--    formato de proficiencias, então nenhum resultado deve mudar.
