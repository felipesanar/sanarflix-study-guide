-- Garantir que a tabela conteudos está acessível e as RLS policies estão corretas

-- Verificar se RLS está habilitado (se não estiver, habilitar)
ALTER TABLE public.conteudos ENABLE ROW LEVEL SECURITY;

-- Recriar a policy de leitura para usuários (caso haja algum problema)
DROP POLICY IF EXISTS "Usuários podem ver os conteúdos da sua IES" ON public.conteudos;

CREATE POLICY "Usuários podem ver os conteúdos da sua IES"
ON public.conteudos
FOR SELECT
TO authenticated
USING (
  id_ies = (
    SELECT id_ies 
    FROM public.users 
    WHERE id = auth.uid()
  )
);

-- Adicionar policy para usuários autenticados via service_role (para edge functions)
DROP POLICY IF EXISTS "Service role pode ver todos os conteúdos" ON public.conteudos;

CREATE POLICY "Service role pode ver todos os conteúdos"
ON public.conteudos
FOR SELECT
TO service_role
USING (true);

-- Verificar se a função get_user_ies_id existe e está correta
CREATE OR REPLACE FUNCTION public.get_user_ies_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_ies_id UUID;
BEGIN
  SELECT id_ies INTO user_ies_id
  FROM public.users
  WHERE id = auth.uid();
  RETURN user_ies_id;
END;
$$;