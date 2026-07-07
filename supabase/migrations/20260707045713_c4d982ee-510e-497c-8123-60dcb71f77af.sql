
-- PART 1: get_access RPC
CREATE OR REPLACE FUNCTION public.get_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_roles text[] := '{}';
  v_experiences text[] := ARRAY['aluno'];
  v_caps text[] := '{}';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('roles', '[]'::jsonb, 'experiences', '[]'::jsonb, 'capabilities', '[]'::jsonb);
  END IF;

  SELECT COALESCE(array_agg(role::text), '{}') INTO v_roles
  FROM public.user_roles WHERE user_id = v_uid;

  IF 'admin' = ANY(v_roles) THEN
    v_experiences := v_experiences || ARRAY['admin','gestao'];
    v_caps := v_caps || ARRAY['users.manage','avisos.manage','ies.manage','guia.manage','sanarclass.manage','simulados.manage','feedbacks.moderate','analytics.view','impersonate','admin.tools','institutional.view','alunos.view'];
  END IF;

  IF 'gestor' = ANY(v_roles) OR 'gestor_grupo' = ANY(v_roles) THEN
    v_experiences := v_experiences || ARRAY['gestao'];
    v_caps := v_caps || ARRAY['institutional.view','alunos.view'];
  END IF;

  IF 'atendimento' = ANY(v_roles) THEN
    v_experiences := v_experiences || ARRAY['atendimento'];
    v_caps := v_caps || ARRAY['users.support','feedbacks.support'];
  END IF;

  RETURN jsonb_build_object(
    'roles', to_jsonb(v_roles),
    'experiences', (SELECT to_jsonb(array_agg(DISTINCT e)) FROM unnest(v_experiences) e),
    'capabilities', COALESCE((SELECT to_jsonb(array_agg(DISTINCT c)) FROM unnest(v_caps) c), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_access() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_access() TO service_role;

-- PART 2: service_role guards on maintenance functions
CREATE OR REPLACE FUNCTION public.kv_cleanup()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_deleted int;
BEGIN
  IF COALESCE(auth.role(), 'service_role') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role required';
  END IF;
  DELETE FROM public.kv_store WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

CREATE OR REPLACE FUNCTION public.kv_incr(p_key text, p_ttl_seconds integer, p_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_now     timestamptz := now();
  v_count   int;
  v_expires timestamptz;
BEGIN
  IF COALESCE(auth.role(), 'service_role') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role required';
  END IF;
  INSERT INTO public.kv_store(key, value, expires_at)
  VALUES (
    p_key,
    jsonb_build_object('count', 1),
    v_now + make_interval(secs => p_ttl_seconds)
  )
  ON CONFLICT (key) DO UPDATE
    SET value = CASE
          WHEN public.kv_store.expires_at IS NULL OR public.kv_store.expires_at < v_now
            THEN jsonb_build_object('count', 1)
          ELSE jsonb_set(
            public.kv_store.value,
            '{count}',
            to_jsonb(COALESCE((public.kv_store.value->>'count')::int, 0) + 1)
          )
        END,
        expires_at = CASE
          WHEN public.kv_store.expires_at IS NULL OR public.kv_store.expires_at < v_now
            THEN v_now + make_interval(secs => p_ttl_seconds)
          ELSE public.kv_store.expires_at
        END,
        updated_at = v_now
  RETURNING (value->>'count')::int, expires_at
  INTO v_count, v_expires;

  RETURN jsonb_build_object(
    'count',     v_count,
    'remaining', GREATEST(0, p_limit - v_count),
    'reset_in',  GREATEST(0, EXTRACT(EPOCH FROM (v_expires - v_now))::int),
    'allowed',   v_count <= p_limit
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_mv_evolucao_institucional_tri()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(auth.role(), 'service_role') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role required';
  END IF;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_evolucao_institucional_tri;
END;
$function$;
