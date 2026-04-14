
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
  consumo AS (
    SELECT
      c.id AS supabase_user_id,
      COALESCE(stm.user_id_metabase, '') AS user_id_metabase,
      COALESCE(cm.videos_assistidos, 0)::bigint AS videos_assistidos,
      COALESCE(cm.questoes_respondidas, 0)::bigint AS questoes_respondidas
    FROM cohort c
    LEFT JOIN public.supabase_to_metabase stm ON stm.id = c.id
    LEFT JOIN public.consumo_metabase cm ON cm.id = stm.user_id_metabase
  ),
  totals AS (
    SELECT COUNT(*)::integer AS total FROM consumo
  )
  SELECT
    co.supabase_user_id,
    co.user_id_metabase,
    co.videos_assistidos,
    co.questoes_respondidas,
    CASE
      WHEN (SELECT COUNT(*) FROM consumo WHERE videos_assistidos > 0) = 0
      THEN (SELECT total FROM totals)
      ELSE (RANK() OVER (ORDER BY co.videos_assistidos DESC))::integer
    END AS rank_videos,
    CASE
      WHEN (SELECT COUNT(*) FROM consumo WHERE questoes_respondidas > 0) = 0
      THEN (SELECT total FROM totals)
      ELSE (RANK() OVER (ORDER BY co.questoes_respondidas DESC))::integer
    END AS rank_questoes,
    (SELECT total FROM totals) AS total
  FROM consumo co;
$function$;
