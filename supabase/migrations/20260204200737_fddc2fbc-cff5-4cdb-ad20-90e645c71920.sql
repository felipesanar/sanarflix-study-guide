-- Fase 1: Limpar duplicatas existentes (manter apenas o registro mais antigo por created_at)
DELETE FROM public.calendar_subjects cs1
WHERE EXISTS (
  SELECT 1 FROM public.calendar_subjects cs2
  WHERE cs2.user_id = cs1.user_id
    AND cs2.name = cs1.name
    AND cs2.day_of_week = cs1.day_of_week
    AND cs2.created_at < cs1.created_at
);

-- Caso ainda restem duplicatas com mesmo created_at, remover por id (menor string)
DELETE FROM public.calendar_subjects cs1
WHERE EXISTS (
  SELECT 1 FROM public.calendar_subjects cs2
  WHERE cs2.user_id = cs1.user_id
    AND cs2.name = cs1.name
    AND cs2.day_of_week = cs1.day_of_week
    AND cs2.id::text < cs1.id::text
);

-- Fase 2: Adicionar constraint UNIQUE para evitar duplicatas futuras
ALTER TABLE public.calendar_subjects 
ADD CONSTRAINT unique_user_subject_day 
UNIQUE (user_id, name, day_of_week);