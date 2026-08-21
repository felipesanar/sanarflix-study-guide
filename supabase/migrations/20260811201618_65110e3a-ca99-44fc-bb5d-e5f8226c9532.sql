insert into public.feature_catalog (key, experience, label, description, sort_order, is_master, active)
values
  ('gestao.enabled',  'gestao', 'Portal do Gestor',    'Master: liga/desliga o portal do gestor inteiro para a IES', 100, true,  true),
  ('gestao.exportar', 'gestao', 'Exportar Relatórios', 'Exportação de relatórios institucionais',                    160, false, true),
  ('gestao.ia',       'gestao', 'Assistente IA',       'Assistente de IA do gestor (protótipo)',                     170, false, true)
on conflict (key) do update set
  experience  = excluded.experience,
  label       = excluded.label,
  description = excluded.description,
  sort_order  = excluded.sort_order,
  is_master   = excluded.is_master,
  active      = excluded.active;

insert into public.ies_features (ies_id, feature_key, enabled)
select i.id, k.feature_key, true
from public.ies i
cross join (values
  ('gestao.enabled'), ('gestao.exportar'), ('gestao.ia'),
  ('gestao.visao_institucional'), ('gestao.diagnostico_curricular'),
  ('gestao.alunos'), ('gestao.insights_pedagogicos'), ('gestao.inteligencia_decisoria')
) as k(feature_key)
on conflict (ies_id, feature_key) do update set
  enabled    = true,
  updated_at = now();

insert into public.feature_catalog (key, experience, label, description, sort_order, is_master, active)
values (
  'gestao.portal_v2',
  'gestao',
  'Portal do Gestor v2 (rollout)',
  'Toggle de migração faseada por IES: ligado = portal novo; desligado = console antigo. Ativado manualmente por IES após vídeo tutorial + OK da faculdade.',
  180,
  false,
  true
)
on conflict (key) do update set
  experience  = excluded.experience,
  label       = excluded.label,
  description = excluded.description,
  sort_order  = excluded.sort_order,
  is_master   = excluded.is_master,
  active      = excluded.active;

CREATE OR REPLACE FUNCTION public.get_user_ies_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_ies_id UUID;
BEGIN
  SELECT id_ies INTO user_ies_id
  FROM public.users
  WHERE id = auth.uid();

  IF user_ies_id IS NULL THEN
    SELECT (public.get_accessible_ies(auth.uid()))[1] INTO user_ies_id;
  END IF;

  RETURN user_ies_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_gestor_portal_versao()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_ies_list uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(v_uid, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  IF public.has_role(v_uid, 'gestor_grupo'::public.app_role) THEN
    v_ies_list := COALESCE(public.get_accessible_ies(v_uid), ARRAY[]::uuid[]);
  ELSIF public.has_role(v_uid, 'gestor'::public.app_role) THEN
    SELECT COALESCE(array_agg(u.id_ies), ARRAY[]::uuid[]) INTO v_ies_list
    FROM public.users u
    WHERE u.id = v_uid AND u.id_ies IS NOT NULL;
  ELSE
    RETURN false;
  END IF;

  IF v_ies_list IS NULL OR array_length(v_ies_list, 1) IS NULL THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM unnest(v_ies_list) AS ies(id)
    WHERE COALESCE(
      (SELECT f.enabled FROM public.ies_features f
       WHERE f.ies_id = ies.id AND f.feature_key = 'gestao.portal_v2'),
      false
    ) = false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_portal_versao() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_portal_versao() TO authenticated;