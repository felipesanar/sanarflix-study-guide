-- 20260804140000_get_gestor_alunos_guard_grupo_tendencia.sql
-- Corrige os achados 2, 4 e 17 da revisao adversarial de 03/08 (cards Ordem 101/105/111)
-- em public.get_gestor_alunos.
--
-- PONTO DE PARTIDA
-- ----------------
-- O corpo abaixo parte de supabase/migrations/20260729210600_get_gestor_alunos.sql -- a UNICA
-- migration desta funcao no repo. get_gestor_alunos nasceu com o guard de feature ESCRITO NO
-- CORPO (nao injetado dinamicamente como as 19 RPCs institucionais antigas da migration
-- 20260709171344), entao partir da migration versionada aqui e seguro.
--
-- EXIGENCIA ANTES DE APLICAR: rodar em producao (projeto gvqv)
--   SELECT pg_get_functiondef('public.get_gestor_alunos(uuid,text,int,int,text,text,text)'::regprocedure);
-- e comparar o resultado com o corpo de 20260729210600 (o ponto de partida assumido aqui).
-- Se divergir de qualquer forma -- mesmo um espaco --, ABORTAR esta migration e investigar
-- antes de prosseguir: o pressuposto "nasceu com o guard no corpo" deixaria de valer.
--
-- ACHADO 2 -- guard de feature por IES, nao por usuario (card 101)
-- ------------------------------------------------------------------
-- Trocado public.user_has_feature('gestao.portal_v2') por
-- public.user_has_feature_for_ies('gestao.portal_v2', v_ies) -- a funcao nova e aditiva de
-- 20260804120000_user_has_feature_for_ies.sql. O guard antigo checava a feature contra TODAS as
-- IES acessiveis pelo usuario (bool_or via get_accessible_ies dentro de user_has_feature), entao
-- uma IES do grupo com o portal ligado liberava as irmas desligadas.
--
-- ARMADILHA EVITADA: user_has_feature_for_ies e fail-closed para p_ies_id NULL, e p_ies_id chega
-- NULL sempre que o gestor nao especifica IES (o fallback pega users.id_ies ou a 1a IES
-- acessivel). Por isso o guard NAO fica mais na primeira linha do BEGIN: foi movido para DEPOIS
-- da resolucao de v_ies, e chama com v_ies (a IES que a funcao vai de fato consultar), nunca com
-- p_ies_id direto. Ordem final do preambulo: papel (Access denied) -> user_can_access_ies ->
-- resolucao de v_ies -> feature (feature_not_enabled).
--
-- ACHADO 4 -- grupo de evolucao quando NAO HA nenhum resultado de TRI (card 105)
-- --------------------------------------------------------------------------------
-- Antes: `CASE WHEN g.n_com = 0 THEN 'em_variacao' ...` classificava TODO aluno sem nenhum
-- resultado de TRI na janela como "em_variacao". Numa IES recem-encerrada (nota TRI sobe depois,
-- por pipeline Python -- mesma familia de decisao que criou `aguardando_resultado` em
-- get_gestor_aluno, migration 20260803150000), isso faz os 300 alunos da IES aparecerem com a tag
-- "Em variacao" quando na verdade NENHUM tem qualquer dado ainda: nao e variacao, e auSENCIA.
--
-- CONTRATO MUDOU: `grupo` agora pode ser SQL NULL (json null), nao mais um dos 3 valores fixos
-- quando n_com = 0. Do lado do front, `src/features/gestor/api/types.ts::LinhaAluno.grupo` passou
-- a `GrupoEvolucao | null` e `src/features/gestor/lib/formatters.ts` ganhou `rotuloGrupo`, que
-- devolve TRACO ('—') para null -- mesmo precedente de centralizacao de `rotuloSituacao`. Isso
-- tambem ALINHA a funcao com a regra pura que ja existia no front,
-- `src/features/gestor/lib/regras.ts::grupoEvolucao`, que SEMPRE devolveu `GrupoEvolucao | null`
-- (null quando `proficiencias.filter(p => p !== null).length === 0`) -- a funcao SQL e que estava
-- divergindo da sua propria regra canonica, nao o contrario. O design handoff tambem antecipa isso
-- ("cada aluno traz a tag do grupo; ausencia = '—'", docs/handoff/gestor/docs/00-relatorio-de-revisao.md).
-- Os casos com n_com >= 1 (inclusive n_com = 1) NAO mudam.
--
-- ACHADO 17 -- tendencia com banda morta de +-1, divergente de regras.ts (card 111)
-- -------------------------------------------------------------------------------------
-- Antes: `tend` classificava por MAGNITUDE (`min_d >= 1` subindo, `max_d <= -1` descendo, ambos
-- dentro de (-1,1) estavel, senao alternando). `src/features/gestor/lib/regras.ts::tendencia` --
-- a regra canonica do projeto -- nao tem banda morta: e sinal puro. Series como 55 -> 57 -> 57,5
-- (diffs +2, +0.5) caiam no ELSE e saiam "alternando" (deveria ser "subindo", todo diff > 0).
-- Series como 60 -> 60,5 -> 61 (diffs +0.5, +0.5) saiam "estavel" (deveria ser "subindo": nenhum
-- diff e negativo, ha diff positivo). Corrigido para bool_or(diff>0) / bool_or(diff<0): os dois
-- verdadeiros = alternando; so subiu = subindo; so desceu = descendo; nenhum diff diferente de
-- zero (ou nenhum diff, <2 pontos utilizaveis) = estavel. Isso e exatamente
-- `regras.ts::tendencia`, caso a caso, incluindo os testes de `regras.test.ts`
-- ("platô com um único sentido segue o sentido" e "valores repetidos => estavel"). A CTE `diffs`
-- em si NAO mudou: ela ja ignorava corretamente os `null` (buracos de nao-participacao) antes de
-- calcular a diferenca entre pontos consecutivos EXISTENTES, que e o mesmo comportamento do front.
--
-- Preservados integralmente: SECURITY DEFINER, SET search_path, STABLE, os guards de papel, a
-- chamada a user_can_access_ies, os grants e a assinatura da funcao.
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
  tri AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, r.score_proprio
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
      AND r.score_proprio IS NOT NULL
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
      'criterio',     format('Uma posição em proficiencias por simulado com TRI na janela, em ordem cronológica; null onde o aluno não participou (nunca 0). Grupo: sem nenhum resultado de TRI ainda = null (nota chega depois, por pipeline); todas proficientes (>= 60) = consistentemente_proficiente; nenhuma = consistentemente_nao_proficiente; misto = em_variacao. Tendência sobre a janela toda: existe alguma variação consecutiva positiva E alguma negativa = alternando; só positiva = subindo; só negativa = descendo; nenhuma variação diferente de zero (ou menos de dois pontos com resultado) = estável — sem banda morta, qualquer diferença de sinal conta. Ordenação: %s %s. Recorte: %s.', v_sort, v_order, v_recorte),
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
'Tabela de alunos paginada do Portal do Gestor v2. Guard de feature por IES via user_has_feature_for_ies (achado 2). grupo é anulável -- null quando o aluno não tem nenhum resultado de TRI na janela (achado 4). tendência é sinal puro sem banda morta, espelha regras.ts::tendencia (achado 17). Revisão de 03/08.';

