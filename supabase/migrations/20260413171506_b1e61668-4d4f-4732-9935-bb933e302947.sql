
CREATE OR REPLACE FUNCTION public.get_theme_evolution(p_tema text, p_ies_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_ies_id uuid;
  result json;
BEGIN
  v_user_id := auth.uid();
  IF NOT (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'professor') OR has_role(v_user_id, 'b2b_partner') OR has_role(v_user_id, 'gestor')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL AND (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'b2b_partner')) THEN
    v_ies_id := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies_id FROM users u WHERE u.id = v_user_id;
  END IF;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at), '[]'::json)
  FROM (
    SELECT sa.nome AS simulado_nome, sa.created_at,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE ap.correct) AS acertos,
      ROUND(COUNT(*) FILTER (WHERE ap.correct)::numeric / NULLIF(COUNT(*), 0) * 100) AS percentual
    FROM simulados_admin sa
    JOIN questoes_simulado q ON q.simulado_id = sa.id AND q.tema = p_tema
    JOIN answer_progress ap ON ap.question_id = q.id AND ap.simulado = sa.id
    JOIN users u ON ap.user_id = u.id AND u.id_ies = v_ies_id
    WHERE v_ies_id = ANY(sa.ies_ids)
      AND sa.status IN ('ativo', 'encerrado')
      AND (
        sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= NOW())
        OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= NOW())))
      )
    GROUP BY sa.id, sa.nome, sa.created_at
    HAVING COUNT(*) > 0
  ) t
  INTO result;

  RETURN result;
END;
$$;
