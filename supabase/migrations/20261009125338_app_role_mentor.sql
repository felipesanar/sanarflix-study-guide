-- Papel novo da Página do Mentor. ADD VALUE não pode ser usado na mesma
-- transação em que é criado, por isso vive sozinho neste arquivo.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mentor';
