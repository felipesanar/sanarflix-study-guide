BEGIN;
REVOKE EXECUTE ON FUNCTION public.get_question_by_subspecialty(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_calendar_subjects_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_simulados_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.mv_evolucao_institucional_tri FROM anon, authenticated;
COMMIT;