-- Adicionar novos campos obrigatórios na tabela questoes_simulado
ALTER TABLE public.questoes_simulado
ADD COLUMN IF NOT EXISTS numero_questao integer,
ADD COLUMN IF NOT EXISTS grande_area text,
ADD COLUMN IF NOT EXISTS especialidade text,
ADD COLUMN IF NOT EXISTS tema text,
ADD COLUMN IF NOT EXISTS grau_dificuldade text,
ADD COLUMN IF NOT EXISTS competencia text;

-- Adicionar relacionamento many-to-many entre simulados e IES
CREATE TABLE IF NOT EXISTS public.simulados_ies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL REFERENCES public.simulados_admin(id) ON DELETE CASCADE,
  ies_id uuid NOT NULL REFERENCES public.ies(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(simulado_id, ies_id)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_simulados_ies_simulado ON public.simulados_ies(simulado_id);
CREATE INDEX IF NOT EXISTS idx_simulados_ies_ies ON public.simulados_ies(ies_id);

-- RLS policies para simulados_ies
ALTER TABLE public.simulados_ies ENABLE ROW LEVEL SECURITY;

-- Admins podem gerenciar associações de IES
CREATE POLICY "Admins podem gerenciar simulados_ies"
ON public.simulados_ies
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Usuários podem ver simulados da sua IES
CREATE POLICY "Usuários podem ver simulados da sua IES"
ON public.simulados_ies
FOR SELECT
TO authenticated
USING (ies_id = get_current_user_ies_id());

-- Atualizar policy de simulados_admin para considerar IES
DROP POLICY IF EXISTS "Usuários podem ver simulados ativos" ON public.simulados_admin;

CREATE POLICY "Usuários podem ver simulados ativos da sua IES"
ON public.simulados_admin
FOR SELECT
TO authenticated
USING (
  status = 'ativo' 
  AND (data_liberacao IS NULL OR data_liberacao <= now())
  AND EXISTS (
    SELECT 1 FROM public.simulados_ies 
    WHERE simulados_ies.simulado_id = simulados_admin.id 
    AND simulados_ies.ies_id = get_current_user_ies_id()
  )
);