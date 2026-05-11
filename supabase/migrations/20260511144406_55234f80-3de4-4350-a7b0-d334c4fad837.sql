INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT ur.user_id, 'gestor'::app_role
FROM public.user_roles ur
JOIN public.users u ON u.id = ur.user_id
WHERE ur.role = 'gestor_formal'
  AND u.id_ies = '2c458bcb-98f0-4dc2-8b43-298e85298845'
ON CONFLICT (user_id, role) DO NOTHING;