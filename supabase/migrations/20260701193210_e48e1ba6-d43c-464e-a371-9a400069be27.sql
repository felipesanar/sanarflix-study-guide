DROP POLICY IF EXISTS "Atendimento view all feedback" ON public.user_feedback;
CREATE POLICY "Atendimento view all feedback" ON public.user_feedback
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'atendimento'::app_role));

DROP POLICY IF EXISTS "Atendimento update feedback" ON public.user_feedback;
CREATE POLICY "Atendimento update feedback" ON public.user_feedback
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'atendimento'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'atendimento'::app_role));