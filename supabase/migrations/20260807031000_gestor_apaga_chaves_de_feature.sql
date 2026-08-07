-- Apaga as 3 chaves de gestao e a helper que ficou orfa.
-- Depende da migration anterior (20260807030000), que tirou o guard das 11
-- RPCs get_gestor_*. Dropar user_has_feature_for_ies com as 11 ainda
-- chamando-a quebraria todas -- por isso a ordem entre as duas migrations
-- importa.
-- NAO FOI APLICADA em producao (07/08/2026).
--
-- user_has_feature(text) NAO e tocada: 19 RPCs institucionais legadas ainda a
-- usam para chaves aluno.%. O ramo dela que trata gestao.% vira inerte (as
-- linhas de ies_features/feature_catalog que ela leria para 'gestao.enabled'
-- deixam de existir), mas a funcao em si permanece, sem CREATE OR REPLACE
-- nem DROP.

DELETE FROM public.ies_features
 WHERE feature_key IN ('gestao.enabled', 'gestao.exportar', 'gestao.ia');

DELETE FROM public.feature_catalog
 WHERE key IN ('gestao.enabled', 'gestao.exportar', 'gestao.ia');

DROP FUNCTION IF EXISTS public.user_has_feature_for_ies(text, uuid);
