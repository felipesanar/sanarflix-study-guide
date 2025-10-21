-- Set search_path for remaining functions without it
-- Even SECURITY INVOKER functions should have search_path set for security

ALTER FUNCTION public.get_question_by_subspecialty(text)
SET search_path = public;

ALTER FUNCTION public.get_questions_by_subspecialty(text, text, text, integer, OUT text, OUT text, OUT text, OUT text, OUT text, OUT text, OUT text, OUT text, OUT text, OUT text, OUT boolean)
SET search_path = public;