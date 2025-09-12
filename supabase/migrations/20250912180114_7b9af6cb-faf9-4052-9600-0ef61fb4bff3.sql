-- Priority 1: Fix Critical Privilege Escalation Vulnerability
-- Update the validate_user_update function to apply to ALL users, not just service_role

CREATE OR REPLACE FUNCTION public.validate_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service_role to update anything
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  -- For authenticated users, prevent changes to critical fields
  -- Users can only update their own nome and cpf
  IF OLD.id_ies IS DISTINCT FROM NEW.id_ies THEN
    RAISE EXCEPTION 'Users cannot change their institution (id_ies). Contact support if you need to transfer institutions.';
  END IF;
  
  IF OLD.semestre IS DISTINCT FROM NEW.semestre THEN
    RAISE EXCEPTION 'Users cannot change their semester. Contact support if this is incorrect.';
  END IF;
  
  -- Prevent changing id or email
  IF OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Users cannot change their ID';
  END IF;
  
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    RAISE EXCEPTION 'Users cannot change their email. Use account settings to update email.';
  END IF;
  
  -- Only allow updates to nome and cpf for regular users
  IF OLD.nome IS DISTINCT FROM NEW.nome OR OLD.cpf IS DISTINCT FROM NEW.cpf THEN
    -- These changes are allowed for the user's own record
    IF auth.uid()::TEXT != OLD.id THEN
      RAISE EXCEPTION 'Users can only update their own profile';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'validate_user_update_trigger' 
    AND tgrelid = 'public.users'::regclass
  ) THEN
    CREATE TRIGGER validate_user_update_trigger
      BEFORE UPDATE ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_user_update();
  END IF;
END $$;

-- Add logging for security audit trail
CREATE OR REPLACE FUNCTION public.log_sensitive_user_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log any attempts to change critical fields
  IF OLD.id_ies IS DISTINCT FROM NEW.id_ies OR OLD.semestre IS DISTINCT FROM NEW.semestre THEN
    -- In a production environment, you would log this to a security audit table
    -- For now, we'll just raise a notice
    RAISE NOTICE 'Security Alert: User % attempted to change critical fields. Old id_ies: %, New id_ies: %, Old semestre: %, New semestre: %', 
      auth.uid(), OLD.id_ies, NEW.id_ies, OLD.semestre, NEW.semestre;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Add audit logging trigger
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'log_user_changes_trigger' 
    AND tgrelid = 'public.users'::regclass
  ) THEN
    CREATE TRIGGER log_user_changes_trigger
      BEFORE UPDATE ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.log_sensitive_user_changes();
  END IF;
END $$;