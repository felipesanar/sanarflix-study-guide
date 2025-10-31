-- Fix get_current_user_ies_id function to avoid UUID = TEXT comparison error
CREATE OR REPLACE FUNCTION public.get_current_user_ies_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id_ies FROM public.users WHERE id = auth.uid();
$function$;