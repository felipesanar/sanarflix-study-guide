-- 20260803140000_normaliza_whitespace_hierarquia_questoes.sql
--
-- O QUE FAZ: normaliza whitespace (espaços, \n, \r, \t nas pontas + espaços
-- internos repetidos colapsados em um só) nas tres colunas da hierarquia de
-- conteudo de public.questoes_simulado -- grande_area, especialidade, tema --
-- atualizando SOMENTE as linhas cujo valor normalizado difere do valor atual.
--
-- NUMEROS MEDIDOS (auditoria de 28/07/2026, ver docs/superpowers/notes/
-- 2026-07-25-auditoria-hierarquia-simulados.md, secao 1.5.1):
--   - especialidade: 136 linhas sujas, formando 8 nos duplicados
--     (o caso 'Cirurgia\n' / 'Trauma\n' de 2 linhas ja foi corrigido em prod
--      via UPDATE direto em 28/07 e nao faz parte do escopo desta migration)
--   - tema:          6 linhas sujas, 1 no duplicado
--   - competencia:   13 linhas sujas -- FORA DE ESCOPO aqui (nao pertence a
--     hierarquia de 3 niveis da spec §4.9 e tem ~1.300 linhas que sao
--     whitespace puro; btrim as esvaziaria e desclassificaria a questao)
--   - grande_area:   2 linhas ('Cirurgia\n'), JA CORRIGIDO em produção em
--     28/07/2026 -- incluido aqui de novo apenas por seguranca/idempotencia,
--     nao deve tocar nenhuma linha se a migration rodar depois daquele fix.
--
-- POR QUE IMPORTA: especialidade e o 2º nivel da Cascata de Diagnostico
-- Curricular (Tasks 42/43, spec §4.9/§7.6). Sem esta normalizacao, a
-- coordenadora veria a mesma especialidade aparecer duas vezes dentro de uma
-- grande area, com o % de acerto dividido entre os dois nos -- 8 nos
-- duplicados na tela. Nenhuma RPC get_gestor_* aplica trim nestas colunas ao
-- agrupar (confirmado por grep em supabase/migrations/2026072921*.sql):
-- get_gestor_diagnostico agrupa por r.grande_area / r.especialidade "cru", e
-- get_gestor_diagnostico_temas filtra com "q.especialidade = p_especialidade"
-- tambem sem trim -- a normalizacao do dado e a UNICA correcao para o
-- problema, nao uma redundancia com nenhum trim de RPC.
--
-- EXIGENCIA ANTES DE RODAR EM PRODUCAO: os numeros acima sao de 28/07/2026.
-- Execute primeiro o SELECT de contagem (bloco "DRY-RUN" ao final deste
-- arquivo) para confirmar o escopo real no momento da execucao -- o dado
-- pode ter mudado desde a medicao (novo simulado importado, nova questao
-- cadastrada etc).
--
-- Por que e seguro mesclar: todos os 8 valores sujos de especialidade (e o
-- 1 de tema) duplicam um valor limpo que ja existe -- normalizar MESCLA os
-- nos, nao perde informacao nem cria valor novo. Confirmado na auditoria que
-- nenhuma das tres colunas tem valor composto so de whitespace, entao btrim
-- nunca produz string vazia aqui (o que desclassificaria a questao).
--
-- NAO adiciona constraint nem trigger -- apenas o UPDATE de dado. Ver
-- pendencias/decisoes do agente que gerou esta migration para a recomendacao
-- de constraint preventiva (fora de escopo aqui, por pedido explicito).
--
-- IDEMPOTENTE: cada UPDATE tem WHERE coluna <> normalizado, entao rodar esta
-- migration uma segunda vez nao altera nenhuma linha (o predicado passa a ser
-- falso para todo mundo depois da primeira execucao).

-- normaliza grande_area (defesa -- esperado 0 linhas, ja corrigido em prod)
UPDATE public.questoes_simulado
SET grande_area = btrim(regexp_replace(grande_area, '\s+', ' ', 'g')),
    updated_at  = now()
WHERE grande_area IS NOT NULL
  AND grande_area <> btrim(regexp_replace(grande_area, '\s+', ' ', 'g'));

-- normaliza especialidade (escopo principal -- esperado ~136 linhas)
UPDATE public.questoes_simulado
SET especialidade = btrim(regexp_replace(especialidade, '\s+', ' ', 'g')),
    updated_at    = now()
WHERE especialidade IS NOT NULL
  AND especialidade <> btrim(regexp_replace(especialidade, '\s+', ' ', 'g'));

-- normaliza tema (esperado ~6 linhas)
UPDATE public.questoes_simulado
SET tema       = btrim(regexp_replace(tema, '\s+', ' ', 'g')),
    updated_at = now()
WHERE tema IS NOT NULL
  AND tema <> btrim(regexp_replace(tema, '\s+', ' ', 'g'));

-- =========================================================================
-- (a) DRY-RUN -- rodar ANTES desta migration, para confirmar o escopo real
--     (os numeros medidos em 28/07 podem ter mudado):
-- =========================================================================
--
-- SELECT
--   'grande_area'   AS coluna,
--   count(*) FILTER (WHERE grande_area   IS NOT NULL
--     AND grande_area   <> btrim(regexp_replace(grande_area,   '\s+', ' ', 'g'))) AS linhas_sujas
-- FROM public.questoes_simulado
-- UNION ALL
-- SELECT
--   'especialidade',
--   count(*) FILTER (WHERE especialidade IS NOT NULL
--     AND especialidade <> btrim(regexp_replace(especialidade, '\s+', ' ', 'g')))
-- FROM public.questoes_simulado
-- UNION ALL
-- SELECT
--   'tema',
--   count(*) FILTER (WHERE tema          IS NOT NULL
--     AND tema          <> btrim(regexp_replace(tema,          '\s+', ' ', 'g')))
-- FROM public.questoes_simulado;
--
-- =========================================================================
-- (b) VERIFICACAO -- rodar DEPOIS desta migration; as tres devem devolver 0:
-- =========================================================================
--
-- SELECT count(*) AS grande_area_suja
-- FROM public.questoes_simulado
-- WHERE grande_area IS NOT NULL
--   AND grande_area <> btrim(regexp_replace(grande_area, '\s+', ' ', 'g'));
--
-- SELECT count(*) AS especialidade_suja
-- FROM public.questoes_simulado
-- WHERE especialidade IS NOT NULL
--   AND especialidade <> btrim(regexp_replace(especialidade, '\s+', ' ', 'g'));
--
-- SELECT count(*) AS tema_sujo
-- FROM public.questoes_simulado
-- WHERE tema IS NOT NULL
--   AND tema <> btrim(regexp_replace(tema, '\s+', ' ', 'g'));
--
-- =========================================================================
-- (c) PROVA DA MESCLAGEM -- contagem de valores distintos por nivel, rodar
--     ANTES e DEPOIS da migration; o numero de distintos deve CAIR (nunca
--     subir) em cada coluna, confirmando que so houve fusao de duplicata,
--     nunca perda de questao nem valor novo criado:
-- =========================================================================
--
-- SELECT
--   count(DISTINCT grande_area)   AS distintos_grande_area,
--   count(DISTINCT especialidade) AS distintos_especialidade,
--   count(DISTINCT tema)          AS distintos_tema
-- FROM public.questoes_simulado;
