-- Fix search_path security warnings for all functions
-- Add SET search_path = 'public' to all functions for security

-- Update validate_user_update function
CREATE OR REPLACE FUNCTION public.validate_user_update()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;

-- Update utility functions with proper search_path
CREATE OR REPLACE FUNCTION public.get_current_user_ies_id()
RETURNS UUID 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = 'public'
AS $$
  SELECT id_ies FROM public.users WHERE id = auth.uid()::TEXT;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_semester()
RETURNS INTEGER 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = 'public'
AS $$
  SELECT semestre FROM public.users WHERE id = auth.uid()::TEXT;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_faculty()
RETURNS TEXT 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = 'public'
AS $$
  SELECT i.nome 
  FROM public.users u
  JOIN public.ies i ON u.id_ies = i.id
  WHERE u.id = auth.uid()::TEXT;
$$;