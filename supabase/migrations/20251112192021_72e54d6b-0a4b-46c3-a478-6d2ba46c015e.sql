-- Remover a foreign key constraint antiga que referencia a tabela 'Simulados'
ALTER TABLE public.answer_progress_enamed 
DROP CONSTRAINT IF EXISTS answer_progress_enamed_simulado_fkey;

-- O campo 'simulado' agora é apenas um integer sem foreign key
-- pois a nova arquitetura usa simulados_admin com UUID
COMMENT ON COLUMN public.answer_progress_enamed.simulado IS 'ID numérico do simulado (compatibilidade legada, sem foreign key)';