-- Criar tabela para configuração de avisos
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  link_botao TEXT,
  texto_botao TEXT NOT NULL DEFAULT 'Ver mais',
  paleta_cores TEXT NOT NULL DEFAULT 'primary',
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_expiracao TIMESTAMP WITH TIME ZONE,
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  visibilidade TEXT NOT NULL DEFAULT 'todas' CHECK (visibilidade IN ('todas', 'seletivo', 'exceto')),
  ies_selecionadas UUID[] DEFAULT ARRAY[]::UUID[],
  ies_excluidas UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage all announcements
CREATE POLICY "Admins can manage announcements"
ON public.announcements
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Authenticated users can view active announcements for their IES
CREATE POLICY "Users can view their IES announcements"
ON public.announcements
FOR SELECT
TO authenticated
USING (
  ativo = true
  AND (data_expiracao IS NULL OR data_expiracao > now())
  AND (
    visibilidade = 'todas'
    OR (visibilidade = 'seletivo' AND get_current_user_ies_id() = ANY(ies_selecionadas))
    OR (visibilidade = 'exceto' AND NOT (get_current_user_ies_id() = ANY(ies_excluidas)))
  )
);

-- Trigger to update updated_at
CREATE TRIGGER update_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();