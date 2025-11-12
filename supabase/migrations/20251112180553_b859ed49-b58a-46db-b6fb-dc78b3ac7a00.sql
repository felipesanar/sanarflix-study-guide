-- Adicionar coluna ies_id em simulados_admin
ALTER TABLE public.simulados_admin 
ADD COLUMN IF NOT EXISTS ies_id UUID REFERENCES public.ies(id);

-- Atualizar RLS policy para filtrar por IES do usuário
DROP POLICY IF EXISTS "Usuários podem ver simulados ativos da sua IES" ON public.simulados_admin;

CREATE POLICY "Usuários podem ver simulados ativos da sua IES" 
ON public.simulados_admin 
FOR SELECT 
USING (
  status = 'ativo'::text 
  AND (data_liberacao IS NULL OR data_liberacao <= now()) 
  AND ies_id = get_current_user_ies_id()
);

-- Atualizar RLS policy de questoes_simulado para garantir acesso via simulado_id
DROP POLICY IF EXISTS "Usuários podem ver questões de simulados ativos" ON public.questoes_simulado;

CREATE POLICY "Usuários podem ver questões de simulados ativos" 
ON public.questoes_simulado 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM simulados_admin
    WHERE simulados_admin.id = questoes_simulado.simulado_id
      AND simulados_admin.status = 'ativo'::text
      AND (simulados_admin.data_liberacao IS NULL OR simulados_admin.data_liberacao <= now())
      AND simulados_admin.ies_id = get_current_user_ies_id()
  )
);

-- Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_simulados_admin_ies_id ON public.simulados_admin(ies_id);

-- Comentário: A tabela simulados_ies não será removida para preservar dados históricos,
-- mas não será mais utilizada no novo fluxo