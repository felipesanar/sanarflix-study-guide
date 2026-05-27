
-- 1) Tabela KV
CREATE TABLE IF NOT EXISTS public.kv_store (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kv_store_expires_at ON public.kv_store(expires_at);

-- 2) Grants: apenas service_role (edge functions). Sem anon/authenticated.
GRANT ALL ON public.kv_store TO service_role;

-- 3) RLS habilitado, sem policies (service_role bypassa).
ALTER TABLE public.kv_store ENABLE ROW LEVEL SECURITY;

-- 4) Função atômica de incremento com janela TTL
CREATE OR REPLACE FUNCTION public.kv_incr(
  p_key          text,
  p_ttl_seconds  int,
  p_limit        int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now     timestamptz := now();
  v_count   int;
  v_expires timestamptz;
BEGIN
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
$$;

-- 5) Cleanup helper
CREATE OR REPLACE FUNCTION public.kv_cleanup() RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM public.kv_store WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 6) Execução restrita ao service_role
REVOKE ALL ON FUNCTION public.kv_incr(text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kv_cleanup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kv_incr(text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.kv_cleanup() TO service_role;
