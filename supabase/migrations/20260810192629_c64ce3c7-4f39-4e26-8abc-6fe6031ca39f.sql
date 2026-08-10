-- Corrige o drill-down de "Acerto por grande área" (Detalhamento): a RPC de
-- especialidades/temas ignorava o semestre selecionado, então "Detalhar"
-- mostrava sempre o recorte cheio. Acrescenta p_semestre text DEFAULT NULL
-- (mesma gramática de get_gestor_detalhamento: NULL/'geral' = todos,
-- '6ano' = todos com 11/12 em evidência, '1'..'12' = corte duro naquele
-- semestre) e aplica o corte na CTE `alunos`.
CREATE OR REPLACE FUNCTION public.get_gestor_detalhamento_temas(
  p_ies_id uuid,
  p_simulados uuid[],
  p_grande_area text,
  p_especialidade text DEFAULT NULL,
  p_semestre text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_ies     uuid;
  v_n       int;
  v_nivel   text;
  v_sems    int[];
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

  IF p_simulados IS NULL OR array_length(p_simulados,1) IS NULL THEN
    RAISE EXCEPTION 'selecao_de_simulados_obrigatoria' USING ERRCODE = '22023';
  END IF;
  v_n := array_length(p_simulados,1);

  IF p_grande_area IS NOT NULL AND btrim(p_grande_area) = '' THEN
    p_grande_area := NULL;
  END IF;
  IF p_grande_area IS NULL THEN
    RAISE EXCEPTION 'grande_area_obrigatoria' USING ERRCODE = '22023';
  END IF;

  IF p_especialidade IS NOT NULL AND btrim(p_especialidade) = '' THEN
    p_especialidade := NULL;
  END IF;

  IF p_semestre IS NOT NULL AND btrim(p_semestre) = '' THEN
    p_semestre := NULL;
  END IF;

  v_nivel := CASE WHEN p_especialidade IS NULL THEN 'especialidade' ELSE 'tema' END;

  -- mesma gramática de semestre de get_gestor_detalhamento (o card de grande
  -- área e este drawer têm de bater no número).
  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_recorte := 'todos os semestres';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int];
    v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  -- resolucao de v_ies (ainda NAO autoriza)
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

  -- autorizacao da IES RESOLVIDA, por papel
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  -- escopo dos simulados recebidos: mesmo bloco de get_gestor_detalhamento.
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
    SELECT sa.id
    FROM public.simulados_admin sa
    WHERE sa.id = ANY (p_simulados)
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
  respostas AS (
    SELECT t.user_id, ap.correct, q.especialidade, q.tema
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
      AND q.grande_area = p_grande_area
  ),
  base AS (
    SELECT CASE WHEN p_especialidade IS NULL THEN r.especialidade ELSE r.tema END AS nome,
           r.user_id, r.correct
    FROM respostas r
    WHERE (p_especialidade IS NULL AND r.especialidade IS NOT NULL)
       OR (p_especialidade IS NOT NULL AND r.especialidade = p_especialidade AND r.tema IS NOT NULL)
  ),
  agg AS (
    SELECT b.nome,
           count(*) AS total,
           count(*) FILTER (WHERE b.correct) AS acertos,
           count(DISTINCT b.user_id) AS amostra,
           round(100.0 * count(*) FILTER (WHERE b.correct) / NULLIF(count(*),0), 0) AS acerto_pct
    FROM base b GROUP BY b.nome
  ),
  nos AS (
    SELECT a.nome,
           a.acerto_pct,
           a.amostra,
           CASE WHEN a.total = 0 THEN NULL
                WHEN a.acerto_pct <  30 THEN 'critico'
                WHEN a.acerto_pct >= 80 THEN 'excelente'
                ELSE 'mediano' END AS desempenho,
           CASE
             WHEN p_especialidade IS NULL THEN EXISTS (
               SELECT 1 FROM respostas r2 WHERE r2.especialidade = a.nome AND r2.tema IS NOT NULL)
             ELSE false
           END AS tem_filhos
    FROM agg a
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',         n.nome,
               'nome',       n.nome,
               'nivel',      v_nivel,
               'acertoPct',  n.acerto_pct,
               'desempenho', n.desempenho,
               'amostra',    n.amostra,
               'lowSample',  (n.amostra < 10),
               'temFilhos',  n.tem_filhos
             ) ORDER BY n.acerto_pct NULLS LAST, n.nome)
      FROM nos n), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo', COALESCE((
        SELECT to_char(min(COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at)),'DD/MM/YYYY')
               || ' — ' ||
               to_char(max(COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at)),'DD/MM/YYYY')
        FROM public.simulados_admin sa WHERE sa.id = ANY (p_simulados)
      ), 'seleção sem data'),
      'fonte',        'answer_progress · questoes_simulado · simulados_admin · simulados_finalizados · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Desempenho em %% de acerto (crítico < 30, mediano 30–80, excelente >= 80) sobre o mesmo valor arredondado exposto em acertoPct, calculado a partir da última tentativa de cada aluno por simulado-pai selecionado, questão anulada ignorada. Nível retornado: %s. Grande área: %s. Especialidade: %s. Recorte de semestre: %s. Amostra = alunos distintos com resposta no nó; lowSample quando < 10. Simulados selecionados: %s.', v_nivel, p_grande_area, COALESCE(p_especialidade,'—'), v_recorte, v_n),
      'partial',      (
        SELECT count(*) FROM respostas r
        WHERE (p_especialidade IS NULL AND r.especialidade IS NULL)
           OR (p_especialidade IS NOT NULL AND r.especialidade = p_especialidade AND r.tema IS NULL)
      ) > 0,
      'lowSample',    COALESCE((SELECT max(n.amostra) FROM nos n), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_detalhamento_temas(uuid, uuid[], text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_gestor_detalhamento_temas(uuid, uuid[], text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_detalhamento_temas(uuid, uuid[], text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gestor_detalhamento_temas(uuid, uuid[], text, text, text) TO service_role;