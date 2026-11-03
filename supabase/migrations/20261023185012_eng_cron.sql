-- eng_cron: agenda o refresh diário da camada eng_* (D16)
-- Spec: docs/superpowers/specs/2026-10-22-engajamento-sanarflix-design.md (§6.5)

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'eng-refresh-diario';   -- idempotência
SELECT cron.schedule(
  'eng-refresh-diario',
  '0 9 * * *',                                   -- 09:00 UTC = 06:00 America/Sao_Paulo
  $$SET statement_timeout TO '30min'; SELECT public.eng_refresh('cron');$$
);
