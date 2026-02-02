-- Insert the missing second attempt record for Felipe
INSERT INTO public.simulados_finalizados (
  user_id,
  simulado_id,
  tentativa_numero,
  tempo_total_segundos,
  saidas_de_aba,
  saidas_de_fullscreen,
  finalizado_em,
  liberado_novamente,
  liberado_em,
  liberado_por
) VALUES (
  'c62a7e9a-0da5-4b5b-bf45-44f559ae5d46',
  'fb732f24-ef1d-478f-99a6-baf11e47d74a',
  2,
  600, -- tempo estimado
  0,
  0,
  '2026-02-01 23:49:08.135+00', -- baseado no timestamp do histórico
  false,
  null,
  null
);