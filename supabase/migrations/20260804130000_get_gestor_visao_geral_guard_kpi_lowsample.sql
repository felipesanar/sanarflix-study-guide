-- 20260804130000_get_gestor_visao_geral_guard_kpi_lowsample.sql
-- Corrige, em public.get_gestor_visao_geral, os achados 2, 5, 8 e 9 da revisao
-- adversarial de 03/08 (cards Ordem 101/109/112/113).
--
-- PONTO DE PARTIDA: o corpo desta migration foi copiado de
-- supabase/migrations/20260729210300_get_gestor_visao_geral.sql (a unica
-- migration que ja definiu esta funcao). get_gestor_visao_geral nasceu com o
-- guard de feature escrito direto no corpo -- NAO e uma das 19 RPCs
-- institucionais com guard injetado dinamicamente (20260709171344), entao
-- partir da migration versionada aqui e seguro (§7.1 do design doc so se
-- aplica as institucionais antigas).
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv): rodar
--   SELECT pg_get_functiondef('public.get_gestor_visao_geral(uuid,text)'::regprocedure);
-- e comparar com o corpo de 20260729210300 assumido como ponto de partida
-- acima. Se o corpo em produção divergir (outra migration mexeu na função
-- entre 29/07 e agora, fora deste repo), ABORTAR e reconciliar manualmente
-- antes de aplicar este arquivo -- não aplicar por cima às cegas.
--
-- O QUE MUDA
-- ----------
-- 1) achado 2 (card 101): a checagem de feature usava
--    public.user_has_feature('gestao.portal_v2'), que resolve por bool_or
--    sobre TODAS as IES acessiveis do usuario (vaza entre IES irmas de um
--    mesmo gestor_grupo). Trocada por
--    public.user_has_feature_for_ies('gestao.portal_v2', v_ies) -- a funcao
--    fail-closed por IES criada em 20260804120000. O guard foi MOVIDO para
--    depois da resolução de v_ies (ver aviso critico da rodada): checar a
--    feature contra p_ies_id diretamente estouraria 'feature_not_enabled'
--    para todo gestor que chama sem passar IES, já que p_ies_id pode ser NULL
--    nesse ponto e a função nova é fail-closed para NULL. Ordem final do
--    preâmbulo: papel (Access denied) -> user_can_access_ies -> resolução de
--    v_ies -> feature (feature_not_enabled).
--
-- 2) achado 5 (card 109): o KPI 'simulados' ("x de y") comparava simulados
--    quaisquer da IES com >=1 resposta/TRI contra `simulados_contratados`,
--    sem nenhum vínculo com `ies_simulado_previsto` -- podia passar do
--    contratado, e usava uma definição de "realizado" diferente da do
--    cronograma (get_gestor_cronograma). Agora o numerador é
--    `count(slots do contrato vigente com simulado realizado)`, e "realizado"
--    usa EXATAMENTE o critério de get_gestor_cronograma (participação -- via
--    simulados_finalizados UNION answer_progress -- OU status encerrado/data
--    de encerramento passada, E EXISTS linha em resultados_ies_tri para a
--    IES). Isso é IES-wide, não filtrado pelo recorte de semestre (p_semestre)
--    -- é sobre cumprimento de contrato da instituição, não sobre um recorte
--    de alunos; get_gestor_cronograma (a fonte da verdade desse número) também
--    não recebe p_semestre.
--
-- 3) achado 8 (card 112): dentro da própria função, `n_tri` (denominador de
--    proficientes) já usava count(DISTINCT student_id), mas `n_prof`
--    (numerador) usava count(*) FILTER (linhas de resultados_alunos_tri, não
--    alunos) -- inconsistente com o próprio denominador da função, e é
--    exatamente por isso que `prof_pct` podia passar de 100% (um aluno com
--    2 linhas de TRI para 2 "filhos" do mesmo "pai", ambas >=60, contava 2 no
--    numerador e 1 no denominador). Corrigido para count(DISTINCT student_id)
--    FILTER (...), alinhando com get_gestor_detalhamento (corrigida na mesma
--    rodada, migration 20260804131000, para usar a MESMA convenção de alunos
--    distintos nos dois lados).
--
-- 4) achado 9 (card 113): `meta.lowSample` usava `max()` do tamanho de amostra
--    entre TODOS os simulados realizados do recorte -- uma IES com um
--    simulado antigo de 300 participantes e o atual com 4 teria os KPIs
--    calculados sobre o ponto "atual" (n=4, deveria disparar o aviso de
--    cobertura parcial da §4.10) mas `lowSample` saía `false` porque o
--    simulado antigo "escondia" o n baixo do atual. Trocado para olhar
--    SÓ o ponto rotulado 'atual' em `pontos` (a mesma régua que já alimenta os
--    KPIs de valor/delta/série), então lowSample está sempre coerente com o
--    que os KPIs estão de fato mostrando.
--
-- NADA MAIS MUDOU: SECURITY DEFINER, SET search_path, STABLE, os guards de
-- papel, a chamada a user_can_access_ies, os grants e a assinatura
-- (p_ies_id uuid, p_semestre text) são preservados integralmente.
CREATE OR REPLACE FUNCTION public.get_gestor_visao_geral(p_ies_id uuid, p_semestre text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
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

  -- achado 2: guard de feature por IES, DEPOIS de v_ies resolvido (nunca contra p_ies_id, que pode ser NULL aqui).
  IF NOT public.user_has_feature_for_ies('gestao.portal_v2', v_ies) THEN
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
  tri AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, a.semestre, r.score_proprio
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    JOIN alunos a ON a.id = r.student_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
      AND r.score_proprio IS NOT NULL
  ),
  por_sim AS (
    SELECT s.id, s.nome, s.data_ref, s.ord,
           (SELECT count(DISTINCT t.student_id) FROM tri t WHERE t.pai_id = s.id)              AS n_tri,
           (SELECT avg(t.score_proprio)         FROM tri t WHERE t.pai_id = s.id)              AS prof_media,
           -- achado 8: distinto por aluno, igual ao denominador n_tri (era count(*), linhas de TRI,
           -- o que deixava prof_pct passar de 100% quando o mesmo aluno tinha 2 linhas para 2
           -- "filhos" do mesmo "pai").
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
  areas_nivel AS (
    SELECT t.area, t.amostra,
           round(100.0 * t.acertos / NULLIF(t.total,0), 0) AS acerto_pct,
           CASE WHEN t.total = 0 THEN NULL
                WHEN 100.0 * t.acertos / t.total <  30 THEN 'critico'
                WHEN 100.0 * t.acertos / t.total >= 80 THEN 'excelente'
                ELSE 'mediano' END AS nivel
    FROM areas_tot t
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
  -- achado 5: KPI "x de y" IES-wide, alinhado ao critério de "realizado" de
  -- get_gestor_cronograma -- NÃO filtrado por v_sems (assim como o cronograma
  -- também não recebe p_semestre). Numerador = slots do contrato VIGENTE com
  -- simulado vinculado e "realizado"; denominador = simulados_contratados
  -- desse mesmo contrato.
  kpi_contrato AS (
    SELECT c.id AS contrato_id, c.simulados_contratados
    FROM public.ies_contrato_simulados c
    WHERE c.ies_id = v_ies
    ORDER BY (current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim) DESC, c.vigencia_fim DESC
    LIMIT 1
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
  -- participação = simulados_finalizados UNION answer_progress, igual ao
  -- cronograma (o fallback não é redundância: simulados_finalizados não cobre
  -- todas as IES/simulados -- ver comentário equivalente em
  -- 20260729210100_get_gestor_cronograma.sql).
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
          'contratados', (SELECT kc.simulados_contratados FROM kpi_contrato kc)
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
                 'critica', COALESCE((100.0 * t.acertos / NULLIF(t.total,0)) < 30, false)
               ) ORDER BY t.area)
        FROM areas_tot t), '[]'::jsonb),
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
      -- achado 9: olha SÓ o ponto "atual" (a mesma régua dos KPIs), não o
      -- max() entre todos os simulados do recorte.
      'lowSample',    COALESCE((SELECT GREATEST(p.n_tri, p.n_resp) FROM pontos p WHERE p.rotulo = 'atual'), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_visao_geral(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_visao_geral(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICACAO (rodar em gvqv, autenticado como o gestor de teste -- SECURITY
-- DEFINER + has_role/auth.uid exigem sessão real, não service_role)
-- ---------------------------------------------------------------------------
--
-- 1) Readback: a função foi recriada com o guard novo e o corpo esperado.
--
--    SELECT pg_get_functiondef('public.get_gestor_visao_geral(uuid,text)'::regprocedure);
--    -- confirmar: contém 'user_has_feature_for_ies' (achado 2), contém
--    -- 'kpi_realizados' (achado 5), contém 'count(DISTINCT t.student_id) FILTER'
--    -- na CTE por_sim (achado 8), e a linha de 'lowSample' referencia
--    -- "p.rotulo = 'atual'" (achado 9). NÃO deve mais conter
--    -- "user_has_feature('gestao.portal_v2')" nem "max(GREATEST(".
--
-- 2) Caso funcional do achado 2 (gestor_grupo, IES do grupo com a feature
--    desligada), em transação revertida:
--
--    BEGIN;
--      -- confirmar cenário: IES B do grupo do gestor de teste com
--      -- gestao.portal_v2 = false (ou sem linha) e gestao.enabled = true.
--      SELECT public.get_gestor_visao_geral(:ies_b::uuid, 'geral');
--      -- ESPERADO: exceção 'feature_not_enabled' (ERRCODE 42501) mesmo que
--      -- outra IES do mesmo grupo tenha a feature ligada (antes do fix,
--      -- essa chamada retornava dado).
--    ROLLBACK;
--
-- 3) Caso funcional do achado 5 (KPI "x de y"), em transação revertida:
--
--    BEGIN;
--      SELECT public.get_gestor_visao_geral(:ies_com_contrato::uuid, 'geral')
--             -> 'data' -> 'kpis' -> 'simulados' AS kpi_simulados;
--      -- comparar kpi_simulados.realizados com a contagem manual:
--      SELECT count(*) FROM public.ies_simulado_previsto sp
--        JOIN public.ies_contrato_simulados c ON c.id = sp.contrato_id
--       WHERE sp.ies_id = :ies_com_contrato::uuid
--         AND c.ies_id = :ies_com_contrato::uuid
--         AND (current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim)
--         AND sp.simulado_id IN (
--               SELECT DISTINCT COALESCE(sa.simulado_pai_id, sa.id)
--               FROM public.resultados_ies_tri r
--               JOIN public.simulados_admin sa ON sa.id = r.simulado_id
--               WHERE r.college_id = :ies_com_contrato::uuid
--             );
--      -- ESPERADO: os dois números batem, e kpi_simulados.realizados nunca
--      -- excede kpi_simulados.contratados.
--    ROLLBACK;
--
-- 4) Caso funcional do achado 8 (prof_pct não passa de 100%): escolher uma
--    IES/simulado onde algum aluno tenha 2+ linhas em resultados_alunos_tri
--    para "filhos" do mesmo "pai" (JOIN por COALESCE(simulado_pai_id, id)) e
--    confirmar 'proficientesPct' -> 'valor' <= 100 no JSON de saída.
--
-- 5) Caso funcional do achado 9 (lowSample olha o atual, não o max):
--    escolher uma IES com um simulado antigo de amostra grande e o mais
--    recente com < 10 alunos com resultado; confirmar
--    'meta' -> 'lowSample' = true nessa chamada.
