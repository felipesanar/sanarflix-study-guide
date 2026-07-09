CREATE OR REPLACE FUNCTION public.get_effective_features()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
declare
  v_uid uuid := auth.uid();
  v_bypass boolean;
  v_ies uuid;
  v_ies_list uuid[];
  v_features jsonb := '{}'::jsonb;
  v_gestao_master boolean := false;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  v_bypass := public.has_role(v_uid,'admin'::app_role) or public.has_role(v_uid,'atendimento'::app_role);
  select id_ies into v_ies from public.users where id = v_uid;

  if v_bypass then
    select coalesce(jsonb_object_agg(key,true),'{}'::jsonb) into v_features from public.feature_catalog where active;
    return jsonb_build_object('bypass',true,'ies_id',v_ies,'features',v_features);
  end if;

  -- Conjunto de IES efetivas: própria (se houver) OU acessíveis via grupos (fallback gestor_grupo puro)
  if v_ies is not null then
    v_ies_list := ARRAY[v_ies];
  else
    v_ies_list := public.get_accessible_ies(v_uid);
  end if;

  if v_ies_list is null or array_length(v_ies_list,1) is null then
    -- nenhuma IES acessível: default-closed
    select coalesce(jsonb_object_agg(key,false),'{}'::jsonb) into v_features from public.feature_catalog where active;
    return jsonb_build_object('bypass',false,'ies_id',v_ies,'features',v_features);
  end if;

  -- master gestao.enabled = bool_or sobre as IES efetivas
  select coalesce(bool_or(f.enabled), false)
    into v_gestao_master
  from public.ies_features f
  where f.feature_key = 'gestao.enabled'
    and f.ies_id = ANY(v_ies_list);

  -- efetivo por chave = bool_or(enabled), zerando gestao.* quando master é false
  select coalesce(
    jsonb_object_agg(
      c.key,
      case
        when c.key like 'gestao.%' and c.key <> 'gestao.enabled' and not v_gestao_master then false
        else coalesce(bool_or(f.enabled), false)
      end
    ),
    '{}'::jsonb
  )
  into v_features
  from public.feature_catalog c
  left join public.ies_features f
    on f.feature_key = c.key
   and f.ies_id = ANY(v_ies_list)
  where c.active
  group by ();

  return jsonb_build_object('bypass',false,'ies_id',v_ies,'features',coalesce(v_features,'{}'::jsonb));
end;
$fn$;

REVOKE ALL ON FUNCTION public.get_effective_features() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_features() TO authenticated;