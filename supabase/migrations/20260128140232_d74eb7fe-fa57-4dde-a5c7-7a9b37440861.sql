
-- Corrigir retroativamente todas as respostas de questões anuladas para correct = true
UPDATE public.answer_progress
SET correct = true
WHERE question_id IN (
  SELECT id FROM public.questoes_simulado WHERE anulada = true
) AND correct = false;
