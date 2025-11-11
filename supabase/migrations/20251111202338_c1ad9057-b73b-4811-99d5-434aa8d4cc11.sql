-- Criar tabela para tracking de visualizações de aulas
CREATE TABLE IF NOT EXISTS public.aula_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conteudo_id uuid NOT NULL REFERENCES public.conteudos(id) ON DELETE CASCADE,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar índice para melhorar performance das queries
CREATE INDEX IF NOT EXISTS idx_aula_views_user_id ON public.aula_views(user_id);
CREATE INDEX IF NOT EXISTS idx_aula_views_conteudo_id ON public.aula_views(conteudo_id);
CREATE INDEX IF NOT EXISTS idx_aula_views_viewed_at ON public.aula_views(viewed_at DESC);

-- Habilitar RLS
ALTER TABLE public.aula_views ENABLE ROW LEVEL SECURITY;

-- Policy: usuários podem ver apenas suas próprias visualizações
CREATE POLICY "Users can view their own aula views"
  ON public.aula_views
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: usuários podem inserir suas próprias visualizações
CREATE POLICY "Users can insert their own aula views"
  ON public.aula_views
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: usuários podem deletar suas próprias visualizações
CREATE POLICY "Users can delete their own aula views"
  ON public.aula_views
  FOR DELETE
  USING (auth.uid() = user_id);