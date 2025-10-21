-- Fix 1: Drop users_basic view since it's redundant and exposes data
-- This is a VIEW not a table, so we drop it instead of adding RLS
DROP VIEW IF EXISTS public.users_basic CASCADE;

-- Fix 2: Correct the questions_enamed policy to actually require authentication
DROP POLICY IF EXISTS "Authenticated users can read questions" ON public.questions_enamed;

CREATE POLICY "Authenticated users only can read questions"
ON public.questions_enamed
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

-- Fix 3: Remove CPF column to eliminate LGPD compliance risk
ALTER TABLE public.users DROP COLUMN IF EXISTS cpf;

-- Fix 4: Implement proper Role-Based Access Control System
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user', 'b2b_partner');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create secure role check function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Create function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF public.app_role
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id;
$$;

-- RLS policies for user_roles
CREATE POLICY "Admins can manage all user roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Migrate existing B2B users to admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id::uuid, 'admin'::public.app_role
FROM public.users
WHERE id_ies = '9f21b138-0027-44c8-9660-dc6706d57bc0'
ON CONFLICT DO NOTHING;

-- Update validate_user_update to use role checks
CREATE OR REPLACE FUNCTION public.validate_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  
  IF OLD.id_ies IS DISTINCT FROM NEW.id_ies THEN
    RAISE EXCEPTION 'Users cannot change their institution (id_ies)';
  END IF;
  IF OLD.semestre IS DISTINCT FROM NEW.semestre THEN
    RAISE EXCEPTION 'Users cannot change their semester';
  END IF;
  IF OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Users cannot change their ID';
  END IF;
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    RAISE EXCEPTION 'Users cannot change their email';
  END IF;
  IF OLD.nome IS DISTINCT FROM NEW.nome AND auth.uid()::TEXT != OLD.id THEN
    RAISE EXCEPTION 'Users can only update their own profile';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix search_path on SECURITY DEFINER functions
ALTER FUNCTION public.get_user_performance_aggregates() SET search_path = public;
ALTER FUNCTION public.get_user_performance_aggregates(integer) SET search_path = public;
ALTER FUNCTION public.get_simulado_performance() SET search_path = public;
ALTER FUNCTION public.log_sensitive_user_changes() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.update_updated_at_users() SET search_path = public;