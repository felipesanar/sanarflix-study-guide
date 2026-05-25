-- Grupo UNIATENAS
INSERT INTO public.educational_groups (name, slug)
VALUES ('UNIATENAS', 'uniatenas')
ON CONFLICT (slug) DO NOTHING;

-- 6 IES vinculadas
INSERT INTO public.group_ies (group_id, ies_id)
SELECT g.id, x.ies_id
FROM public.educational_groups g
CROSS JOIN (VALUES
  ('d86c32ba-2d09-4c7e-a426-1d981ec7b595'::uuid), -- PARACATU
  ('9baa1401-bf54-4451-b96c-49e4823564fb'::uuid), -- PASSOS
  ('08cc7497-7ce6-49d8-828e-d6c897716cb7'::uuid), -- PORTO SEGURO
  ('a1f1e8ca-a58e-4f87-abfe-4cc62aa4a686'::uuid), -- SETE LAGOAS
  ('6e69a5e4-daab-4322-b70b-cdcf9f3c2cf9'::uuid), -- SORRISO
  ('ac2f94a5-d33b-4547-94ed-ae4d0877fbc7'::uuid)  -- VALENÇA
) AS x(ies_id)
WHERE g.slug = 'uniatenas'
ON CONFLICT DO NOTHING;

-- Stela como gestora do grupo
INSERT INTO public.user_groups (user_id, group_id, role)
SELECT '562bbcc3-328c-4434-9eae-0bacc8d40d37'::uuid, g.id, 'gestor_grupo'
FROM public.educational_groups g
WHERE g.slug = 'uniatenas'
ON CONFLICT DO NOTHING;

-- Papel gestor_grupo
INSERT INTO public.user_roles (user_id, role)
VALUES ('562bbcc3-328c-4434-9eae-0bacc8d40d37'::uuid, 'gestor_grupo'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;