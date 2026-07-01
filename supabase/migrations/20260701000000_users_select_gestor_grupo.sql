-- =============================================================================
-- Fix: gestor_grupo não vê nome/email dos alunos na aba "Liberações de Simulados".
-- =============================================================================
-- Causa raiz:
--   public.users tem SELECT policies para admin, atendimento, professor(IES) e
--   self — mas NENHUMA para gestor_grupo. Um gestor_grupo consegue ler
--   simulados_finalizados (policy "Gestor de grupo pode ver finalizados do
--   grupo", restrita à IES acessível), mas o join client-side com public.users
--   (LiberacoesTab.tsx) voltava zero linhas, renderizando "Nome não disponível"
--   em todas as linhas (nome e email em branco).
--
-- Correção:
--   Adiciona SELECT em public.users para gestor_grupo, restrito às MESMAS IES
--   que ele já pode acessar (get_accessible_ies) — idêntico ao escopo usado na
--   policy de simulados_finalizados. Gestão passa a ver apenas os alunos das
--   suas IES, não a tabela inteira. Policy PERMISSIVE: só adiciona acesso de
--   leitura, não altera nem remove nenhuma policy existente.
-- =============================================================================

DROP POLICY IF EXISTS "Gestor de grupo pode ver usuarios do grupo" ON public.users;

CREATE POLICY "Gestor de grupo pode ver usuarios do grupo"
  ON public.users
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'gestor_grupo'::app_role)
    AND id_ies = ANY (get_accessible_ies(auth.uid()))
  );
