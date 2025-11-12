-- Habilita RLS na tabela answer_progress_enamed (se ainda não estiver)
ALTER TABLE public.answer_progress_enamed ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas se existirem
DROP POLICY IF EXISTS "Usuários podem inserir suas próprias respostas" ON public.answer_progress_enamed;
DROP POLICY IF EXISTS "Usuários podem visualizar suas próprias respostas" ON public.answer_progress_enamed;

-- Policy para permitir INSERT de respostas (usuários autenticados)
CREATE POLICY "Usuários podem inserir suas próprias respostas"
ON public.answer_progress_enamed
FOR INSERT
TO authenticated
WITH CHECK (auth.email() = email);

-- Policy para permitir SELECT de respostas (usuários podem ver apenas suas próprias)
CREATE POLICY "Usuários podem visualizar suas próprias respostas"
ON public.answer_progress_enamed
FOR SELECT
TO authenticated
USING (auth.email() = email);