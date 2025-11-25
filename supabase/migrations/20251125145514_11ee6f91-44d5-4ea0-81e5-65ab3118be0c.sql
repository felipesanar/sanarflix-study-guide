-- Remover policies que dependem da coluna ies_id
DROP POLICY IF EXISTS "Usuários podem ver simulados ativos da sua IES" ON public.simulados_admin;
DROP POLICY IF EXISTS "Usuários podem ver questões de simulados ativos" ON public.questoes_simulado;
DROP POLICY IF EXISTS "Admins podem gerenciar simulados" ON public.simulados_admin;

-- Remover coluna ies_id
ALTER TABLE public.simulados_admin DROP COLUMN IF EXISTS ies_id;

-- Adicionar coluna ies_ids como array de UUIDs
ALTER TABLE public.simulados_admin 
  ADD COLUMN ies_ids uuid[] NOT NULL DEFAULT '{}';

-- Criar índice GIN para busca eficiente em array
CREATE INDEX idx_simulados_admin_ies_ids ON public.simulados_admin USING GIN(ies_ids);

-- Recriar policy para usuários verem simulados da sua IES
CREATE POLICY "Usuários podem ver simulados ativos da sua IES"
ON public.simulados_admin
FOR SELECT
USING (
  status = 'ativo' 
  AND (data_liberacao IS NULL OR data_liberacao <= now())
  AND get_current_user_ies_id() = ANY(ies_ids)
);

-- Recriar policy para admins
CREATE POLICY "Admins podem gerenciar simulados"
ON public.simulados_admin
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Recriar policy para questões
CREATE POLICY "Usuários podem ver questões de simulados ativos"
ON public.questoes_simulado
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM simulados_admin
    WHERE simulados_admin.id = questoes_simulado.simulado_id
    AND simulados_admin.status = 'ativo'
    AND (simulados_admin.data_liberacao IS NULL OR simulados_admin.data_liberacao <= now())
    AND get_current_user_ies_id() = ANY(simulados_admin.ies_ids)
  )
);