-- =========================================================================
-- Atendimento (CX) access to public.user_feedback
-- Produto (01/07/2026): CX tem LEITURA + ESCRITA/MODERAÇÃO do feedback na v0.
-- Hoje só admin lê/atualiza user_feedback -> CX veria a aba vazia e falharia
-- ao moderar. Adiciona SELECT + UPDATE escopados à role `atendimento`.
-- Mesmo padrão já usado em public.users / public.user_roles.
-- Hardening: escopado apenas por has_role(..., 'atendimento') — nada além.
-- =========================================================================

-- SELECT: atendimento vê todos os feedbacks
DROP POLICY IF EXISTS "Atendimento view all feedback" ON public.user_feedback;
CREATE POLICY "Atendimento view all feedback" ON public.user_feedback
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'atendimento'::app_role));

-- UPDATE: atendimento modera (status, admin_response, etc.)
DROP POLICY IF EXISTS "Atendimento update feedback" ON public.user_feedback;
CREATE POLICY "Atendimento update feedback" ON public.user_feedback
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'atendimento'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'atendimento'::app_role));
