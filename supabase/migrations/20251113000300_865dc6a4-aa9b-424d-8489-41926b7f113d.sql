-- Atualizar funções RPC para usar UUID ao invés de integer para simulado_id

-- Drop e recriar get_user_rankings com UUID
DROP FUNCTION IF EXISTS public.get_user_rankings(integer);
DROP FUNCTION IF EXISTS public.get_user_rankings();

CREATE OR REPLACE FUNCTION public.get_user_rankings(p_simulado_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- Drop e recriar get_user_performance_aggregates com UUID
DROP FUNCTION IF EXISTS public.get_user_performance_aggregates(integer);
DROP FUNCTION IF EXISTS public.get_user_performance_aggregates();

CREATE OR REPLACE FUNCTION public.get_user_performance_aggregates(p_simulado_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- Drop e recriar get_all_user_performance_by_area com UUID
DROP FUNCTION IF EXISTS public.get_all_user_performance_by_area();

CREATE OR REPLACE FUNCTION public.get_all_user_performance_by_area()
RETURNS TABLE(simulado_id uuid, simulado_nome text, area_name text, total bigint, acertos bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ap.simulado,
    sa.nome as simulado_nome,
    q."Tema (Grande Área)" as area_name,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE ap.correct = true) as acertos
  FROM answer_progress ap
  JOIN questions_enamed q ON ap.question_id::text = q."ID"
  JOIN simulados_admin sa ON ap.simulado = sa.id
  WHERE ap.email = auth.email()
    AND q."Tema (Grande Área)" IS NOT NULL
  GROUP BY ap.simulado, sa.nome, q."Tema (Grande Área)"
  ORDER BY ap.simulado, q."Tema (Grande Área)";
END;
$function$;

-- Drop e recriar get_questions_by_subspecialty com UUID
DROP FUNCTION IF EXISTS public.get_questions_by_subspecialty(text, integer, text, text);
DROP FUNCTION IF EXISTS public.get_questions_by_subspecialty(text);

CREATE OR REPLACE FUNCTION public.get_questions_by_subspecialty(
  sub_name text, 
  p_simulado_id uuid DEFAULT NULL, 
  area_name text DEFAULT NULL, 
  specialty_name text DEFAULT NULL
)
RETURNS TABLE(
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
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    qs.id::text as id,
    qs.correta as gabarito,
    qs.enunciado as enunciado,
    qs.alternativa_a as a,
    qs.alternativa_b as b,
    qs.alternativa_c as c,
    qs.alternativa_d as d,
    COALESCE(qs.comentario, '') as comentario,
    COALESCE(qs.imagem, '') as imagem,
    COALESCE(qs.grau_dificuldade::text, 'Médio') as dificuldade,
    COALESCE(ap.acertou, false) as acertou
  FROM questoes_simulado qs
  LEFT JOIN (
    SELECT question_id::text AS question_id, BOOL_OR(correct) AS acertou
    FROM answer_progress
    WHERE email = auth.email() AND (p_simulado_id IS NULL OR simulado = p_simulado_id)
    GROUP BY question_id
  ) ap ON qs.id::text = ap.question_id
  WHERE (p_simulado_id IS NULL OR qs.simulado_id = p_simulado_id)
    AND (area_name IS NULL OR qs.tema = area_name)
    AND (specialty_name IS NULL OR qs.especialidade = specialty_name)
    AND (sub_name IS NULL OR qs.grande_area = sub_name)
  ORDER BY qs.ordem
  LIMIT 10;
END;
$function$;