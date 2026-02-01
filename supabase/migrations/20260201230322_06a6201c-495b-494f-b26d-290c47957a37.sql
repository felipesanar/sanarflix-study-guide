-- Remover politica de SELECT existente
DROP POLICY IF EXISTS "Usuário pode ver seus dados" ON public.users;

-- Criar nova politica que permite:
-- 1. Usuario ver seus proprios dados
-- 2. Admin ver todos os usuarios
CREATE POLICY "Usuarios podem ver seus dados e admins podem ver todos"
ON public.users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id 
  OR public.has_role(auth.uid(), 'admin')
);