INSERT INTO public.ies_features (ies_id, feature_key, enabled)
SELECT id, 'home', true FROM public.ies WHERE nome = 'FAI'
ON CONFLICT DO NOTHING;

INSERT INTO public.ies_features (ies_id, feature_key, enabled)
SELECT id, 'studyGuide', true FROM public.ies WHERE nome = 'FAI'
ON CONFLICT DO NOTHING;