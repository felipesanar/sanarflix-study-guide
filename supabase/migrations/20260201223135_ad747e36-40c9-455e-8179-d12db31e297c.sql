-- Alterar o valor default do campo status de 'rascunho' para 'aguardando'
ALTER TABLE simulados_admin 
ALTER COLUMN status SET DEFAULT 'aguardando';

-- Atualizar simulados existentes com status 'rascunho' para 'aguardando'
UPDATE simulados_admin 
SET status = 'aguardando' 
WHERE status = 'rascunho';