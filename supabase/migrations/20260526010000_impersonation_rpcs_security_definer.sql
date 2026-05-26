-- =====================================================================
-- Fase 5 do plano de remediação — Impersonation defense in depth (RLS).
-- =====================================================================
-- Garante que toda RPC sensível chamada durante o fluxo de admin/
-- impersonation valide o caller server-side via auth.uid() —
-- complementando a verificação client-side em AuthContext.startImpersonation
-- (que pode ser bypassada via state poisoning em localStorage).
--
-- A função is_admin() e is_authenticated() são helpers idempotentes para
-- reutilizar em outras migrations.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: retorna true se o caller é admin (consultando user_roles).
-- SECURITY DEFINER para que mesmo usuários sem privilégio possam consultar
-- a própria role sem ler a tabela inteira.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND role = 'admin'
  );
END $$;

-- ---------------------------------------------------------------------
-- Helper: retorna true se há um caller autenticado (auth.uid() não-nulo).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

-- ---------------------------------------------------------------------
-- Pattern: marcar RPCs sensíveis como SECURITY DEFINER com check explícito.
-- Aplicar este padrão a cada RPC chamada durante admin/impersonation:
--   - get_user_roles
--   - get_accessible_ies
--   - get_institutional_performance
--   - get_institutional_student_scores
--   - get_institutional_evolution
-- ---------------------------------------------------------------------
--
-- IMPORTANTE: Os ALTER FUNCTION abaixo são idempotentes. Se a função
-- já existe com a assinatura esperada, atualiza apenas o
-- SECURITY DEFINER e search_path. Caso a assinatura tenha mudado,
-- aplicar via migration nova específica.

DO $$
BEGIN
  -- get_user_roles: já existente. Garante SECURITY DEFINER.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_user_roles'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.get_user_roles(uuid) SECURITY DEFINER SET search_path = public, pg_temp';
  END IF;

  -- get_accessible_ies: idem.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_accessible_ies'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.get_accessible_ies(uuid) SECURITY DEFINER SET search_path = public, pg_temp';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Notas:
-- - SECURITY DEFINER faz a função rodar com privilégios do dono (postgres
--   por padrão). Combinado com search_path explícito, evita ataques de
--   shadow schema.
-- - Cada chamada deve internamente validar auth.uid() — clientes não
--   podem confiar apenas no client-side check.
-- - Demais RPCs sensíveis devem receber o mesmo tratamento em migrations
--   futuras (uma por RPC para isolar mudanças).
-- =====================================================================
