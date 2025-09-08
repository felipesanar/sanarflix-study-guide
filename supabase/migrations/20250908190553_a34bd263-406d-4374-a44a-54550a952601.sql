-- Criar tabela para armazenar o progresso do usuário no guia de estudos
CREATE TABLE public.study_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('aula', 'subtema', 'tema')),
  content_id TEXT NOT NULL,
  materia_id TEXT NOT NULL,
  semestre INTEGER NOT NULL,
  ies_nome TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Evitar duplicatas para o mesmo usuário e conteúdo
  UNIQUE(user_id, content_type, content_id, materia_id)
);

-- Habilitar RLS
ALTER TABLE public.study_progress ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para study_progress
CREATE POLICY "Users can view their own study progress" 
ON public.study_progress 
FOR SELECT 
USING (user_id = auth.uid()::TEXT);

CREATE POLICY "Users can insert their own study progress" 
ON public.study_progress 
FOR INSERT 
WITH CHECK (user_id = auth.uid()::TEXT AND user_email = auth.jwt()->>'email');

CREATE POLICY "Users can update their own study progress" 
ON public.study_progress 
FOR UPDATE 
USING (user_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own study progress" 
ON public.study_progress 
FOR DELETE 
USING (user_id = auth.uid()::TEXT);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_study_progress_updated_at
BEFORE UPDATE ON public.study_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_study_progress_user_id ON public.study_progress(user_id);
CREATE INDEX idx_study_progress_user_content ON public.study_progress(user_id, content_type, materia_id);
CREATE INDEX idx_study_progress_completed ON public.study_progress(user_id, completed) WHERE completed = true;