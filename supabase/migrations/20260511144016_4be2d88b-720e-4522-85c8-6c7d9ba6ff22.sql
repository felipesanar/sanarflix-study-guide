INSERT INTO public.user_roles (user_id, role)
VALUES ('6dfa5f73-8d32-41b3-a845-d77e5e131a02', 'gestor')
ON CONFLICT (user_id, role) DO NOTHING;