INSERT INTO public.ies_features (ies_id, feature_key, enabled)
VALUES ('00000000-0000-5000-a000-00003ef75c87', 'desempenhoInstitucional', true)
ON CONFLICT (ies_id, feature_key) DO UPDATE SET enabled = true, updated_at = now();