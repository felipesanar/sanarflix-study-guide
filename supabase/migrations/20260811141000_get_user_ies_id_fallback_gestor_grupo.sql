-- supabase/migrations/20260811141000_get_user_ies_id_fallback_gestor_grupo.sql
--
-- get_user_ies_id() só lia users.id_ies, que é NULL para gestor_grupo (papel
-- formalizado em 07/08, depois que o console antigo -- único chamador desta
-- função -- foi apagado). Sem fallback, um gestor_grupo quebra o console
-- antigo com "IES do usuário não encontrada" (src/services/institutional.ts).
--
-- Fallback: primeira IES de get_accessible_ies(), mesmo padrão já usado pelas
-- RPCs get_gestor_* para resolver v_ies quando users.id_ies é nulo. Não é uma
-- experiência multi-IES de verdade dentro do console antigo (ele nunca teve
-- seletor para isso) -- é o suficiente para não quebrar.
CREATE OR REPLACE FUNCTION public.get_user_ies_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_ies_id UUID;
BEGIN
  SELECT id_ies INTO user_ies_id
  FROM public.users
  WHERE id = auth.uid();

  IF user_ies_id IS NULL THEN
    SELECT (public.get_accessible_ies(auth.uid()))[1] INTO user_ies_id;
  END IF;

  RETURN user_ies_id;
END;
$$;
