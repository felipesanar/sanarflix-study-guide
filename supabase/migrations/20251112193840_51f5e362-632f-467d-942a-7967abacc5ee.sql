-- Corrigir a função get_user_performance_aggregates para fazer cast correto de tipos
DROP FUNCTION IF EXISTS public.get_user_performance_aggregates(integer);

CREATE OR REPLACE FUNCTION public.get_user_performance_aggregates(p_simulado_id integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (
    WITH base_query AS (
      SELECT
        ap.correct,
        q."Tema (Grande Área)" AS area_name,
        q."Especialidade" AS specialty_name,
        q."Subespecialidade / Assunto Principal" AS subspecialty_name,
        q."NÍVEL DE DIFICULDADE" AS difficulty_name
      FROM
        public.answer_progress_enamed AS ap
      JOIN
        public.questions_enamed AS q ON ap.question_id::text = q."ID"
      WHERE
        ap.email = auth.email()
        AND (p_simulado_id IS NULL OR ap.simulado = p_simulado_id)
    )
    SELECT jsonb_build_object(
      'overallStats',   (SELECT jsonb_build_object('total', COUNT(*), 'acertos', COUNT(*) FILTER (WHERE correct)) FROM base_query),
      'byArea',         (SELECT jsonb_agg(t) FROM (SELECT area_name AS name, COUNT(*) AS total, COUNT(*) FILTER (WHERE correct) AS acertos FROM base_query GROUP BY area_name) t),
      'bySpecialty',    (SELECT jsonb_agg(t) FROM (SELECT specialty_name AS name, area_name, COUNT(*) AS total, COUNT(*) FILTER (WHERE correct) AS acertos FROM base_query GROUP BY specialty_name, area_name) t),
      'bySubspecialty', (SELECT jsonb_agg(t) FROM (SELECT subspecialty_name AS name, specialty_name, area_name, COUNT(*) AS total, COUNT(*) FILTER (WHERE correct) AS acertos FROM base_query GROUP BY subspecialty_name, specialty_name, area_name) t),
      'byDifficulty',   (SELECT jsonb_agg(t) FROM (SELECT difficulty_name AS name, COUNT(*) AS total, COUNT(*) FILTER (WHERE correct) AS acertos FROM base_query GROUP BY difficulty_name) t)
    )
  );
END;
$$;