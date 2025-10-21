-- Fix missing search_path for SECURITY DEFINER functions
-- This prevents potential security vulnerabilities from search_path manipulation

ALTER FUNCTION public.get_user_performance_aggregates(integer)
SET search_path = public;

ALTER FUNCTION public.get_simulado_performance()
SET search_path = public;

ALTER FUNCTION public.log_sensitive_user_changes()
SET search_path = public;

ALTER FUNCTION public.validate_user_update()
SET search_path = public;

ALTER FUNCTION public.get_user_rankings(integer)
SET search_path = public;

ALTER FUNCTION public.get_user_ranking_in_ies()
SET search_path = public;

ALTER FUNCTION public.handle_new_user()
SET search_path = public;

ALTER FUNCTION public.update_updated_at_column()
SET search_path = public;

ALTER FUNCTION public.update_updated_at_users()
SET search_path = public;