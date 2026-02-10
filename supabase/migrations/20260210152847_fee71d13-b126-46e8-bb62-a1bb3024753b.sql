-- Allow admins to see all conteudos
CREATE POLICY "Admins podem ver todos os conteúdos"
ON public.conteudos
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
