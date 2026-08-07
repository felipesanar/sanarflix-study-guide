INSERT INTO public.feature_catalog (key, experience, label, description, sort_order, is_master, active)
VALUES ('gestao.enabled', 'gestao', 'Portal do Gestor', 'Chave mestra do módulo de gestão', 100, true, true)
ON CONFLICT (key) DO UPDATE SET active = true, is_master = true, experience = 'gestao';

INSERT INTO public.ies_features (ies_id, feature_key, enabled)
SELECT i.id, 'gestao.enabled', true
FROM public.ies i
WHERE i.nome IN (
  'B2B','FAI','Funepe','PARACATU','PASSOS','PORTO SEGURO','SETE LAGOAS','SORRISO',
  'TESTE_IES Performance Acadêmica','UEA','UNIVILLE','USCS - BELA VISTA','USCS - SÃO CAETANO','VALENÇA'
)
ON CONFLICT (ies_id, feature_key) DO UPDATE SET enabled = true;