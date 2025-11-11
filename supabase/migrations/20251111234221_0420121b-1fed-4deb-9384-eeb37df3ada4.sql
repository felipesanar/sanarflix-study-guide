-- Criar tabela de simulados administrativos
CREATE TABLE IF NOT EXISTS public.simulados_admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  data_liberacao TIMESTAMP WITH TIME ZONE,
  data_encerramento TIMESTAMP WITH TIME ZONE,
  duracao_minutos INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('ativo', 'rascunho', 'encerrado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Criar tabela de questões dos simulados
CREATE TABLE IF NOT EXISTS public.questoes_simulado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id UUID NOT NULL REFERENCES public.simulados_admin(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  enunciado TEXT NOT NULL,
  alternativa_a TEXT NOT NULL,
  alternativa_b TEXT NOT NULL,
  alternativa_c TEXT NOT NULL,
  alternativa_d TEXT NOT NULL,
  alternativa_e TEXT,
  correta TEXT NOT NULL CHECK (correta IN ('A', 'B', 'C', 'D', 'E')),
  comentario TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_questoes_simulado_id ON public.questoes_simulado(simulado_id);
CREATE INDEX IF NOT EXISTS idx_simulados_status ON public.simulados_admin(status);
CREATE INDEX IF NOT EXISTS idx_simulados_data_liberacao ON public.simulados_admin(data_liberacao);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_simulados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_simulados_updated_at
  BEFORE UPDATE ON public.simulados_admin
  FOR EACH ROW
  EXECUTE FUNCTION update_simulados_updated_at();

CREATE TRIGGER trigger_update_questoes_updated_at
  BEFORE UPDATE ON public.questoes_simulado
  FOR EACH ROW
  EXECUTE FUNCTION update_simulados_updated_at();

-- RLS Policies
ALTER TABLE public.simulados_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questoes_simulado ENABLE ROW LEVEL SECURITY;

-- Admins podem gerenciar tudo
CREATE POLICY "Admins podem gerenciar simulados"
  ON public.simulados_admin
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem gerenciar questões"
  ON public.questoes_simulado
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Usuários podem ver simulados ativos
CREATE POLICY "Usuários podem ver simulados ativos"
  ON public.simulados_admin
  FOR SELECT
  USING (status = 'ativo' AND (data_liberacao IS NULL OR data_liberacao <= now()));

CREATE POLICY "Usuários podem ver questões de simulados ativos"
  ON public.questoes_simulado
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.simulados_admin
      WHERE id = simulado_id
      AND status = 'ativo'
      AND (data_liberacao IS NULL OR data_liberacao <= now())
    )
  );