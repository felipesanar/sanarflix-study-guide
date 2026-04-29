
-- 1) Adiciona novo valor ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor_formal';
