-- Complete remaining security fixes: Add search_path protection to remaining functions
-- This prevents potential SQL injection and ensures function stability

-- Fix get_simulado_performance function
CREATE OR REPLACE FUNCTION public.get_simulado_performance()
 RETURNS TABLE(area_conhecimento text, acertos bigint, total bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
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

-- Fix get_all_user_performance_by_area function
CREATE OR REPLACE FUNCTION public.get_all_user_performance_by_area()
 RETURNS TABLE(area_name text, simulado_id bigint, simulado_nome text, acertos bigint, total bigint)
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        q."Tema (Grande Área)" AS area_name,
        s.id::bigint AS simulado_id,
        s."Simulado" AS simulado_nome,
        -- Conta as respostas corretas
        COUNT(*) FILTER (WHERE ap.correct = 'TRUE') AS acertos,
        -- Conta o total de questões respondidas naquela área para aquele simulado
        COUNT(*) AS total
    FROM
        public.answer_progress_enamed AS ap
    -- Junta com as questões para obter a Grande Área
    JOIN
        public.questions_enamed AS q ON ap.question_id = q."ID"
    -- Junta com os simulados para obter o nome do simulado
    JOIN
        public."Simulados" AS s ON ap.simulado = s.id
    WHERE
        -- Filtra apenas para o usuário que está fazendo a chamada
        ap.email = auth.email()
    GROUP BY
        q."Tema (Grande Área)", s.id, s."Simulado"
    ORDER BY
        q."Tema (Grande Área)", s.id;
END;
$function$;

-- Fix get_all_user_performance_by_specialty function
CREATE OR REPLACE FUNCTION public.get_all_user_performance_by_specialty()
 RETURNS TABLE(simulado_id integer, simulado_nome text, specialty_name text, total bigint, acertos bigint)
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS simulado_id,
    s."Simulado" AS simulado_nome,
    q."Especialidade" AS specialty_name,
    COUNT(ap.answer_id) AS total,
    COUNT(ap.answer_id) FILTER (WHERE ap.correct) AS acertos
  FROM
    public.answer_progress_enamed AS ap
  JOIN
    public.questions_enamed AS q ON ap.question_id = q."ID"
  JOIN
    public."Simulados" AS s ON ap.simulado = s.id
  WHERE
    ap.email = auth.email()
  GROUP BY
    s.id, s."Simulado", q."Especialidade"
  ORDER BY
    s.id, q."Especialidade";
END;
$function$;

-- Fix get_user_rankings function (parameterized version)
CREATE OR REPLACE FUNCTION public.get_user_rankings(p_simulado_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    current_user_email TEXT := auth.email();
    result jsonb;
BEGIN
    WITH 
    -- 1. Calcula a performance de TODOS os usuários que participaram do simulado.
    user_performance AS (
        SELECT
            u.email,
            u.id_ies,
            u.semestre,
            (COUNT(*) FILTER (WHERE ap.correct))::decimal / NULLIF(COUNT(*), 0) * 100 AS performance
        FROM
            public.answer_progress_enamed AS ap
        JOIN
            public.users AS u ON ap.email = u.email
        WHERE
            (p_simulado_id IS NULL OR ap.simulado = p_simulado_id)
        GROUP BY
            u.email, u.id_ies, u.semestre
    ),
    -- 2. Calcula os rankings para TODOS os usuários de uma só vez.
    all_ranks AS (
        SELECT
            up.email,
            -- Ranking particionado APENAS pela IES (Correto)
            RANK() OVER (PARTITION BY up.id_ies ORDER BY up.performance DESC NULLS LAST) as ies_rank,
            COUNT(*) OVER (PARTITION BY up.id_ies) as ies_total,
            
            -- Ranking particionado PELA IES E PELO SEMESTRE (Agora Corrigido)
            RANK() OVER (PARTITION BY up.id_ies, up.semestre ORDER BY up.performance DESC NULLS LAST) as semester_rank,
            COUNT(*) OVER (PARTITION BY up.id_ies, up.semestre) as semester_total
        FROM
            user_performance up
    )
    -- 3. Selecionamos os dados de ranking do nosso usuário e montamos o JSON.
    SELECT jsonb_build_object(
        'rankingIES', jsonb_build_object('rank', r.ies_rank, 'total', r.ies_total),
        'rankingSemester', jsonb_build_object('rank', r.semester_rank, 'total', r.semester_total)
    ) INTO result
    FROM all_ranks r
    WHERE r.email = current_user_email;

    -- Retorna o resultado ou um objeto nulo caso o usuário não tenha participado
    RETURN COALESCE(result, '{"rankingIES": null, "rankingSemester": null}'::jsonb);

EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error in get_user_rankings: %', SQLERRM;
        RETURN '{"rankingIES": null, "rankingSemester": null}'::jsonb;
END;
$function$;

-- Fix get_user_simulados function
CREATE OR REPLACE FUNCTION public.get_user_simulados()
 RETURNS TABLE(id integer, nome text)
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
RETURN QUERY
SELECT
s.id,
s."Simulado" AS nome
FROM
public."Simulados" AS s
JOIN
public.answer_progress_enamed AS ap ON s.id = ap.simulado
WHERE
ap.email = auth.email()
GROUP BY
s.id, s."Simulado"
ORDER BY
s.id;

END;
$function$;