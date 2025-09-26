-- Habilitar RLS na tabela intensivouscs
ALTER TABLE public.intensivouscs ENABLE ROW LEVEL SECURITY;

-- Permitir leitura para usuários autenticados (já que é conteúdo educacional público)
CREATE POLICY "Allow authenticated users to read intensivo USCS content" 
ON public.intensivouscs 
FOR SELECT 
TO authenticated 
USING (true);

-- Política adicional para service_role (para administração)
CREATE POLICY "Allow service role full access to intensivo USCS content" 
ON public.intensivouscs 
FOR ALL 
TO service_role 
USING (true);