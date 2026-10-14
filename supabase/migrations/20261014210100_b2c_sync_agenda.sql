-- Onda 3 da Página do Mentor: agenda diária da edge sync-simulados-b2c.
-- Roda às 07:00 UTC = 04:00 em São Paulo.
-- REQUISITO: o segredo 'service_role_key' precisa existir no Vault do projeto
-- (o controller o cadastra; o valor nunca é versionado).
-- Idempotente: remove o job anterior de mesmo nome antes de agendar.

select cron.unschedule(jobid) from cron.job where jobname = 'sync-simulados-b2c';

select cron.schedule(
  'sync-simulados-b2c',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://gvqvrmkizemwsasmupmo.supabase.co/functions/v1/sync-simulados-b2c',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
