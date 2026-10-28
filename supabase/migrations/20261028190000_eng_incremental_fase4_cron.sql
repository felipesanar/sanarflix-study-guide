-- eng_incremental_fase4_cron: liga o refresh incremental da camada eng_* no pg_cron
-- Spec: docs/superpowers/specs/2026-10-28-engajamento-refresh-incremental-design.md (§3.1 I1 e I3, Fase 4)
--
--   eng-refresh-incremental  a cada 5 min, no minuto 2 (depois dos lotes de questões da DAG)
--   eng-refresh-diario       rebuild total 1x/dia às 03:00 BRT (06:00 UTC), como rede de segurança
--                            (antes: 09:00 UTC / 06:00 BRT; o job antigo é substituído)
--   eng-vacuum-diario        VACUUM (ANALYZE) das tabelas eng_* às 03:40 BRT, depois do rebuild
-- Idempotente: cada job é removido pelo nome antes de ser agendado de novo.

-- ============================================================
-- 1. Incremental: a cada 5 min (minutos 2, 7, 12, ...)
-- ============================================================
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'eng-refresh-incremental';
SELECT cron.schedule(
  'eng-refresh-incremental',
  '2-59/5 * * * *',
  $$SET statement_timeout TO '90s'; SET lock_timeout TO '5s'; SELECT public.eng_refresh_incremental();$$
);

-- ============================================================
-- 2. Rebuild total: 06:00 UTC = 03:00 America/Sao_Paulo
-- ============================================================
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'eng-refresh-diario';
SELECT cron.schedule(
  'eng-refresh-diario',
  '0 6 * * *',
  $$SET statement_timeout TO '30min'; SELECT public.eng_refresh('cron');$$
);

-- ============================================================
-- 3. VACUUM diário, 40 min depois do rebuild (06:40 UTC = 03:40 BRT)
-- Um único comando, sem SET antes: VACUUM não roda dentro de bloco de transação.
-- ============================================================
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'eng-vacuum-diario';
SELECT cron.schedule(
  'eng-vacuum-diario',
  '40 6 * * *',
  $$VACUUM (ANALYZE) public.eng_atividade_aluno_dia, public.eng_questoes_aluno_dia_no,
           public.eng_consumo_aluno_dia_conteudo, public.eng_questao_classificacao$$
);
