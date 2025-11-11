-- Adicionar campos imagem e observacao na tabela questoes_simulado
ALTER TABLE public.questoes_simulado 
ADD COLUMN IF NOT EXISTS imagem TEXT,
ADD COLUMN IF NOT EXISTS feedback_corretas TEXT,
ADD COLUMN IF NOT EXISTS observacao TEXT;