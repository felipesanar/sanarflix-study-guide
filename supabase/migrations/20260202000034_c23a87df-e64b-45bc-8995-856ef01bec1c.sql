-- Remove a constraint única antiga que impede múltiplas tentativas
ALTER TABLE public.simulados_finalizados 
DROP CONSTRAINT IF EXISTS simulados_finalizados_user_id_simulado_id_key;

-- Cria nova constraint que permite múltiplas tentativas (única por user_id + simulado_id + tentativa_numero)
ALTER TABLE public.simulados_finalizados 
ADD CONSTRAINT simulados_finalizados_unique_tentativa 
UNIQUE(user_id, simulado_id, tentativa_numero);

-- Adiciona índice para performance nas consultas de tentativas
CREATE INDEX IF NOT EXISTS idx_simulados_finalizados_tentativa 
ON public.simulados_finalizados(user_id, simulado_id, tentativa_numero DESC);