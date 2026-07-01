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