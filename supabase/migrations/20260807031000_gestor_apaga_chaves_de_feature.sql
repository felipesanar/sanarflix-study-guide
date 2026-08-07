-- ============================================================================
-- PRE-REQUISITO DE FRONT -- LEIA ANTES DE APLICAR (07/08/2026)
--
-- Este DELETE tem uma dependencia no front que o spec original nao previa. A
-- premissa "gestao.exportar e gestao.ia sao dado morto, zero consumidores"
-- estava ERRADA para a main de hoje: src/experiences/gestor/GestorLayout.tsx
-- lia as duas chaves via useEffectiveFeatures/get_effective_features e com
-- elas renderizava os botoes "Exportar" e "IA" do header do /gestor e os
-- drawers correspondentes. hasFeature devolve false para chave inexistente,
-- entao apagar as linhas faz os dois botoes sumirem em silencio para TODO
-- gestor. A varredura original nao viu porque rodou na branch do PR #17, onde
-- o arquivo ja nao existe.
--
-- SO APLIQUE se ao menos uma destas for verdade:
--   (a) o commit "fix(gestor): Exportar e IA deixam de depender de
--       ies_features" ja esta na main E deployado (removeu o gate e travou o
--       comportamento em src/test/unit/gestorExportarIaSemFeature.test.tsx); ou
--   (b) o PR #17 (feat/portal-gestor-v2) ja esta mergeado E deployado -- ele
--       apaga src/experiences/gestor/ inteiro e o portal novo
--       (src/features/gestor/) nao referencia nenhuma das duas chaves.
--
-- Conferir na main, antes de aplicar. Este comando lista quem AINDA consome
-- qualquer chave 'gestao.*' -- e as 3 chaves apagadas aqui nao podem aparecer:
--   git grep -nE "hasFeature\(\s*['\"]gestao\." -- src/
--
-- Grepar so por "gestao.exportar" da falso positivo (pega comentario e o
-- proprio teste de regressao); e o hasFeature( que denuncia consumo real.
--
-- Resultado esperado: nenhuma linha com gestao.enabled, gestao.exportar ou
-- gestao.ia. Sobra so o teste de useAccessRules citando gestao.visao_institucional,
-- que nao e apagada aqui. Atencao: pr1/front conserta o consumidor de
-- gestao.enabled (useAccessRules.ts passa a usar hasExperience), mas NAO toca
-- GestorLayout.tsx -- os dois consumidores de exportar/ia sobrevivem a pr1/front.
--
-- Efeito colateral do fix (a), a conferir em producao (projeto gvqv, NAO lljn):
-- IES que hoje tenham gestao.exportar/gestao.ia = false, ou nenhuma linha,
-- passam a ver os dois botoes. Pelo seed de 09/07 todas as IES com gestor
-- ativo receberam as duas chaves = true, entao o esperado e zero afetadas:
--   SELECT feature_key, enabled, count(*)
--     FROM public.ies_features
--    WHERE feature_key IN ('gestao.exportar','gestao.ia')
--    GROUP BY 1,2 ORDER BY 1,2;
-- ============================================================================

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
