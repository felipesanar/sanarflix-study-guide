-- Corrigir vazamento de dados: filtrar por liberação de desempenho nas funções RPC

-- 1. Atualizar get_user_performance_aggregates para filtrar simulados não liberados
CREATE OR REPLACE FUNCTION public.get_user_performance_aggregates(p_simulado_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH user_answers AS (
    SELECT 
      ap.question_id,
      ap.correct,
      q.grande_area as area_name,
      q.especialidade as specialty_name,
      q.tema as subspecialty_name,
      CASE 
        WHEN LOWER(TRIM(q.grau_dificuldade)) IN ('fácil', 'facil') THEN 'Fácil'
        WHEN LOWER(TRIM(q.grau_dificuldade)) IN ('médio', 'medio', 'moderado', 'fácil/médio') THEN 'Médio'
        WHEN LOWER(TRIM(q.grau_dificuldade)) IN ('difícil', 'dificil') THEN 'Difícil'
        ELSE COALESCE(TRIM(q.grau_dificuldade), 'Médio')
      END as difficulty
    FROM answer_progress ap
    JOIN questoes_simulado q ON ap.question_id = q.id
    JOIN simulados_admin sa ON ap.simulado = sa.id
    WHERE ap.user_id = auth.uid()
      AND (p_simulado_id IS NULL OR ap.simulado = p_simulado_id)
      -- Filtro de liberação de desempenho (aplicado apenas quando p_simulado_id é NULL)
      AND (
        p_simulado_id IS NOT NULL  -- Se um simulado específico foi passado, não filtra (já foi validado pelo dropdown)
        OR sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado' 
            AND sa.data_liberacao_desempenho IS NOT NULL 
            AND sa.data_liberacao_desempenho <= NOW())
        OR (sa.liberacao_desempenho = 'ao_encerrar' 
            AND (sa.status = 'encerrado' 
                 OR (sa.data_encerramento IS NOT NULL 
                     AND sa.data_encerramento <= NOW())))
      )
  )
  SELECT json_build_object(
    'overallStats', (
      SELECT json_build_object(
        'total', COUNT(*),
        'acertos', COUNT(*) FILTER (WHERE correct = true)
      )
      FROM user_answers
    ),
    'byArea', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          area_name as name,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE correct = true) as acertos
        FROM user_answers
        WHERE area_name IS NOT NULL
        GROUP BY area_name
        ORDER BY area_name
      ) t
    ),
    'bySpecialty', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          specialty_name as name,
          area_name,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE correct = true) as acertos
        FROM user_answers
        WHERE specialty_name IS NOT NULL
        GROUP BY specialty_name, area_name
        ORDER BY specialty_name
      ) t
    ),
    'bySubspecialty', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          subspecialty_name as name,
          specialty_name,
          area_name,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE correct = true) as acertos
        FROM user_answers
        WHERE subspecialty_name IS NOT NULL
        GROUP BY subspecialty_name, specialty_name, area_name
        ORDER BY subspecialty_name
      ) t
    ),
    'byDifficulty', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          difficulty as name,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE correct = true) as acertos
        FROM user_answers
        WHERE difficulty IS NOT NULL
        GROUP BY difficulty
        ORDER BY 
          CASE difficulty 
            WHEN 'Fácil' THEN 1 
            WHEN 'Médio' THEN 2 
            WHEN 'Difícil' THEN 3 
            ELSE 4 
          END
      ) t
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 2. Atualizar get_all_user_performance_by_area para filtrar simulados não liberados
CREATE OR REPLACE FUNCTION public.get_all_user_performance_by_area()
RETURNS TABLE (
  simulado_id uuid,
  simulado_nome text,
  area_name text,
  total bigint,
  acertos bigint
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.simulado as simulado_id,
    sa.nome as simulado_nome,
    q."grande_area" as area_name,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE ap.correct = true) as acertos
  FROM answer_progress ap
  JOIN questoes_simulado q ON ap.question_id = q."id"
  JOIN simulados_admin sa ON ap.simulado = sa.id
  WHERE ap.user_id = auth.uid()
    AND q."grande_area" IS NOT NULL
    -- Filtro de liberação de desempenho
    AND (
      sa.liberacao_desempenho = 'imediato'
      OR (sa.liberacao_desempenho = 'agendado' 
          AND sa.data_liberacao_desempenho IS NOT NULL 
          AND sa.data_liberacao_desempenho <= NOW())
      OR (sa.liberacao_desempenho = 'ao_encerrar' 
          AND (sa.status = 'encerrado' 
               OR (sa.data_encerramento IS NOT NULL 
                   AND sa.data_encerramento <= NOW())))
    )
  GROUP BY ap.simulado, sa.nome, q."grande_area"
  ORDER BY ap.simulado, q."grande_area";
END;
$$;