-- ---------------------------------------------------------------------------
-- VERIFICACAO -- rodar manualmente em gvqv, autenticado como o gestor/gestor_grupo
-- do cenario (nao como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
--
-- 1) Readback -- confirma que a versao aplicada e esta (comparar corpo e comentario):
--
--    SELECT pg_get_functiondef('public.get_gestor_alunos(uuid,text,int,int,text,text,text)'::regprocedure);
--    SELECT obj_description('public.get_gestor_alunos(uuid,text,int,int,text,text,text)'::regprocedure);
--
-- 2) Achado 2 -- guard por IES (:ies_a ligada, :ies_b desligada, mesmo grupo, gestor_grupo com
--    users.id_ies NULL). Ver tambem a verificacao de user_has_feature_for_ies em
--    20260804120000_user_has_feature_for_ies.sql:
--
--    SELECT public.get_gestor_alunos(:ies_b::uuid, 'geral', 1, 25, 'nome', 'asc', NULL);
--    -- ESPERADO: exception 'feature_not_enabled' (ERRCODE 42501)
--    SELECT (public.get_gestor_alunos(:ies_a::uuid, 'geral', 1, 25, 'nome', 'asc', NULL)
--             -> 'data' -> 'data') IS NOT NULL AS ies_a_responde;
--    -- ESPERADO: true (IES ligada continua servindo dado)
--
-- 3) Achados 4 e 17, em transação revertida (não deixa dado de teste em gvqv):
--
--    BEGIN;
--      -- 3a) Aluno sem NENHUM resultado de TRI na janela -> grupo deve vir null, não
--      -- 'em_variacao'. Escolher um :aluno_sem_tri de uma IES/semestre onde
--      -- resultados_alunos_tri não tem nenhuma linha para ele nos simulados da janela,
--      -- ou zerar via DELETE temporário (revertido pelo ROLLBACK):
--      -- DELETE FROM resultados_alunos_tri WHERE student_id = :aluno_sem_tri;
--
--      SELECT l
--      FROM jsonb_array_elements(
--             public.get_gestor_alunos(:ies_id::uuid, 'geral', 1, 100, 'nome', 'asc', NULL)
--               -> 'data' -> 'data'
--           ) l
--      WHERE (l ->> 'id') = :aluno_sem_tri::text;
--      -- ESPERADO: l ->> 'grupo' IS NULL (json null), não a string 'em_variacao'

--      -- 3b) Tendência sem banda morta. Forçar uma série só-sobe com diffs < 1 para um aluno
--      -- de teste, ex.: proficiências 55 -> 57 -> 57.5 (diffs +2, +0.5) e 60 -> 60.5 -> 61
--      -- (diffs +0.5, +0.5) -- ambas devem sair 'subindo', nunca 'alternando' nem 'estavel':
--      -- UPDATE resultados_alunos_tri SET score_proprio = 55 WHERE student_id = :aluno_teste AND simulado_id = :sim1;
--      -- UPDATE resultados_alunos_tri SET score_proprio = 57 WHERE student_id = :aluno_teste AND simulado_id = :sim2;
--      -- UPDATE resultados_alunos_tri SET score_proprio = 57.5 WHERE student_id = :aluno_teste AND simulado_id = :sim3;

--      SELECT l ->> 'tendencia' AS tendencia, l -> 'proficiencias' AS proficiencias
--      FROM jsonb_array_elements(
--             public.get_gestor_alunos(:ies_id::uuid, 'geral', 1, 100, 'nome', 'asc', NULL)
--               -> 'data' -> 'data'
--           ) l
--      WHERE (l ->> 'id') = :aluno_teste::text;
--      -- ESPERADO: tendencia = 'subindo'
--    ROLLBACK;
