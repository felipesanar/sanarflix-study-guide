-- Add SELECT policy for admins on answer_progress
CREATE POLICY "Admins can view all answer progress"
ON public.answer_progress
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- simulados_finalizados already has an ALL policy for admins, which covers SELECT
-- But let's verify by checking if we need an explicit SELECT policy
-- The existing "Admins podem gerenciar simulados finalizados" is an ALL policy, so SELECT is covered

-- questoes_simulado already has an ALL policy for admins
-- But the user policy restricts to active simulados only
-- Admins need to see ALL questions for analytics, so the ALL policy should cover it

-- simulados_admin already has an ALL policy for admins
-- But regular users can only see active simulados from their IES
-- Analytics needs to see all simulados - the admin ALL policy covers this