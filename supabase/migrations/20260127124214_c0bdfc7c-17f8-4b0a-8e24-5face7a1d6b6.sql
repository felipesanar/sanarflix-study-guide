-- Adicionar coluna para registrar saídas do modo tela cheia
ALTER TABLE public.simulados_finalizados 
ADD COLUMN IF NOT EXISTS saidas_de_fullscreen integer NOT NULL DEFAULT 0;