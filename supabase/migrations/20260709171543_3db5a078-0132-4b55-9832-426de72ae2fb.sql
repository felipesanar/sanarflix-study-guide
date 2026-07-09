DO $$
DECLARE
  admin_id text := 'df61aaf3-8307-441b-ad60-404eb4b7b1b4';
  gestor_id text := '00a8aadc-1477-4be7-9b50-ce266e0a62a0';
  aluno_ok_id text := '66729ba0-321e-445c-8646-55f8658f83b5';
  aluno_no_perf_id text := '5e27c1cf-61d7-4ea4-ba04-99104b4c4800';
  gestor_ies uuid;
  n int;
  msg text;
BEGIN
  SELECT id_ies INTO gestor_ies FROM public.users WHERE id = gestor_id::uuid;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', gestor_id, 'role','authenticated')::text, true);
  BEGIN
    SELECT count(*) INTO n FROM public.get_institutional_simulados(gestor_ies);
    msg := 'OK rows=' || n;
  EXCEPTION WHEN OTHERS THEN msg := 'FAIL ' || SQLSTATE || ' ' || SQLERRM;
  END;
  INSERT INTO public.kv_store(key,value) VALUES ('test_guard_a_gestor', to_jsonb(msg))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', aluno_ok_id, 'role','authenticated')::text, true);
  BEGIN
    SELECT count(*) INTO n FROM public.get_user_simulados();
    msg := 'OK rows=' || n;
  EXCEPTION WHEN OTHERS THEN msg := 'FAIL ' || SQLSTATE || ' ' || SQLERRM;
  END;
  INSERT INTO public.kv_store(key,value) VALUES ('test_guard_b_aluno_ok', to_jsonb(msg))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', aluno_no_perf_id, 'role','authenticated')::text, true);
  BEGIN
    PERFORM public.get_user_performance_aggregates(NULL);
    msg := 'UNEXPECTED_OK';
  EXCEPTION WHEN OTHERS THEN msg := 'blocked ' || SQLSTATE || ' ' || SQLERRM;
  END;
  INSERT INTO public.kv_store(key,value) VALUES ('test_guard_c_aluno_block', to_jsonb(msg))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role','authenticated')::text, true);
  BEGIN
    PERFORM public.get_institutional_performance(NULL, gestor_ies);
    msg := 'OK';
  EXCEPTION WHEN OTHERS THEN msg := 'FAIL ' || SQLSTATE || ' ' || SQLERRM;
  END;
  INSERT INTO public.kv_store(key,value) VALUES ('test_guard_e_admin', to_jsonb(msg))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  PERFORM set_config('request.jwt.claims', NULL, true);
END $$;