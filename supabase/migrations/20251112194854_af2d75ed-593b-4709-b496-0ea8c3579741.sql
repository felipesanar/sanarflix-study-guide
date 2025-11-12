-- Criar tabela para rastrear simulados finalizados
CREATE TABLE IF NOT EXISTS public.simulados_finalizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  simulado_id UUID NOT NULL REFERENCES public.simulados_admin(id) ON DELETE CASCADE,
  finalizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tempo_total_segundos INTEGER NOT NULL,
  saidas_de_aba INTEGER NOT NULL DEFAULT 0,
  liberado_novamente BOOLEAN NOT NULL DEFAULT false,
  liberado_em TIMESTAMP WITH TIME ZONE,
  liberado_por UUID,
  UNIQUE(user_id, simulado_id)
);

-- Habilitar RLS
ALTER TABLE public.simulados_finalizados ENABLE ROW LEVEL SECURITY;

-- Policy para alunos verem seus próprios simulados finalizados
CREATE POLICY "Usuários podem ver seus próprios simulados finalizados"
ON public.simulados_finalizados
FOR SELECT
USING (auth.uid() = user_id);

-- Policy para admins gerenciarem todos os simulados finalizados
CREATE POLICY "Admins podem gerenciar simulados finalizados"
ON public.simulados_finalizados
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Criar índices para performance
CREATE INDEX idx_simulados_finalizados_user ON public.simulados_finalizados(user_id);
CREATE INDEX idx_simulados_finalizados_simulado ON public.simulados_finalizados(simulado_id);
CREATE INDEX idx_simulados_finalizados_liberado ON public.simulados_finalizados(liberado_novamente);