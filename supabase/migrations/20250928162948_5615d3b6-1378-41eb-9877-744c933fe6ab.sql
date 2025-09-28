-- Fix security warnings: Set search_path for critical functions
-- This prevents potential SQL injection and ensures function stability

-- Fix get_user_performance_aggregates function
CREATE OR REPLACE FUNCTION public.get_user_performance_aggregates()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
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

-- Fix get_question_by_subspecialty function
CREATE OR REPLACE FUNCTION public.get_question_by_subspecialty(sub_name text, p_simulado_id integer DEFAULT NULL::integer)
 RETURNS TABLE(id text, gabarito text, enunciado text, a text, b text, c text, d text, comentario text, imagem text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
    qc."IMAGEM" as imagem
  FROM
    public.questions_enamed AS q
  JOIN
    public.questions_enamed_complement AS qc ON q."ID" = qc."ID"
  -- O JOIN abaixo garante que estamos pegando uma questão que o usuário respondeu
  JOIN
    public.answer_progress_enamed AS ap ON q."ID" = ap.question_id
  WHERE
    ap.email = auth.email() AND
    q."Subespecialidade / Assunto Principal" = sub_name AND
    (p_simulado_id IS NULL OR ap.simulado = p_simulado_id)
  ORDER BY
    random() -- Pega uma questão aleatória que corresponda aos critérios
  LIMIT 1;
END;
$function$;