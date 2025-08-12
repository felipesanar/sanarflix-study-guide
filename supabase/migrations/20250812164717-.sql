-- Criar tabela para armazenar progresso do usuário
CREATE TABLE public.user_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id text NOT NULL,
  completed_at timestamp WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at timestamp WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at timestamp WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- Habilitar RLS
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas seu próprio progresso
CREATE POLICY "Usuários podem ver seu próprio progresso" 
ON public.user_progress 
FOR SELECT 
USING (auth.uid() = user_id);

-- Política para usuários inserirem seu próprio progresso
CREATE POLICY "Usuários podem criar seu próprio progresso" 
ON public.user_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Política para usuários atualizarem seu próprio progresso
CREATE POLICY "Usuários podem atualizar seu próprio progresso" 
ON public.user_progress 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Política para usuários removerem seu próprio progresso
CREATE POLICY "Usuários podem remover seu próprio progresso" 
ON public.user_progress 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_progress_updated_at
BEFORE UPDATE ON public.user_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();