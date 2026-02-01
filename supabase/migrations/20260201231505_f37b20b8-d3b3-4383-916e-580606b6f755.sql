-- Agendar cron job para verificar e enviar notificações de desempenho a cada 15 minutos
SELECT cron.schedule(
  'notify-performance-released-job',
  '*/15 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://gvqvrmkizemwsasmupmo.supabase.co/functions/v1/notify-performance-released',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2cXZybWtpemVtd3Nhc211cG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NzU1OTksImV4cCI6MjA2OTU1MTU5OX0.8viZ7xflE9Yb4vrKzaaKuMsQFLhr_NgyhrJtnDIFCOU"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);