UPDATE public.questoes_simulado
SET anulada = false
WHERE simulado_id IN (
  '4dc199a6-dbd8-4d2f-b471-2e6caa26b37e',
  'a0d7fb6c-7782-4090-a490-e91a7cbe8dd8',
  'b6df9cdc-84cb-49ef-9f4e-02445819f13a'
)
AND anulada = true;