-- Adicionar colunas de controle de liberação de desempenho
ALTER TABLE simulados_admin 
ADD COLUMN liberacao_desempenho text NOT NULL DEFAULT 'imediato',
ADD COLUMN data_liberacao_desempenho timestamp with time zone DEFAULT null;

-- Atualizar a função get_user_simulados para filtrar por liberação de desempenho
CREATE OR REPLACE FUNCTION public.get_user_simulados()
RETURNS TABLE(id uuid, nome text)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    ap.simulado as id,
    sa.nome
  FROM answer_progress ap
  JOIN simulados_admin sa ON ap.simulado = sa.id
  WHERE ap.user_id = auth.uid()
    AND (
      -- Liberacao imediata
      sa.liberacao_desempenho = 'imediato'
      -- Ou liberacao agendada e ja passou a data
      OR (sa.liberacao_desempenho = 'agendado' 
          AND sa.data_liberacao_desempenho IS NOT NULL 
          AND sa.data_liberacao_desempenho <= NOW())
      -- Ou liberacao ao encerrar e simulado ja encerrou
      OR (sa.liberacao_desempenho = 'ao_encerrar' 
          AND (sa.status = 'encerrado' 
               OR (sa.data_encerramento IS NOT NULL 
                   AND sa.data_encerramento <= NOW())))
    )
  ORDER BY sa.nome;
END;
$$;