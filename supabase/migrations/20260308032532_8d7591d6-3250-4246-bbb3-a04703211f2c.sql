
CREATE TABLE public.error_notebook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  simulado_id UUID NOT NULL,
  simulado_nome TEXT NOT NULL,
  grande_area TEXT,
  especialidade TEXT,
  tema TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('did_not_know','did_not_remember','did_not_understand_statement','answered_without_confidence')),
  learning_text TEXT,
  was_correct BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'simulation_correction',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.error_notebook_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own entries"
  ON public.error_notebook_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all entries"
  ON public.error_notebook_entries FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_error_notebook_user ON error_notebook_entries(user_id);
CREATE INDEX idx_error_notebook_tema ON error_notebook_entries(tema);
CREATE INDEX idx_error_notebook_simulado ON error_notebook_entries(simulado_id);
CREATE INDEX idx_error_notebook_reason ON error_notebook_entries(reason);
CREATE INDEX idx_error_notebook_created ON error_notebook_entries(created_at DESC);

CREATE TRIGGER update_error_notebook_updated_at
  BEFORE UPDATE ON error_notebook_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
