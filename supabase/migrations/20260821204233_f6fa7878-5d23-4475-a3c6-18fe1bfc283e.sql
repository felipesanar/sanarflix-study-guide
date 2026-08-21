INSERT INTO public.ies_features (ies_id, feature_key, enabled)
SELECT i.id, 'gestao.portal_v2', true
FROM public.ies i
WHERE i.nome ILIKE '%uscs%'
ON CONFLICT (ies_id, feature_key) DO UPDATE SET enabled = true, updated_at = now();