-- 20260803150000_get_gestor_aluno_aguardando_resultado.sql
-- Portal do Gestor v2 — quarto estado de `situacao` (decisão do Felipe, 03/08).
--
-- ============================================================================
-- EXIGÊNCIA OBRIGATÓRIA ANTES DE APLICAR EM PRODUÇÃO (gvqv)
-- ============================================================================
-- Esta migration faz CREATE OR REPLACE de `public.get_gestor_aluno`. O corpo
-- abaixo parte INTEGRALMENTE da migration `20260729210700_get_gestor_aluno.sql`
-- (única versão no histórico do repo para esta função — `git log --all` nela
-- mostra um commit só, d9335f1f). Mas o repo NÃO é garantia do que está rodando
-- em prod: ver a nota "ARMADILHA guard de feature em 19 RPCs" — 19 funções mais
-- antigas tiveram o guard injetado dinamicamente fora de qualquer .sql, e
-- recriar a partir da migration apagou o guard em silêncio.
--
-- `get_gestor_aluno` NÃO está nessa lista (é uma das 10 `get_gestor_*` que
-- nasceram com o guard escrito no próprio corpo, não injetado) — mas quem
-- aplicar esta migration DEVE, mesmo assim, confirmar isso contra o estado real
-- antes de rodar:
--
--   1. Rodar em produção:
--        SELECT pg_get_functiondef('public.get_gestor_aluno(uuid,uuid,uuid[])'::regprocedure);
--   2. Comparar o resultado com o corpo da migration 20260729210700 (git blame/show).
--   3. Se houver QUALQUER divergência não explicada por esta migration (guard
--      diferente, checagem de role diferente, coluna nova, etc.) — ABORTAR e
--      levar a divergência para o Felipe antes de aplicar. Não aplicar "por
--      cima" de um corpo que não foi conferido.
--
-- Esta migration NÃO deve ser aplicada por este agente/sessão — apenas
-- escrita. Aplicação é ação humana, feita fora deste fluxo.
-- ============================================================================
--
-- O QUE MUDA E POR QUÊ
-- ---------------------
-- `situacao` ganha um quarto valor: `aguardando_resultado`. Motivo (spec do
-- Felipe, 03/08): a nota TRI é processada DEPOIS, por um pipeline Python que
-- roda sobre as respostas — "participou mas ainda sem nota" é o estado NORMAL
-- de todo simulado recém-encerrado, não uma borda. O corpo anterior devolvia
-- `abaixo_do_limiar` nesse caso (linha `WHEN lv.proficiencia IS NULL THEN
-- 'abaixo_do_limiar'`), o que afirmava — falsamente — que a nota da turma
-- inteira estava abaixo do corte de 60 (`PROFICIENCIA_MINIMA` em
-- `src/features/gestor/lib/regras.ts`; o `60` abaixo é o MESMO corte, já
-- hardcoded no corpo original desta função, não um valor novo).
--
-- Nova regra de derivação de `situacao` (spec §4.3 + decisão de 03/08):
--   NOT participou                              => 'nao_participou'
--   participou E proficiencia IS NULL           => 'aguardando_resultado'  (NOVO)
--   participou E proficiencia >= 60              => 'proficiente'
--   participou E proficiencia < 60 (e não null)  => 'abaixo_do_limiar'
--
-- `get_gestor_alunos` (20260729210600) e `get_gestor_detalhamento`
-- (20260729210800) foram auditadas e NÃO derivam `situacao` — não têm esse
-- campo na saída (a primeira devolve `grupo`/`proficiencias`/`tendencia`, a
-- segunda devolve `metricas` sem por-aluno). Confirmado por
-- `grep -rn "'situacao'" supabase/migrations/` — só esta função aparece.
-- Nenhuma outra RPC precisa de alteração para esta frente.
--
-- Único bloco alterado no corpo: a expressão CASE de `situacao` (branch do
-- `proficiencia IS NULL`) e o texto de `meta.criterio`. Todo o resto —
-- guard de feature, checagem de role, `user_can_access_ies`, CTEs de dado,
-- `posicao`, `acertoPorArea`, `variacao`, `partial`, `lowSample` — é cópia
-- literal do corpo de 20260729210700. Note que `meta.partial` já testava
-- exatamente esta condição (`participou AND proficiencia IS NULL`) mesmo
-- antes desta migration — o flag estava certo, só o rótulo da situação é que
-- mentia.
CREATE OR REPLACE FUNCTION public.get_gestor_aluno(p_ies_id uuid, p_aluno_id uuid, p_simulados uuid[])
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
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

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

  IF p_aluno_id IS NULL THEN
    RAISE EXCEPTION 'aluno_obrigatorio' USING ERRCODE = '22023';
  END IF;

  -- não revela existência de aluno fora da IES do gestor
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
  tri AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, r.score_proprio, r.num_correct
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  areas_ies AS (   -- áreas críticas da instituição na janela (para o flag `critica`)
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
               -- Quarto estado (03/08): participou E ainda sem nota TRI => 'aguardando_resultado',
               -- NUNCA 'abaixo_do_limiar' -- a nota chega depois, via pipeline Python, e "sem nota"
               -- não pode afirmar "nota baixa". Ordem das branches é significativa: a checagem de
               -- NULL tem que vir ANTES da comparação numérica (NULL >= 60 é NULL, não false, mas
               -- não dependemos disso -- fica explícito para não reintroduzir o bug por engano).
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
      'criterio',    'Proficiência = score_proprio (0–100); proficiente >= 60. Aluno que não participou: participou=false e todas as métricas null, nunca 0. Aluno que participou mas ainda não tem nota TRI processada (pipeline roda depois, sobre as respostas): situacao=aguardando_resultado, proficiencia=null — não é abaixo do limiar. Posição calculada só entre alunos com proficiência no mesmo simulado. Variação = diferença de proficiência em relação ao simulado imediatamente anterior da seleção; null quando falta um dos dois valores. acertoPorArea em % de acerto, questão anulada ignorada.',
      'partial',     (SELECT count(*) FROM linha_var WHERE participou AND proficiencia IS NULL) > 0,
      'lowSample',   COALESCE((SELECT max(lv.n_total) FROM linha_var lv), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_aluno(uuid, uuid, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_aluno(uuid, uuid, uuid[]) TO authenticated;

-- ============================================================================
-- VERIFICAÇÃO — rodar em produção ANTES e DEPOIS de aplicar
-- ============================================================================
--
-- (1) ANTES de aplicar — capturar o corpo real e comparar com o bloco acima
--     (ver EXIGÊNCIA no topo do arquivo):
--
--   SELECT pg_get_functiondef('public.get_gestor_aluno(uuid,uuid,uuid[])'::regprocedure);
--
-- (2) DEPOIS de aplicar — readback de pg_proc: confirma STABLE, SECURITY
--     DEFINER e o search_path continuam exatamente como antes:
--
--   SELECT p.proname,
--          p.provolatile = 's'                       AS is_stable,       -- esperado: true
--          p.prosecdef                               AS is_security_definer, -- esperado: true
--          p.proconfig                                AS config          -- esperado: contém 'search_path=public'
--     FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'get_gestor_aluno';
--
--   -- guard de feature ainda presente no corpo (não foi apagado por engano):
--   SELECT pg_get_functiondef('public.get_gestor_aluno(uuid,uuid,uuid[])'::regprocedure)
--          LIKE '%feature_not_enabled%' AS guard_presente;               -- esperado: true
--
-- (3) DEPOIS de aplicar — readback de proacl: confirma que o REVOKE/GRANT
--     desta migration manteve o mesmo padrão de acesso (só `authenticated`
--     executa; nem `public`, nem `anon`):
--
--   SELECT p.proname, p.proacl
--     FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'get_gestor_aluno';
--
-- (4) Caso funcional, em transação SEMPRE revertida (não deixar dado de teste
--     em produção). Requer um `p_aluno_id` real de uma IES com a feature
--     'gestao.portal_v2' ligada, um `simulado_id` real dessa IES, e uma linha
--     em `resultados_alunos_tri` para ESSE aluno E ESSE simulado com
--     `score_proprio IS NULL` (ou a ausência completa da linha) — o cenário
--     "participou, sem nota ainda". Ajustar os IDs antes de rodar:
--
--   BEGIN;
--     -- opcional: forçar o cenário se não existir dado real assim no momento
--     -- do teste (comentar se já existir uma linha adequada):
--     -- DELETE FROM public.resultados_alunos_tri
--     --   WHERE student_id = '<aluno_id>' AND simulado_id = '<simulado_id>';
--
--     SELECT jsonb_path_query(
--              public.get_gestor_aluno('<ies_id>'::uuid, '<aluno_id>'::uuid, ARRAY['<simulado_id>'::uuid]),
--              '$.data[*] ? (@.simuladoId == "<simulado_id>")'
--            ) AS linha_do_simulado;
--     -- esperado na linha acima: "participou": true, "proficiencia": null,
--     -- "situacao": "aguardando_resultado" — NUNCA "abaixo_do_limiar".
--
--     -- meta.partial deve continuar true nesse cenário (já testava esta
--     -- condição antes desta migration; não deveria ter mudado):
--     SELECT (public.get_gestor_aluno('<ies_id>'::uuid, '<aluno_id>'::uuid, ARRAY['<simulado_id>'::uuid])
--              -> 'meta' ->> 'partial')::boolean AS partial_flag;   -- esperado: true
--   ROLLBACK;
-- ============================================================================
