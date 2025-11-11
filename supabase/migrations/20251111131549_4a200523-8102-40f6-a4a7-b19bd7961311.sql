-- Adicionar campo semestre_destino à tabela announcements
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS semestre_destino INTEGER;

-- Adicionar campo para controlar se o aviso já foi visualizado pelo usuário
CREATE TABLE IF NOT EXISTS public.announcements_viewed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, announcement_id)
);

-- Habilitar RLS na nova tabela
ALTER TABLE public.announcements_viewed ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas seus próprios registros
CREATE POLICY "Users can view their own viewed announcements"
ON public.announcements_viewed
FOR SELECT
USING (auth.uid() = user_id);

-- Política para usuários inserirem seus próprios registros
CREATE POLICY "Users can insert their own viewed announcements"
ON public.announcements_viewed
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Comentários para documentação
COMMENT ON COLUMN public.announcements.semestre_destino IS 'Semestre de destino do aviso (null = todos os semestres)';
COMMENT ON TABLE public.announcements_viewed IS 'Registra quais avisos foram visualizados por cada usuário';