-- Drop legacy no-arg overloads that cause PGRST203 ambiguity
-- Keep only the versions with p_ies_id DEFAULT NULL parameter

DROP FUNCTION IF EXISTS public.get_institutional_simulados();
DROP FUNCTION IF EXISTS public.get_institutional_evolution();
DROP FUNCTION IF EXISTS public.get_institutional_performance(uuid);
DROP FUNCTION IF EXISTS public.get_institutional_student_scores(uuid);
DROP FUNCTION IF EXISTS public.get_institutional_question_details(uuid, text, text, text);