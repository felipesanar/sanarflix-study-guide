-- Criar tabela de histórico de respostas para tentativas substituídas
CREATE TABLE public.answer_progress_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Campos originais da answer_progress
  answer_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  simulado UUID NOT NULL REFERENCES public.simulados_admin(id),
  question_id UUID NOT NULL REFERENCES public.questoes_simulado(id),
  resposta_usuario TEXT,
  correct BOOLEAN NOT NULL,
  "respondida?" BOOLEAN DEFAULT false,
  -- Campos de controle de histórico
  finalizacao_original_id UUID NOT NULL REFERENCES public.simulados_finalizados(id) ON DELETE CASCADE,
  substituida_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_answer_historico_user_simulado ON public.answer_progress_historico(user_id, simulado);
CREATE INDEX idx_answer_historico_finalizacao ON public.answer_progress_historico(finalizacao_original_id);

-- RLS
ALTER TABLE public.answer_progress_historico ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas seu próprio histórico
CREATE POLICY "Users can view their own answer history"
ON public.answer_progress_historico
FOR SELECT
USING (auth.uid() = user_id);

-- Política para admins verem todo o histórico
CREATE POLICY "Admins can view all answer history"
ON public.answer_progress_historico
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Política para service role poder inserir/deletar (usado pela edge function)
CREATE POLICY "Service role can manage answer history"
ON public.answer_progress_historico
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Adicionar campo de tentativa na tabela de finalizações para ordenar tentativas
ALTER TABLE public.simulados_finalizados 
ADD COLUMN IF NOT EXISTS tentativa_numero INTEGER NOT NULL DEFAULT 1;

-- Comentário na tabela
COMMENT ON TABLE public.answer_progress_historico IS 'Armazena respostas de tentativas anteriores de simulados que foram substituídas após re-liberação pelo admin';