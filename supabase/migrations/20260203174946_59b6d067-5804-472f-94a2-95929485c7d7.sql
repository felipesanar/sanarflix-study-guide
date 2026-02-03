-- Remover a restrição antiga que não permite 'aguardando'
ALTER TABLE public.simulados_admin DROP CONSTRAINT IF EXISTS simulados_admin_status_check;

-- Adicionar nova restrição permitindo 'aguardando' (usado pela lógica atual do sistema)
ALTER TABLE public.simulados_admin ADD CONSTRAINT simulados_admin_status_check 
CHECK (status IN ('ativo', 'aguardando', 'encerrado'));

-- Atualizar qualquer registro existente com status 'rascunho' para 'aguardando'
UPDATE public.simulados_admin SET status = 'aguardando' WHERE status = 'rascunho';