DO $$
declare v_gestor jsonb; v_aluno jsonb; u1 uuid; u2 uuid;
begin
  select u.id into u1 from public.users u
    join public.user_roles r on r.user_id=u.id
    where r.role='gestor' and u.id_ies is not null limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u1)::text, true);
  v_gestor := public.get_effective_features();

  select u.id into u2 from public.users u
    where not exists (select 1 from public.user_roles r where r.user_id=u.id)
      and u.id_ies is not null limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u2)::text, true);
  v_aluno := public.get_effective_features();

  insert into public.kv_store(key, value) values
    ('__test_gef_gestor', jsonb_build_object('uid', u1, 'features', v_gestor)),
    ('__test_gef_aluno',  jsonb_build_object('uid', u2, 'features', v_aluno))
  on conflict (key) do update set value=excluded.value, updated_at=now();
end $$;