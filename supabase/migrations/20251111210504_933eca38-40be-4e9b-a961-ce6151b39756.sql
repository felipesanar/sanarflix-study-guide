-- Criar tabela sanarclass_lessons
CREATE TABLE public.sanarclass_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  professor TEXT NOT NULL,
  disciplina TEXT NOT NULL,
  semestre INTEGER NOT NULL,
  formato TEXT NOT NULL CHECK (formato IN ('pdf', 'pptx')),
  data_publicacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  arquivo_url TEXT NOT NULL,
  preview_url TEXT,
  ies_id UUID NOT NULL REFERENCES public.ies(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.sanarclass_lessons ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver aulas da sua IES
CREATE POLICY "Usuários podem ver aulas da sua IES"
ON public.sanarclass_lessons
FOR SELECT
USING (ies_id = get_current_user_ies_id());

-- Policy: Admins podem gerenciar todas as aulas
CREATE POLICY "Admins podem gerenciar todas as aulas"
ON public.sanarclass_lessons
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sanarclass_lessons_updated_at
BEFORE UPDATE ON public.sanarclass_lessons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para performance
CREATE INDEX idx_sanarclass_lessons_ies_id ON public.sanarclass_lessons(ies_id);
CREATE INDEX idx_sanarclass_lessons_professor ON public.sanarclass_lessons(professor);
CREATE INDEX idx_sanarclass_lessons_disciplina ON public.sanarclass_lessons(disciplina);
CREATE INDEX idx_sanarclass_lessons_semestre ON public.sanarclass_lessons(semestre);