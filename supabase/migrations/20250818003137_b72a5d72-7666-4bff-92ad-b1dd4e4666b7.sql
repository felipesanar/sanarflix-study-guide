-- Enable RLS on users_public table and add security policies
ALTER TABLE public.users_public ENABLE ROW LEVEL SECURITY;

-- Revoke all privileges from anon and authenticated users on users_public
REVOKE ALL ON public.users_public FROM anon, authenticated;

-- Only service_role can access users_public
CREATE POLICY "Only service_role can access users_public"
ON public.users_public
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add user_id column to answer_progress_simulado_enamed
ALTER TABLE public.answer_progress_simulado_enamed 
ADD COLUMN user_id UUID;

-- Backfill user_id by joining with users table on email
UPDATE public.answer_progress_simulado_enamed 
SET user_id = u.id::uuid 
FROM public.users u 
WHERE answer_progress_simulado_enamed.email = u.email;

-- Make user_id NOT NULL after backfill
ALTER TABLE public.answer_progress_simulado_enamed 
ALTER COLUMN user_id SET NOT NULL;

-- Add RLS policies for answer_progress_simulado_enamed
CREATE POLICY "Users can view their own simulado progress"
ON public.answer_progress_simulado_enamed
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own simulado progress"
ON public.answer_progress_simulado_enamed
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own simulado progress"
ON public.answer_progress_simulado_enamed
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own simulado progress"
ON public.answer_progress_simulado_enamed
FOR DELETE
USING (auth.uid() = user_id);

-- Add search_path to security definer functions
CREATE OR REPLACE FUNCTION public.get_user_ies_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.update_updated_at_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Convert get_conteudos_for_user to SECURITY INVOKER for better security
CREATE OR REPLACE FUNCTION public.get_conteudos_for_user(user_id_ies uuid, user_semestre integer)
RETURNS TABLE(conteudos jsonb)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.conteudos
  FROM public.conteudos c
  WHERE c.id_ies = user_id_ies
    AND c.semestre = user_semestre;
END;
$function$;

-- Remove legacy password artifacts if not in use
DROP FUNCTION IF EXISTS public.verificar_senha(text, text);
ALTER TABLE public.users DROP COLUMN IF EXISTS senha_hash;