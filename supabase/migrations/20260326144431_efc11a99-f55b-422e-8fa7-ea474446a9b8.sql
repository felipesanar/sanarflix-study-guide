CREATE OR REPLACE FUNCTION public.validate_user_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service role to bypass all checks
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;

  -- Prevent changing primary id and email
  IF OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Users cannot change their ID';
  END IF;
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    RAISE EXCEPTION 'Users cannot change their email';
  END IF;

  -- Prevent changing institution (for everyone except admins and atendimento)
  IF OLD.id_ies IS DISTINCT FROM NEW.id_ies THEN
    IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'atendimento')) THEN
      RAISE EXCEPTION 'Users cannot change their institution (id_ies)';
    END IF;
  END IF;

  -- Semester change: set semestre_updated_at BEFORE any admin bypass
  IF OLD.semestre IS DISTINCT FROM NEW.semestre THEN
    IF (SELECT auth.uid()) = OLD.id THEN
      -- Owner: enforce 60-day cooldown
      IF OLD.semestre_updated_at IS NOT NULL 
         AND OLD.semestre_updated_at > now() - interval '60 days' THEN
        RAISE EXCEPTION 'Alteração de semestre bloqueada. Você poderá alterar novamente após %.',
          to_char(OLD.semestre_updated_at + interval '60 days', 'DD/MM/YYYY');
      END IF;
      NEW.semestre_updated_at := now();
    ELSE
      -- Non-owner changing semester: must be admin or atendimento
      IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'atendimento')) THEN
        RAISE EXCEPTION 'Users cannot change another user semester';
      END IF;
      NEW.semestre_updated_at := now();
    END IF;
  END IF;

  -- Allow admins and atendimento to bypass remaining checks
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'atendimento') THEN RETURN NEW; END IF;

  -- Allow users to update their own name only
  IF OLD.nome IS DISTINCT FROM NEW.nome AND (SELECT auth.uid()) != OLD.id THEN
    RAISE EXCEPTION 'Users can only update their own profile';
  END IF;

  RETURN NEW;
END;
$function$;