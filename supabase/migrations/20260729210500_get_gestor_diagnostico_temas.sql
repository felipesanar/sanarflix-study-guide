-- 20260729210500_get_gestor_diagnostico_temas.sql
-- Fase 1 / Task 19 do Portal do Gestor v2.
-- Terceiro e ultimo nivel da hierarquia (grande_area -> especialidade -> tema).
-- Funcao propria, e nao mais um parametro da Task 18, porque o contrato de
-- retorno e outro (TemaCritico[], sem `nivel` e sem `temFilhos`) e porque
-- p_especialidade e OBRIGATORIO -- nao existe "nivel temas geral".
--
-- Tema NUNCA tem proficiencia: nao ha TRI por tema e a spec proibe misturar as
-- duas escalas fora de aluno e simulado (§4.1). Ordem crescente de acerto
-- (pior tema primeiro) e intencional: o diagnostico existe para agir onde dói.
CREATE OR REPLACE FUNCTION public.get_gestor_diagnostico_temas(p_ies_id uuid, p_semestre text, p_especialidade text)
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

  IF p_especialidade IS NULL OR btrim(p_especialidade) = '' THEN
    RAISE EXCEPTION 'especialidade_obrigatoria' USING ERRCODE = '22023';
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
      'criterio',     format('Tema em %% de acerto sobre a última tentativa de cada aluno, questão anulada ignorada. Proficiência não se aplica a tema. Especialidade: %s. Recorte: %s.', p_especialidade, v_recorte),
      'partial',      false,
      'lowSample',    COALESCE((SELECT max(t.amostra) FROM temas t), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_diagnostico_temas(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_diagnostico_temas(uuid, text, text) TO authenticated;
