-- Criar tabela para armazenar rearranjos do calendário
CREATE TABLE public.calendar_arrangements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  week text NOT NULL,
  day text NOT NULL,
  position integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_key)
);

-- Habilitar RLS
ALTER TABLE public.calendar_arrangements ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver seus próprios arranjos"
  ON public.calendar_arrangements
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios arranjos"
  ON public.calendar_arrangements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios arranjos"
  ON public.calendar_arrangements
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios arranjos"
  ON public.calendar_arrangements
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_calendar_arrangements_updated_at
  BEFORE UPDATE ON public.calendar_arrangements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();