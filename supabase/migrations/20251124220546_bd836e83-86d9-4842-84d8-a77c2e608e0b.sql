-- Adicionar coluna user_id na tabela answer_progress
ALTER TABLE public.answer_progress 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_answer_progress_user_id 
ON public.answer_progress(user_id);

-- Atualizar RLS policies para usar user_id ao invés de email
DROP POLICY IF EXISTS "Users can view their own simulado progress via email" ON public.answer_progress;
DROP POLICY IF EXISTS "Usuários podem inserir suas próprias respostas" ON public.answer_progress;
DROP POLICY IF EXISTS "Usuários podem visualizar suas próprias respostas" ON public.answer_progress;

-- Criar nova policy para SELECT usando user_id
CREATE POLICY "Users can view their own answers by user_id"
ON public.answer_progress
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Criar nova policy para INSERT usando user_id
CREATE POLICY "Users can insert their own answers by user_id"
ON public.answer_progress
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);