-- Task 1c: get_gestor_prova_oficial(p_ies_id uuid, p_semestre text)
-- Bloco da prova oficial no portal do gestor. Copiado (parametros, guard de
-- papel, gestor_pode_acessar_ies, recorte por semestre, RELEASED(s) verbatim)
-- de public.get_gestor_visao_geral (pg_get_functiondef lido em prod antes de
-- escrever esta funcao). NAO usa prova_oficial_liberada_aluno (gate so de aluno).
CREATE OR REPLACE FUNCTION public.get_gestor_prova_oficial(p_ies_id uuid, p_semestre text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_ies     uuid;
  v_sems    int[];
  v_geral   boolean := false;
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

  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_geral := true;
    v_sems := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := ARRAY[11,12];
    v_recorte := 'somente o 6º ano (11º e 12º semestres)';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int];
    v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  WITH recorte AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
  ),
  provas_admin AS (
    SELECT sa.id, sa.nome,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
    FROM (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed' AND prova_oficial) sa
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
  participantes AS (
    SELECT ap.simulado AS simulado_id, count(DISTINCT ap.user_id) AS n
    FROM public.answer_progress ap
    JOIN recorte r ON r.id = ap.user_id
    WHERE ap.simulado IN (SELECT id FROM provas_admin)
    GROUP BY ap.simulado
  ),
  -- Um registro por (simulado, aluno): a melhor tentativa, igual ao criterio
  -- de desempate ja usado em get_gestor_visao_geral / get_gestor_aluno.
  tri_dedup AS (
    SELECT DISTINCT ON (r.simulado_id, r.student_id) r.simulado_id, r.student_id, r.score_proprio
    FROM public.resultados_alunos_tri r
    JOIN recorte rc ON rc.id = r.student_id
    WHERE r.college_id = v_ies
      AND r.simulado_id IN (SELECT id FROM provas_admin)
      AND r.score_proprio IS NOT NULL
    ORDER BY r.simulado_id, r.student_id, r.score_proprio DESC
  ),
  tri_agg AS (
    SELECT simulado_id,
           count(*) AS n_tri,
           count(*) FILTER (WHERE score_proprio >= 60) AS n_prof
    FROM tri_dedup
    GROUP BY simulado_id
  ),
  conceito_ies AS (
    SELECT r.simulado_id, max(r.concept) AS concept
    FROM public.resultados_ies_tri r
    WHERE r.college_id = v_ies
      AND r.simulado_id IN (SELECT id FROM provas_admin)
    GROUP BY r.simulado_id
  ),
  respostas AS (
    SELECT ap.simulado AS simulado_id, ap.user_id, ap.correct
    FROM public.answer_progress ap
    JOIN recorte rc ON rc.id = ap.user_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE ap.simulado IN (SELECT id FROM provas_admin)
      AND COALESCE(q.anulada,false) = false
  ),
  media_acertos AS (
    SELECT simulado_id, round(avg(acertos_aluno), 1) AS media
    FROM (
      SELECT simulado_id, user_id, count(*) FILTER (WHERE correct) AS acertos_aluno
      FROM respostas
      GROUP BY simulado_id, user_id
    ) x
    GROUP BY simulado_id
  ),
  total_questoes AS (
    SELECT q.simulado_id, count(*) AS total
    FROM public.questoes_simulado q
    WHERE q.simulado_id IN (SELECT id FROM provas_admin)
      AND COALESCE(q.anulada,false) = false
    GROUP BY q.simulado_id
  ),
  caderno2 AS (
    SELECT c.simulado_id, jsonb_object_agg(q.numero_questao::text, c.posicao) AS mapa
    FROM public.simulado_cadernos c
    JOIN public.questoes_simulado q ON q.id = c.question_id
    WHERE c.simulado_id IN (SELECT id FROM provas_admin)
      AND c.caderno = 2
    GROUP BY c.simulado_id
  ),
  provas AS (
    SELECT p.id, p.nome, p.data_ref,
           COALESCE(pt.n, 0)      AS participantes,
           COALESCE(ta.n_tri, 0)  AS comtri,
           ta.n_prof,
           ci.concept             AS conceito_oficial,
           ma.media               AS media_acertos,
           COALESCE(tq.total, 0)  AS total_questoes,
           COALESCE(c2.mapa, '{}'::jsonb) AS mapa_caderno2
    FROM provas_admin p
    LEFT JOIN participantes pt  ON pt.simulado_id = p.id
    LEFT JOIN tri_agg ta        ON ta.simulado_id = p.id
    LEFT JOIN conceito_ies ci   ON ci.simulado_id = p.id
    LEFT JOIN media_acertos ma  ON ma.simulado_id = p.id
    LEFT JOIN total_questoes tq ON tq.simulado_id = p.id
    LEFT JOIN caderno2 c2       ON c2.simulado_id = p.id
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'provas', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'simuladoId', pv.id,
                 'nome', pv.nome,
                 'data', to_char(pv.data_ref AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 'participantes', pv.participantes,
                 'comTri', pv.comtri,
                 'conceito', CASE WHEN pv.comtri = 0 THEN NULL
                                  WHEN v_geral AND pv.conceito_oficial IS NOT NULL THEN pv.conceito_oficial
                                  WHEN 100.0 * pv.n_prof / pv.comtri >= 90 THEN 5
                                  WHEN 100.0 * pv.n_prof / pv.comtri >= 75 THEN 4
                                  WHEN 100.0 * pv.n_prof / pv.comtri >= 60 THEN 3
                                  WHEN 100.0 * pv.n_prof / pv.comtri >= 40 THEN 2
                                  ELSE 1
                             END,
                 'proficientesPct', CASE WHEN pv.comtri = 0 THEN NULL ELSE round(100.0 * pv.n_prof / pv.comtri) END,
                 'mediaAcertos', pv.media_acertos,
                 'totalQuestoes', pv.total_questoes,
                 'amostraPequena', pv.participantes < 10,
                 'numeracaoCaderno2', pv.mapa_caderno2
               ) ORDER BY pv.data_ref DESC NULLS LAST)
        FROM provas pv), '[]'::jsonb),
      'idsProvasOficiais', COALESCE((
        SELECT jsonb_agg(pv.id ORDER BY pv.data_ref DESC NULLS LAST) FROM provas pv), '[]'::jsonb)
    ),
    'meta', jsonb_build_object(
      'periodo', COALESCE((SELECT to_char(min(pv.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(pv.data_ref),'DD/MM/YYYY')
                           FROM provas pv), 'sem prova oficial com resultado'),
      'fonte', 'answer_progress · resultados_alunos_tri · resultados_ies_tri · questoes_simulado · simulado_cadernos · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio', format(
        'Bloco da prova oficial ENAMED: proficiência considerada a partir de 60 pontos; conceito ENAMED 1–5 %s. Recorte: %s.',
        CASE WHEN v_geral THEN 'do resultado institucional consolidado quando disponível, senão derivado do % de proficientes do recorte'
             ELSE 'derivado do % de proficientes do recorte (>=90:5, >=75:4, >=60:3, >=40:2, senão 1)' END,
        v_recorte),
      'partial',   COALESCE((SELECT bool_or(pv.comtri = 0) FROM provas pv), false),
      'lowSample', COALESCE((SELECT pv.participantes < 10 FROM provas pv ORDER BY pv.data_ref DESC NULLS LAST LIMIT 1), false)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_prova_oficial(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_prova_oficial(uuid, text) TO authenticated;
