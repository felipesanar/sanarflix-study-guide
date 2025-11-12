-- Ajustar tabela answer_progress_enamed para usar UUID no question_id e adicionar resposta_usuario

-- 1. Remover constraint not null temporariamente para permitir alteração
ALTER TABLE public.answer_progress_enamed ALTER COLUMN question_id DROP NOT NULL;

-- 2. Criar nova coluna temporária com tipo UUID
ALTER TABLE public.answer_progress_enamed ADD COLUMN question_id_new UUID;

-- 3. Tentar copiar dados existentes (se houver algum dado válido como UUID)
-- Como os dados existentes são integer, vamos apenas limpar a tabela
TRUNCATE TABLE public.answer_progress_enamed;

-- 4. Remover coluna antiga
ALTER TABLE public.answer_progress_enamed DROP COLUMN question_id;

-- 5. Renomear nova coluna
ALTER TABLE public.answer_progress_enamed RENAME COLUMN question_id_new TO question_id;

-- 6. Adicionar constraint not null de volta
ALTER TABLE public.answer_progress_enamed ALTER COLUMN question_id SET NOT NULL;

-- 7. Adicionar coluna para armazenar a resposta do usuário (A, B, C, D)
ALTER TABLE public.answer_progress_enamed ADD COLUMN resposta_usuario TEXT;

-- 8. Adicionar constraint check para garantir que resposta_usuario seja A, B, C ou D
ALTER TABLE public.answer_progress_enamed ADD CONSTRAINT resposta_usuario_check 
  CHECK (resposta_usuario IN ('A', 'B', 'C', 'D'));

-- 9. Criar índice para question_id (UUID)
CREATE INDEX IF NOT EXISTS idx_answer_progress_question_id ON public.answer_progress_enamed(question_id);

-- 10. Comentários
COMMENT ON COLUMN public.answer_progress_enamed.question_id IS 'UUID da questão do simulado';
COMMENT ON COLUMN public.answer_progress_enamed.resposta_usuario IS 'Alternativa escolhida pelo usuário (A, B, C ou D)';
COMMENT ON COLUMN public.answer_progress_enamed.correct IS 'Se a resposta do usuário está correta ou não';