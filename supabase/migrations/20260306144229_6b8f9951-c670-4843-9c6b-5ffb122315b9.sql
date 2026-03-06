
-- Fix infinite recursion: replace subquery on users table with security definer function
DROP POLICY IF EXISTS "Professors can view users from their IES" ON public.users;

CREATE POLICY "Professors can view users from their IES"
ON public.users
FOR SELECT
USING (
  has_role(auth.uid(), 'professor'::app_role)
  AND id_ies = public.get_current_user_ies_id()
);
