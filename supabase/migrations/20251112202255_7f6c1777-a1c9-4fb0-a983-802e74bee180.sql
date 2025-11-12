-- Remover funções existentes que serão recriadas
DROP FUNCTION IF EXISTS get_user_performance_aggregates(integer);
DROP FUNCTION IF EXISTS get_user_rankings(integer);
DROP FUNCTION IF EXISTS get_all_user_performance_by_area();
DROP FUNCTION IF EXISTS get_questions_by_subspecialty(text, text, text, integer);
DROP FUNCTION IF EXISTS get_user_simulados();

-- Criar função RPC para buscar simulados do usuário
CREATE OR REPLACE FUNCTION get_user_simulados()
RETURNS TABLE (id integer, nome text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    ap.simulado::integer as id,
    sa.nome
  FROM answer_progress ap
  JOIN simulados_admin sa ON ap.simulado::text = sa.id::text
  WHERE ap.email = auth.email()
  ORDER BY ap.simulado;
END;
$$;

-- Criar função RPC para agregar desempenho do usuário
CREATE OR REPLACE FUNCTION get_user_performance_aggregates(p_simulado_id integer DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH user_answers AS (
    SELECT 
      ap.question_id,
      ap.correct,
      q."Tema (Grande Área)" as area_name,
      q."Especialidade" as specialty_name,
      q."Subespecialidade / Assunto Principal" as subspecialty_name,
      q."NÍVEL DE DIFICULDADE" as difficulty
    FROM answer_progress ap
    JOIN questions_enamed q ON ap.question_id::text = q."ID"
    WHERE ap.email = auth.email()
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
        ORDER BY difficulty
      ) t
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Criar função RPC para rankings do usuário
CREATE OR REPLACE FUNCTION get_user_rankings(p_simulado_id integer DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_ies_id uuid;
  user_semester integer;
  result json;
BEGIN
  -- Buscar IES e semestre do usuário
  SELECT id_ies, semestre INTO user_ies_id, user_semester
  FROM users
  WHERE email = auth.email();

  WITH rankings AS (
    SELECT 
      email,
      COUNT(*) FILTER (WHERE correct = true) as acertos,
      COUNT(*) as total
    FROM answer_progress
    WHERE (p_simulado_id IS NULL OR simulado = p_simulado_id)
    GROUP BY email
  ),
  ies_ranking AS (
    SELECT 
      r.email,
      r.acertos,
      RANK() OVER (ORDER BY r.acertos DESC) as rank
    FROM rankings r
    JOIN users u ON r.email = u.email
    WHERE u.id_ies = user_ies_id
  ),
  semester_ranking AS (
    SELECT 
      r.email,
      r.acertos,
      RANK() OVER (ORDER BY r.acertos DESC) as rank
    FROM rankings r
    JOIN users u ON r.email = u.email
    WHERE u.id_ies = user_ies_id AND u.semestre = user_semester
  )
  SELECT json_build_object(
    'rankingIES', (
      SELECT json_build_object(
        'rank', rank,
        'total', (SELECT COUNT(*) FROM ies_ranking)
      )
      FROM ies_ranking
      WHERE email = auth.email()
    ),
    'rankingSemester', (
      SELECT json_build_object(
        'rank', rank,
        'total', (SELECT COUNT(*) FROM semester_ranking)
      )
      FROM semester_ranking
      WHERE email = auth.email()
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Criar função RPC para evolução de desempenho por área
CREATE OR REPLACE FUNCTION get_all_user_performance_by_area()
RETURNS TABLE (
  simulado_id integer,
  simulado_nome text,
  area_name text,
  total bigint,
  acertos bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.simulado::integer,
    sa.nome as simulado_nome,
    q."Tema (Grande Área)" as area_name,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE ap.correct = true) as acertos
  FROM answer_progress ap
  JOIN questions_enamed q ON ap.question_id::text = q."ID"
  JOIN simulados_admin sa ON ap.simulado::text = sa.id::text
  WHERE ap.email = auth.email()
    AND q."Tema (Grande Área)" IS NOT NULL
  GROUP BY ap.simulado, sa.nome, q."Tema (Grande Área)"
  ORDER BY ap.simulado, q."Tema (Grande Área)";
END;
$$;

-- Criar função RPC para buscar questões por subespecialidade
CREATE OR REPLACE FUNCTION get_questions_by_subspecialty(
  sub_name text,
  p_simulado_id integer DEFAULT NULL,
  area_name text DEFAULT NULL,
  specialty_name text DEFAULT NULL
)
RETURNS TABLE (
  id text,
  gabarito text,
  enunciado text,
  a text,
  b text,
  c text,
  d text,
  comentario text,
  imagem text,
  dificuldade text,
  acertou boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q."ID" as id,
    qc.gabarito,
    qc."ENUNCIADO" as enunciado,
    qc."A" as a,
    qc."B" as b,
    qc."C" as c,
    qc."D" as d,
    qc."Comentário" as comentario,
    qc."IMAGEM" as imagem,
    q."NÍVEL DE DIFICULDADE" as dificuldade,
    ap.correct as acertou
  FROM questions_enamed q
  JOIN questions_enamed_complement qc ON q."ID" = qc."ID"
  LEFT JOIN answer_progress ap ON q."ID" = ap.question_id::text 
    AND ap.email = auth.email()
    AND (p_simulado_id IS NULL OR ap.simulado = p_simulado_id)
  WHERE q."Subespecialidade / Assunto Principal" = sub_name
    AND (area_name IS NULL OR q."Tema (Grande Área)" = area_name)
    AND (specialty_name IS NULL OR q."Especialidade" = specialty_name)
  LIMIT 10;
END;
$$;