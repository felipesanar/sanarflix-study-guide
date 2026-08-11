-- supabase/migrations/20260811142000_get_gestor_portal_versao.sql
--
-- Decide, para o usuário autenticado, se ele vê o portal novo (Início/Visão
-- Geral/Detalhamento) ou o console antigo (5 telas) -- ver
-- docs/superpowers/specs/2026-08-11-rollout-faseado-portal-gestor-design.md.
--
-- Regra por papel:
--   admin        -> sempre portal novo (dogfooding; sem escapatoria nesta RPC).
--   gestor_grupo -> true SOMENTE SE gestao.portal_v2 = true para TODAS as IES
--                   acessiveis (get_accessible_ies) -- AND lógico, nao OR.
--                   Uma IES do grupo ainda nao aprovada mantem o grupo inteiro
--                   no console antigo.
--   gestor puro  -> true SOMENTE SE gestao.portal_v2 = true para a sua unica
--                   IES (users.id_ies).
--   sem papel de gestao -> false (nunca deveria ser chamado nesse caso; o
--                   ExperienceGuard ja barra antes).
--
-- Ausencia de linha em ies_features para 'gestao.portal_v2' conta como false
-- (console antigo) -- e o estado em que toda IES nasce apos a Task 1.
CREATE OR REPLACE FUNCTION public.get_gestor_portal_versao()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_ies_list uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(v_uid, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  IF public.has_role(v_uid, 'gestor_grupo'::public.app_role) THEN
    v_ies_list := COALESCE(public.get_accessible_ies(v_uid), ARRAY[]::uuid[]);
  ELSIF public.has_role(v_uid, 'gestor'::public.app_role) THEN
    SELECT COALESCE(array_agg(u.id_ies), ARRAY[]::uuid[]) INTO v_ies_list
    FROM public.users u
    WHERE u.id = v_uid AND u.id_ies IS NOT NULL;
  ELSE
    RETURN false;
  END IF;

  IF v_ies_list IS NULL OR array_length(v_ies_list, 1) IS NULL THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM unnest(v_ies_list) AS ies(id)
    WHERE COALESCE(
      (SELECT f.enabled FROM public.ies_features f
       WHERE f.ies_id = ies.id AND f.feature_key = 'gestao.portal_v2'),
      false
    ) = false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_portal_versao() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_portal_versao() TO authenticated;
