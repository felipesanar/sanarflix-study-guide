-- 20260729210800_get_gestor_detalhamento.sql
-- Fase 1 / Task 22 do Portal do Gestor v2.
-- A tela mais regrada do spec (§4.7). Invariantes garantidas NO SERVIDOR:
--  - SEMPRE uma entrada em `metricas` por simulado selecionado, NUNCA uma media
--    unica. Se a RPC nao tem como devolver media, a unica forma de a tela mostrar
--    uma e o componente inventar a conta -- visivel em revisao de codigo.
--  - `questoes` existe SOMENTE com exatamente 1 simulado; `comparativoTemas`
--    somente com 2+. Sao mutuamente exclusivos por construcao, nao por acidente:
--    no modo comparativo o Detalhamento das Questoes fica oculto de proposito.
--  - Selecao nula/vazia e ERRO dedicado, nao array vazio -- o front nao contorna
--    a regra "servidor rejeita lista vazia ou 'todos'" em silencio.
--  - Todo simulado pedido e validado contra o escopo da IES ANTES de qualquer
--    calculo; mover essa checagem para depois exporia metrica de outra IES.
CREATE OR REPLACE FUNCTION public.get_gestor_detalhamento(p_ies_id uuid, p_semestre text, p_simulados uuid[])
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
  v_evid    int[];
  v_recorte text;
  v_n       int;
  v_result  jsonb;
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

  IF p_simulados IS NULL OR array_length(p_simulados,1) IS NULL THEN
    RAISE EXCEPTION 'selecao_de_simulados_obrigatoria' USING ERRCODE = '22023';
  END IF;
  v_n := array_length(p_simulados,1);

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
  tri AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, a.semestre, r.score_proprio
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    JOIN alunos a ON a.id = r.student_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
      AND r.score_proprio IS NOT NULL
  ),
  metricas AS (
    SELECT s.id, s.nome, s.data_ref, s.ord,
           (SELECT count(DISTINCT r.user_id) FROM respostas r WHERE r.pai_id = s.id) AS n_resp,
           (SELECT count(*) FILTER (WHERE r.correct) FROM respostas r WHERE r.pai_id = s.id) AS acertos,
           (SELECT count(*) FROM respostas r WHERE r.pai_id = s.id) AS total,
           (SELECT count(*) FROM tri t WHERE t.pai_id = s.id) AS n_tri,
           (SELECT count(*) FILTER (WHERE t.score_proprio >= 60) FROM tri t WHERE t.pai_id = s.id) AS n_prof,
           (SELECT avg(t.score_proprio) FROM tri t WHERE t.pai_id = s.id) AS prof_media
    FROM sims_ord s
  ),
  areas AS (
    SELECT r.grande_area AS area,
           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos
    FROM respostas r WHERE r.grande_area IS NOT NULL GROUP BY r.grande_area
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
  -- questões: só quando exatamente 1 simulado (primeira página, 20 itens)
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
             'correta',    (a.letra = f.correta),
             'marcadaPct', CASE WHEN f.marcadas > 0 THEN round(100.0 * a.n / f.marcadas, 0) END
           ) ORDER BY a.letra) AS alternativas,
           (SELECT d.letra FROM (VALUES ('A',f.m_a),('B',f.m_b),('C',f.m_c),('D',f.m_d),('E',f.m_e)) AS d(letra,n)
             WHERE d.letra <> f.correta AND d.n > 0 ORDER BY d.n DESC, d.letra LIMIT 1) AS distrator
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
                   'acertoPct', round(100.0 * a.acertos / NULLIF(a.total,0), 0),
                   'critica',   COALESCE((100.0 * a.acertos / NULLIF(a.total,0)) < 30, false)
                 ) ORDER BY a.area)
          FROM areas a), '[]'::jsonb),
        'semestres', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'semestre',    s.semestre,
                   'acertoPct',   round(100.0 * s.acertos / NULLIF(s.total,0), 0),
                   'emEvidencia', COALESCE(s.semestre = ANY (v_evid), false)
                 ) ORDER BY s.semestre)
          FROM semestres s), '[]'::jsonb)
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
      'criterio',     format('Uma entrada em metricas por simulado selecionado; nenhuma média entre simulados. Conceito ENAMED por simulado, derivado do %% de proficientes (>= 60). %% de acerto sobre a última tentativa de cada aluno, questão anulada ignorada. Questões só com 1 simulado selecionado; comparativo por tema só com 2 ou mais. Simulados selecionados: %s. Recorte: %s.', v_n, v_recorte),
      'partial',      (SELECT count(*) FROM metricas WHERE n_tri = 0) > 0,
      'lowSample',    COALESCE((SELECT min(GREATEST(m.n_resp, m.n_tri)) FROM metricas m), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_detalhamento(uuid, text, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_detalhamento(uuid, text, uuid[]) TO authenticated;
