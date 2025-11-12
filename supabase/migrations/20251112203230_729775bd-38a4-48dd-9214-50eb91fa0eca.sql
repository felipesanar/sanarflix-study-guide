-- Migração da coluna simulado de integer para UUID em answer_progress
-- Esta migração remove todos os dados antigos da tabela answer_progress pois não há
-- mapeamento válido entre os hashes numéricos antigos e os UUIDs dos simulados

-- ATENÇÃO: Esta operação remove TODOS os dados existentes em answer_progress
-- Os dados serão recriados quando os alunos responderem novamente aos simulados

-- Passo 1: Remover constraint de NOT NULL temporariamente se existir
ALTER TABLE public.answer_progress ALTER COLUMN simulado DROP NOT NULL;

-- Passo 2: Limpar todos os dados da tabela (necessário devido à incompatibilidade de tipos)
TRUNCATE TABLE public.answer_progress;

-- Passo 3: Remover a coluna antiga
ALTER TABLE public.answer_progress DROP COLUMN simulado;

-- Passo 4: Adicionar nova coluna como UUID com NOT NULL
ALTER TABLE public.answer_progress 
ADD COLUMN simulado UUID NOT NULL;

-- Passo 5: Adicionar foreign key constraint
ALTER TABLE public.answer_progress 
ADD CONSTRAINT fk_answer_progress_simulado 
FOREIGN KEY (simulado) 
REFERENCES public.simulados_admin(id) 
ON DELETE CASCADE;

-- Passo 6: Criar índices para performance
CREATE INDEX idx_answer_progress_simulado ON public.answer_progress(simulado);
CREATE INDEX idx_answer_progress_email_simulado ON public.answer_progress(email, simulado);