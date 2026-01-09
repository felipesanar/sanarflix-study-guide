-- =====================================================
-- Tabela ies_features: Configuração dinâmica de features por IES
-- Elimina necessidade de deploys para novas IES
-- =====================================================

CREATE TABLE public.ies_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ies_id UUID NOT NULL REFERENCES public.ies(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (ies_id, feature_key)
);

-- Habilitar RLS
ALTER TABLE public.ies_features ENABLE ROW LEVEL SECURITY;

-- Policies: Leitura pública, escrita apenas para admins
CREATE POLICY "Features são públicas para leitura"
  ON public.ies_features FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem modificar features"
  ON public.ies_features FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ies_features_updated_at
  BEFORE UPDATE ON public.ies_features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para buscas rápidas
CREATE INDEX idx_ies_features_ies_id ON public.ies_features(ies_id);

-- =====================================================
-- Popular dados iniciais baseados no accessRules.ts
-- =====================================================

-- B2C IES
INSERT INTO public.ies_features (ies_id, feature_key, enabled) VALUES
  ('abec7c7d-ef07-4871-9e19-090f4d951e5e', 'cronogramaEnamed', true);

-- IES B2B Padrão
INSERT INTO public.ies_features (ies_id, feature_key, enabled) VALUES
  ('9f21b138-0027-44c8-9660-dc6706d57bc0', 'studyGuide', true),
  ('9f21b138-0027-44c8-9660-dc6706d57bc0', 'enamed', true),
  ('9f21b138-0027-44c8-9660-dc6706d57bc0', 'dashboard', true),
  ('9f21b138-0027-44c8-9660-dc6706d57bc0', 'SimuladoDesempenho', true);

-- UNICEUB
INSERT INTO public.ies_features (ies_id, feature_key, enabled) VALUES
  ('954aad2f-4030-4d5d-b27a-19eb8fac05cf', 'studyGuide', true),
  ('954aad2f-4030-4d5d-b27a-19eb8fac05cf', 'enamed', true),
  ('954aad2f-4030-4d5d-b27a-19eb8fac05cf', 'dashboard', true);

-- UniAtenas Paracatu
INSERT INTO public.ies_features (ies_id, feature_key, enabled) VALUES
  ('12cfa7f2-45ba-406f-9e4d-aa719a6b94ca', 'enamed', true),
  ('12cfa7f2-45ba-406f-9e4d-aa719a6b94ca', 'SimuladoDesempenho', true);

-- UniAtenas Passos
INSERT INTO public.ies_features (ies_id, feature_key, enabled) VALUES
  ('3e51663e-8766-4881-bfd1-0921678ed014', 'enamed', true),
  ('3e51663e-8766-4881-bfd1-0921678ed014', 'SimuladoDesempenho', true);

-- UniAtenas Patos de Minas
INSERT INTO public.ies_features (ies_id, feature_key, enabled) VALUES
  ('5c6e697f-853c-415b-8690-65a27a9384f0', 'enamed', true),
  ('5c6e697f-853c-415b-8690-65a27a9384f0', 'SimuladoDesempenho', true);

-- UniAtenas Sete Lagoas
INSERT INTO public.ies_features (ies_id, feature_key, enabled) VALUES
  ('314b3bb2-a758-42d6-a9bb-e68e2fb35bba', 'enamed', true),
  ('314b3bb2-a758-42d6-a9bb-e68e2fb35bba', 'SimuladoDesempenho', true);

-- USCS
INSERT INTO public.ies_features (ies_id, feature_key, enabled) VALUES
  ('e40a0ec1-1150-40e6-b492-8b8e3f8db593', 'SimuladoDesempenho', true),
  ('e40a0ec1-1150-40e6-b492-8b8e3f8db593', 'intensivoUSCS', true);

-- =====================================================
-- Função para obter features de uma IES
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_ies_features(p_ies_id UUID)
RETURNS TABLE (feature_key TEXT, enabled BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT feature_key, enabled
  FROM public.ies_features
  WHERE ies_id = p_ies_id;
$$;

-- Função para verificar se uma IES tem uma feature específica
CREATE OR REPLACE FUNCTION public.ies_has_feature(p_ies_id UUID, p_feature TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.ies_features WHERE ies_id = p_ies_id AND feature_key = p_feature),
    false
  );
$$;