-- SECURITY FIX: Prevent privilege escalation on users table
-- Users should not be able to change id_ies or semestre to access other institution content

-- Create a security definer function to validate user updates
CREATE OR REPLACE FUNCTION public.validate_user_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service_role to update anything
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  -- For regular users, prevent changes to critical fields
  -- Users can only update their own nome and cpf
  IF OLD.id_ies IS DISTINCT FROM NEW.id_ies THEN
    RAISE EXCEPTION 'Users cannot change their institution (id_ies)';
  END IF;
  
  IF OLD.semestre IS DISTINCT FROM NEW.semestre THEN
    RAISE EXCEPTION 'Users cannot change their semester';
  END IF;
  
  -- Prevent changing id or email
  IF OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Users cannot change their ID';
  END IF;
  
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    RAISE EXCEPTION 'Users cannot change their email';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to validate updates
DROP TRIGGER IF EXISTS validate_user_update_trigger ON public.users;
CREATE TRIGGER validate_user_update_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_update();

-- Clean up deprecated functions that reference non-existent profiles table
DROP FUNCTION IF EXISTS public.get_current_user_ies_id();
DROP FUNCTION IF EXISTS public.get_current_user_semester();
DROP FUNCTION IF EXISTS public.get_current_user_faculty();

-- Recreate the user utility functions properly for the users table
CREATE OR REPLACE FUNCTION public.get_current_user_ies_id()
RETURNS UUID AS $$
  SELECT id_ies FROM public.users WHERE id = auth.uid()::TEXT;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_current_user_semester()
RETURNS INTEGER AS $$
  SELECT semestre FROM public.users WHERE id = auth.uid()::TEXT;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_current_user_faculty()
RETURNS TEXT AS $$
  SELECT i.nome 
  FROM public.users u
  JOIN public.ies i ON u.id_ies = i.id
  WHERE u.id = auth.uid()::TEXT;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;