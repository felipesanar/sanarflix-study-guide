
CREATE OR REPLACE FUNCTION public.get_cohort_consumo_ranking()
 RETURNS TABLE(supabase_user_id uuid, user_id_metabase text, videos_assistidos bigint, questoes_respondidas bigint, rank_videos integer, rank_questoes integer, total integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cohort AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = public.get_current_user_ies_id()
      AND u.semestre = public.get_current_user_semester()
  ),
  real_consumo AS (
    SELECT 
      c.id AS supabase_user_id,
      '' AS user_id_metabase,
      COALESCE((SELECT COUNT(DISTINCT av.conteudo_id) FROM public.aula_views av WHERE av.user_id = c.id), 0) AS videos_assistidos,
      COALESCE((SELECT COUNT(DISTINCT ap.question_id) FROM public.answer_progress ap WHERE ap.user_id = c.id), 0) AS questoes_respondidas
    FROM cohort c
  ),
  totals AS (
    SELECT COUNT(*)::integer AS total FROM real_consumo
  )
  SELECT
    rc.supabase_user_id,
    rc.user_id_metabase,
    rc.videos_assistidos,
    rc.questoes_respondidas,
    CASE
      WHEN (SELECT COUNT(*) FROM real_consumo WHERE videos_assistidos > 0) = 0
      THEN (SELECT total FROM totals)
      ELSE (RANK() OVER (ORDER BY rc.videos_assistidos DESC))::integer
    END AS rank_videos,
    CASE
      WHEN (SELECT COUNT(*) FROM real_consumo WHERE questoes_respondidas > 0) = 0
      THEN (SELECT total FROM totals)
      ELSE (RANK() OVER (ORDER BY rc.questoes_respondidas DESC))::integer
    END AS rank_questoes,
    (SELECT total FROM totals) AS total
  FROM real_consumo rc;
$function$;
