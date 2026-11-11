CREATE OR REPLACE FUNCTION public.get_user_rankings(p_simulado_id uuid DEFAULT NULL::uuid)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  user_ies_id uuid; user_semester integer; result json;
BEGIN
  IF NOT (public.user_has_feature('aluno.home') or public.user_has_feature('aluno.desempenho_simulados')) THEN RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501'; END IF;
  SELECT id_ies, semestre INTO user_ies_id, user_semester FROM users WHERE id = auth.uid();

  WITH ies_users AS (
    SELECT u.id, u.semestre FROM users u WHERE u.id_ies = user_ies_id
  ),
  rankings AS (
    SELECT ap.user_id, COUNT(*) FILTER (WHERE ap.correct = true) as acertos, COUNT(*) as total
    FROM answer_progress ap
    JOIN ies_users iu ON iu.id = ap.user_id
    JOIN questoes_simulado qs ON ap.question_id = qs.id
    WHERE qs.anulada = false
      AND ((p_simulado_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.simulados_admin sa WHERE sa.id = ap.simulado AND sa.prova_oficial)) OR (ap.simulado = p_simulado_id AND NOT EXISTS (SELECT 1 FROM public.simulados_admin sa2 WHERE sa2.id = p_simulado_id AND sa2.prova_oficial AND NOT sa2.prova_oficial_liberada_aluno)))
    GROUP BY ap.user_id
  ),
  ies_ranking AS (
    SELECT r.user_id, RANK() OVER (ORDER BY r.acertos DESC) as rank FROM rankings r
  ),
  semester_ranking AS (
    SELECT r.user_id, RANK() OVER (ORDER BY r.acertos DESC) as rank
    FROM rankings r JOIN ies_users iu ON iu.id = r.user_id WHERE iu.semestre = user_semester
  )
  SELECT json_build_object(
    'rankingIES', (SELECT json_build_object('rank', rank, 'total', (SELECT COUNT(*) FROM ies_ranking)) FROM ies_ranking WHERE user_id = auth.uid()),
    'rankingSemester', (SELECT json_build_object('rank', rank, 'total', (SELECT COUNT(*) FROM semester_ranking)) FROM semester_ranking WHERE user_id = auth.uid())
  ) INTO result;
  RETURN result;
END;
$function$;