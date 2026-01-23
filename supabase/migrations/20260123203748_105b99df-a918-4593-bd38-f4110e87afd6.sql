-- 1. Remover espaços extras no início e fim
UPDATE questoes_simulado 
SET grau_dificuldade = TRIM(grau_dificuldade)
WHERE grau_dificuldade IS NOT NULL AND grau_dificuldade != TRIM(grau_dificuldade);

-- 2. Corrigir "Medio" para "Médio"
UPDATE questoes_simulado 
SET grau_dificuldade = 'Médio'
WHERE LOWER(TRIM(grau_dificuldade)) = 'medio';

-- 3. Padronizar "Fácil/Médio" para "Médio"
UPDATE questoes_simulado 
SET grau_dificuldade = 'Médio'
WHERE LOWER(TRIM(grau_dificuldade)) = 'fácil/médio';

-- 4. Atualizar a função RPC para normalizar dificuldade em tempo real
CREATE OR REPLACE FUNCTION public.get_user_performance_aggregates(p_simulado_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$DECLARE
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
    WHERE ap.user_id = auth.uid()
      AND (p_simulado_id IS NULL OR ap.simulado = p_simulado_id)
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
END;$function$;