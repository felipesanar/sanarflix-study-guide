-- Update database functions to include explicit search_path for security
-- This prevents search_path injection attacks

CREATE OR REPLACE FUNCTION public.get_user_ies_id()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_ies_id UUID;
BEGIN
  SELECT id_ies INTO user_ies_id
  FROM public.users
  WHERE id = auth.uid()::TEXT;
  RETURN user_ies_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_faculty()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT i.nome 
  FROM public.users u
  JOIN public.ies i ON u.id_ies = i.id
  WHERE u.id = auth.uid()::TEXT;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_ies_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id_ies FROM public.users WHERE id = auth.uid()::TEXT;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_semester()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT semestre FROM public.users WHERE id = auth.uid()::TEXT;
$function$;

CREATE OR REPLACE FUNCTION public.get_conteudos_for_user(user_id_ies uuid, user_semestre integer)
 RETURNS TABLE(conteudos jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.conteudos
  FROM public.conteudos c
  WHERE c.id_ies = user_id_ies
    AND c.semestre = user_semestre;
END;
$function$;

-- Update other critical functions with explicit search_path
CREATE OR REPLACE FUNCTION public.get_simulado_performance()
 RETURNS TABLE(area_conhecimento text, acertos bigint, total bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        q."Tema (Grande Área)" AS area_conhecimento,
        COUNT(*) FILTER (WHERE a.correct = true) AS acertos,
        COUNT(*) AS total
    FROM
        public.answer_progress_enamed AS a
    JOIN
        public.questions_enamed AS q ON a.question_id = q."ID"
    WHERE
        a.email = auth.jwt()->>'email'
    GROUP BY
        q."Tema (Grande Área)";
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_performance_aggregates()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$DECLARE
    overall_stats jsonb;
    by_area jsonb;
    by_specialty jsonb;
    by_subspecialty jsonb;
    by_difficulty jsonb;
BEGIN
    -- Estatísticas gerais (sem alterações)
    SELECT jsonb_build_object(
        'total', COUNT(*),
        'acertos', COUNT(*) FILTER (WHERE correct = true)
    ) INTO overall_stats
    FROM public.answer_progress_enamed a
    JOIN public.questions_enamed q ON a.question_id = q."ID"
    WHERE a.email = auth.jwt()->>'email';
    
    -- Por área (sem alterações)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'name', area,
            'total', total_count,
            'acertos', correct_count
        )
    ), '[]'::jsonb) INTO by_area
    FROM (
        SELECT 
            q."Tema (Grande Área)" as area,
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE a.correct = true) as correct_count
        FROM public.answer_progress_enamed a
        JOIN public.questions_enamed q ON a.question_id = q."ID"
        WHERE a.email = auth.jwt()->>'email' AND q."Tema (Grande Área)" IS NOT NULL
        GROUP BY q."Tema (Grande Área)"
    ) area_stats;
    
    -- Por especialidade (Correto, sem alterações)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'name', specialty,
            'area_name', area,
            'total', total_count,
            'acertos', correct_count
        )
    ), '[]'::jsonb) INTO by_specialty
    FROM (
        SELECT 
            q."Especialidade" as specialty,
            q."Tema (Grande Área)" as area,
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE a.correct = true) as correct_count
        FROM public.answer_progress_enamed a
        JOIN public.questions_enamed q ON a.question_id = q."ID"
        WHERE a.email = auth.jwt()->>'email' AND q."Especialidade" IS NOT NULL
        GROUP BY q."Especialidade", q."Tema (Grande Área)"
    ) specialty_stats;
    
    -- Por subespecialidade (COM A CORREÇÃO FINAL)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'name', subspecialty,
            'specialty_name', specialty,
            'area_name', area,
            'total', total_count,
            'acertos', correct_count
        )
    ), '[]'::jsonb) INTO by_subspecialty
    FROM (
        SELECT 
            q."Subespecialidade / Assunto Principal" as subspecialty,
            q."Especialidade" as specialty,
            q."Tema (Grande Área)" as area,
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE a.correct = true) as correct_count
        FROM public.answer_progress_enamed a
        JOIN public.questions_enamed q ON a.question_id = q."ID"
        WHERE a.email = auth.jwt()->>'email' AND q."Subespecialidade / Assunto Principal" IS NOT NULL
        GROUP BY q."Subespecialidade / Assunto Principal", q."Especialidade", q."Tema (Grande Área)"
    ) subspecialty_stats;
    
    -- Por dificuldade (sem alterações)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'name', difficulty,
            'total', total_count,
            'acertos', correct_count
        )
    ), '[]'::jsonb) INTO by_difficulty
    FROM (
        SELECT 
            q."NÍVEL DE DIFICULDADE" as difficulty,
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE a.correct = true) as correct_count
        FROM public.answer_progress_enamed a
        JOIN public.questions_enamed q ON a.question_id = q."ID"
        WHERE a.email = auth.jwt()->>'email' AND q."NÍVEL DE DIFICULDADE" IS NOT NULL
        GROUP BY q."NÍVEL DE DIFICULDADE"
    ) difficulty_stats;
    
    RETURN jsonb_build_object(
        'overallStats', COALESCE(overall_stats, '{"total":0, "acertos":0}'::jsonb),
        'byArea', by_area,
        'bySpecialty', by_specialty,
        'bySubspecialty', by_subspecialty,
        'byDifficulty', by_difficulty
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_rankings()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    current_user_email TEXT := auth.jwt()->>'email';
    current_user_ies_id UUID;
    current_user_semester INT;
    result jsonb;
BEGIN
    SELECT u.id_ies, u.semestre INTO current_user_ies_id, current_user_semester
    FROM public.users u WHERE u.email = current_user_email;
    
    IF NOT FOUND THEN
        RETURN '{"rankingIES": null, "rankingSemester": null}'::jsonb;
    END IF;

    WITH all_performance AS (
        SELECT u.email, u.semestre, (COUNT(*) FILTER (WHERE a.correct = true))::FLOAT / NULLIF(COUNT(*), 0) AS performance
        FROM public.answer_progress_enamed a
        JOIN public.users u ON a.email = u.email
        WHERE u.id_ies = current_user_ies_id
        GROUP BY u.email, u.semestre
    ),
    ies_ranks AS (
        SELECT email, RANK() OVER (ORDER BY performance DESC NULLS LAST) as rank FROM all_performance
    ),
    semester_ranks AS (
        SELECT email, RANK() OVER (ORDER BY performance DESC NULLS LAST) as rank FROM all_performance WHERE semestre = current_user_semester
    )
    SELECT jsonb_build_object(
        'rankingIES', (SELECT jsonb_build_object('rank', r.rank, 'total', (SELECT COUNT(*) FROM ies_ranks)) FROM ies_ranks r WHERE r.email = current_user_email),
        'rankingSemester', (SELECT jsonb_build_object('rank', r.rank, 'total', (SELECT COUNT(*) FROM semester_ranks)) FROM semester_ranks r WHERE r.email = current_user_email)
    ) INTO result;
    
    RETURN COALESCE(result, '{}'::jsonb);
END;
$function$;