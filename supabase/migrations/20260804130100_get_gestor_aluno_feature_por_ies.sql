-- 20260804130100_get_gestor_aluno_feature_por_ies.sql
--
-- Corrige o achado 2 da revisao adversarial de 03/08 (card Ordem 101) em
-- public.get_gestor_aluno: a checagem de feature usava public.user_has_feature
-- ('gestao.portal_v2'), que resolve por bool_or sobre TODAS as IES acessiveis
-- ao usuario (get_accessible_ies) quando users.id_ies e null -- o caso normal
-- de gestor_grupo. Isso libera o detalhe do aluno para uma IES do grupo que
-- tem a flag desligada, contanto que outra IES irma a tenha ligada.
--
-- PARTIU de supabase/migrations/20260803150000_get_gestor_aluno_aguardando_resultado.sql
-- -- a versao aplicada em producao hoje (introduz o quarto estado
-- 'aguardando_resultado'; NAO partiu de 20260729210700, que e anterior a essa
-- correcao e apagaria o estado novo). NENHUMA outra logica foi alterada: mesmo
-- SECURITY DEFINER, SET search_path, STABLE, guard de papel, checagem de aluno
-- (aluno_obrigatorio / aluno_nao_encontrado), toda a query de simulados/tri/
-- areas/posicao/variacao, grants e assinatura (uuid, uuid, uuid[]) -> jsonb.
--
-- MUDANCA: troca public.user_has_feature('gestao.portal_v2') por
-- public.user_has_feature_for_ies('gestao.portal_v2', v_ies) -- a funcao
-- criada em 20260804120000_user_has_feature_for_ies.sql. O guard foi movido
-- para DEPOIS da resolucao de v_ies (ver "AVISO CRITICO" na migration do
-- helper): antes disso p_ies_id pode ser NULL e a funcao nova e fail-closed
-- para NULL, o que faria toda chamada sem p_ies_id explodir em
-- 'feature_not_enabled' -- regressao que este reordenamento evita. Ordem final
-- do preambulo: papel (Access denied) -> user_can_access_ies -> resolucao de
-- v_ies -> feature (feature_not_enabled) -> validacao de aluno.
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv): rodar
--   SELECT pg_get_functiondef('public.get_gestor_aluno(uuid,uuid,uuid[])'::regprocsignature);
-- e comparar com o corpo de 20260803150000 assumido acima. Se divergir
-- (patch aplicado direto em prod fora do repo), ABORTAR e investigar antes de
-- rodar este arquivo -- nao sobrescrever um corpo que nao foi conferido.

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
  tri AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, r.score_proprio, r.num_correct
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
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
      'criterio',    'Proficiência = score_proprio (0–100); proficiente >= 60. Aluno que não participou: participou=false e todas as métricas null, nunca 0. Aluno que participou e ainda não tem nota TRI processada: situacao=aguardando_resultado e proficiencia null (não é abaixo do limiar). Posição calculada só entre alunos com proficiência no mesmo simulado. Variação = diferença de proficiência em relação ao simulado imediatamente anterior da seleção; null quando falta um dos dois valores. acertoPorArea em % de acerto, questão anulada ignorada.',
      'partial',     (SELECT count(*) FROM linha_var WHERE participou AND proficiencia IS NULL) > 0,
      'lowSample',   COALESCE((SELECT max(lv.n_total) FROM linha_var lv), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_aluno(uuid, uuid, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_aluno(uuid, uuid, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICACAO (rodar manualmente em gvqv, autenticado como o usuario gestor
-- de teste -- nao como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
-- 1) Readback do corpo aplicado:
--    SELECT pg_get_functiondef('public.get_gestor_aluno(uuid,uuid,uuid[])'::regprocsignature);
--
-- 2) Caso funcional, em transacao revertida (:ies_b = IES do grupo do gestor
--    com 'gestao.portal_v2' DESLIGADA; :ies_a = IES irmã com a flag LIGADA;
--    :aluno_a = um aluno de id_ies = :ies_a):
--
--    BEGIN;
--      SELECT public.get_gestor_aluno(:ies_b::uuid, :aluno_a::uuid, NULL); -- esperado: RAISE 'feature_not_enabled'
--      SELECT public.get_gestor_aluno(:ies_a::uuid, :aluno_a::uuid, NULL); -- esperado: retorna jsonb normalmente
--    ROLLBACK;
