-- Criar tabela para armazenar configurações de lembretes dos usuários
CREATE TABLE public.study_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  reminder_time time NOT NULL DEFAULT '08:00:00',
  days_before integer NOT NULL DEFAULT 0,
  notify_email boolean NOT NULL DEFAULT true,
  notify_push boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.study_reminders ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver suas próprias configurações de lembrete"
  ON public.study_reminders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias configurações de lembrete"
  ON public.study_reminders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias configurações de lembrete"
  ON public.study_reminders
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias configurações de lembrete"
  ON public.study_reminders
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_study_reminders_updated_at
  BEFORE UPDATE ON public.study_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();