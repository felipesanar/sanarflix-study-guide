-- Criar tabela para matérias do calendário
CREATE TABLE IF NOT EXISTS public.calendar_subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time text NOT NULL,
  end_time text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar índice para melhorar performance de queries
CREATE INDEX idx_calendar_subjects_user_id ON public.calendar_subjects(user_id);

-- Habilitar RLS
ALTER TABLE public.calendar_subjects ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver suas próprias matérias"
  ON public.calendar_subjects
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias matérias"
  ON public.calendar_subjects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias matérias"
  ON public.calendar_subjects
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias matérias"
  ON public.calendar_subjects
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_calendar_subjects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calendar_subjects_updated_at
  BEFORE UPDATE ON public.calendar_subjects
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_subjects_updated_at();