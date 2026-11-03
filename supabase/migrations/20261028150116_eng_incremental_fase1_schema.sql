-- eng_incremental_fase1_schema: suporte de schema para o refresh incremental da camada eng_*
-- Spec: docs/superpowers/specs/2026-10-28-engajamento-refresh-incremental-design.md (§5.1, Fase 1)
-- Sem mudança de comportamento: só índices, parâmetros de armazenamento e colunas do log.

-- ============================================================
-- 1. Índices por dia (o incremental apaga/regrava por faixa de dia)
-- ============================================================
CREATE INDEX IF NOT EXISTS eng_questoes_aluno_dia_no_dia_idx      ON public.eng_questoes_aluno_dia_no (dia);
CREATE INDEX IF NOT EXISTS eng_consumo_aluno_dia_conteudo_dia_idx ON public.eng_consumo_aluno_dia_conteudo (dia);

-- ============================================================
-- 2. Fillfactor e autovacuum agressivo (UPDATE in place gera tuplas mortas a cada 5 min)
-- O fillfactor só vale para páginas novas; as existentes são reescritas no primeiro rebuild da Fase 2.
-- ============================================================
ALTER TABLE public.eng_atividade_aluno_dia        SET (fillfactor = 85, autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE public.eng_questoes_aluno_dia_no      SET (fillfactor = 85, autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE public.eng_consumo_aluno_dia_conteudo SET (fillfactor = 85, autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);

-- ============================================================
-- 3. Log: tipo da execução e status 'pulado'
-- ============================================================
ALTER TABLE public.eng_refresh_log ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'completo'
  CONSTRAINT eng_refresh_log_tipo_check CHECK (tipo IN ('completo', 'incremental'));

ALTER TABLE public.eng_refresh_log DROP CONSTRAINT IF EXISTS eng_refresh_log_status_check;
ALTER TABLE public.eng_refresh_log ADD CONSTRAINT eng_refresh_log_status_check
  CHECK (status IN ('rodando', 'ok', 'erro', 'pulado'));

CREATE INDEX IF NOT EXISTS eng_refresh_log_tipo_ok_idx ON public.eng_refresh_log (tipo, terminado_em DESC) WHERE status = 'ok';
