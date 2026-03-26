-- Atendimento can view all users
CREATE POLICY "Atendimento can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'atendimento'));

-- Atendimento can update all users
CREATE POLICY "Atendimento can update all users"
ON public.users
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'atendimento'))
WITH CHECK (public.has_role(auth.uid(), 'atendimento'));

-- Atendimento can view all user roles (needed to display roles in admin table)
CREATE POLICY "Atendimento can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'atendimento'));