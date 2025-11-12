-- Renomear tabela answer_progress_enamed para answer_progress
ALTER TABLE public.answer_progress_enamed RENAME TO answer_progress;

-- Renomear constraint de chave primária
ALTER INDEX answer_progress_enamed_pkey RENAME TO answer_progress_pkey;

-- Atualizar comentários da tabela se houver
COMMENT ON TABLE public.answer_progress IS 'Tabela para armazenar respostas dos alunos aos simulados';