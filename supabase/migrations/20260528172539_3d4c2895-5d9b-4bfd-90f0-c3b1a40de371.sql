-- Adiciona suporte a uma segunda imagem no enunciado da questão de simulado.
-- Aditivo, nullable, sem impacto em dados existentes.
ALTER TABLE public.questoes_simulado
  ADD COLUMN IF NOT EXISTS imagem_2 text NULL;

COMMENT ON COLUMN public.questoes_simulado.imagem_2
  IS 'Segunda imagem opcional do enunciado (renderizada logo abaixo de "imagem"). Importada via planilha XLSX a partir da coluna "Imagem 2 do enunciado".';