-- Fix critical security issue: Add RLS to users_basic table
ALTER TABLE public.users_basic ENABLE ROW LEVEL SECURITY;

-- Create policy to ensure users can only view their own basic profile data
CREATE POLICY "Users can only view their own basic profile data" 
ON public.users_basic 
FOR SELECT 
USING (auth.uid() = id);

-- Update database functions to include explicit search_path for security
CREATE OR REPLACE FUNCTION public.get_user_ies_id()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_ies_id UUID;
BEGIN
  SELECT id_ies INTO user_ies_id
  FROM public.users
  WHERE id = auth.uid()::TEXT;
  RETURN user_ies_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_faculty()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT i.nome 
  FROM public.users u
  JOIN public.ies i ON u.id_ies = i.id
  WHERE u.id = auth.uid()::TEXT;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_ies_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id_ies FROM public.users WHERE id = auth.uid()::TEXT;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_semester()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT semestre FROM public.users WHERE id = auth.uid()::TEXT;
$function$;

CREATE OR REPLACE FUNCTION public.get_conteudos_for_user(user_id_ies uuid, user_semestre integer)
 RETURNS TABLE(conteudos jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.conteudos
  FROM public.conteudos c
  WHERE c.id_ies = user_id_ies
    AND c.semestre = user_semestre;
END;
$function$;