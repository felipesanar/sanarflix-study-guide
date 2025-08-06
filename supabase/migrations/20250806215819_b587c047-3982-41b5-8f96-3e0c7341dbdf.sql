-- Fix search path for existing functions
CREATE OR REPLACE FUNCTION public.get_user_ies_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_ies_id UUID;
BEGIN
  SELECT id_ies INTO user_ies_id
  FROM public.profiles
  WHERE user_id = auth.uid();
  RETURN user_ies_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin pode tudo
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Só pode modificar o próprio perfil
  IF OLD.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Permissão negada: você só pode modificar seu próprio perfil.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_senha(nova_senha text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function is deprecated - users should use Supabase auth.updateUser instead
  RAISE EXCEPTION 'Esta função foi desabilitada por segurança. Use o sistema de autenticação do Supabase.';
END;
$$;