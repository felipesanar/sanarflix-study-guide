
-- 1) Reescreve get_institutional_evolution com filtro IES upfront
CREATE OR REPLACE FUNCTION public.get_institutional_evolution(p_ies_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_ies_id  uuid;
  result    json;
BEGIN
  v_user_id := auth.uid();
  IF NOT (
       has_role(v_user_id, 'admin')
    OR has_role(v_user_id, 'professor')
    OR has_role(v_user_id, 'gestor')
    OR has_role(v_user_id, 'gestor_grupo')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_user_id, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies_id := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies_id FROM users u WHERE u.id = v_user_id;
    IF v_ies_id IS NULL THEN
      v_ies_id := (public.get_accessible_ies(v_user_id))[1];
    END IF;
  END IF;

  IF v_ies_id IS NULL THEN
    RETURN '[]'::json;
  END IF;

  WITH sims AS (
    SELECT sa.id, sa.nome, sa.created_at
    FROM simulados_admin sa
    WHERE v_ies_id = ANY(sa.ies_ids)
      AND sa.status IN ('ativo', 'encerrado')
      AND sa.simulado_pai_id IS NULL
      AND (sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= NOW())
        OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= NOW()))))
  ),
  ies_users AS (
    SELECT u.id FROM users u WHERE u.id_ies = v_ies_id
  ),
  ies_answers AS (
    SELECT ap.simulado, q.grande_area, ap.correct
    FROM answer_progress ap
    JOIN ies_users iu        ON iu.id = ap.user_id
    JOIN questoes_simulado q ON q.id = ap.question_id
    WHERE ap.simulado IN (SELECT id FROM sims)
      AND q.grande_area IS NOT NULL
  ),
  agg AS (
    SELECT simulado, grande_area,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE correct) AS acertos
    FROM ies_answers
    GROUP BY simulado, grande_area
  ),
  per_sim AS (
    SELECT s.id AS simulado_id, s.nome AS simulado_nome, s.created_at,
      COALESCE(
        (SELECT json_agg(json_build_object(
            'area', a.grande_area,
            'total', a.total,
            'acertos', a.acertos,
            'percentual', ROUND(a.acertos::numeric / NULLIF(a.total,0) * 100)
        )) FROM agg a WHERE a.simulado = s.id),
        '[]'::json
      ) AS areas
    FROM sims s
    WHERE EXISTS (SELECT 1 FROM agg a WHERE a.simulado = s.id)
  )
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at), '[]'::json)
  INTO result
  FROM per_sim t;

  RETURN result;
END;
$function$;

-- 2) Índices de apoio (idempotentes)
CREATE INDEX IF NOT EXISTS idx_answer_progress_simulado_user
  ON public.answer_progress (simulado, user_id);

CREATE INDEX IF NOT EXISTS idx_answer_progress_user_simulado
  ON public.answer_progress (user_id, simulado);

CREATE INDEX IF NOT EXISTS idx_questoes_simulado_id
  ON public.questoes_simulado (id);

CREATE INDEX IF NOT EXISTS idx_users_id_ies
  ON public.users (id_ies);
