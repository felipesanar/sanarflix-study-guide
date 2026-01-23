-- Remover registros duplicados em answer_progress, mantendo apenas o primeiro de cada questão
WITH duplicatas AS (
  SELECT answer_id, 
    ROW_NUMBER() OVER (
      PARTITION BY user_id, simulado, question_id 
      ORDER BY answer_id
    ) as rn
  FROM answer_progress
)
DELETE FROM answer_progress
WHERE answer_id IN (
  SELECT answer_id FROM duplicatas WHERE rn > 1
);