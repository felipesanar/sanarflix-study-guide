CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  cache_key text PRIMARY KEY,
  fn text NOT NULL,
  modo text NOT NULL,
  payload jsonb NOT NULL,
  model text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL
);

GRANT ALL ON public.ai_response_cache TO service_role;

ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ai_response_cache_expires_at_idx ON public.ai_response_cache (expires_at);
CREATE INDEX IF NOT EXISTS ai_response_cache_fn_modo_idx ON public.ai_response_cache (fn, modo);

CREATE OR REPLACE FUNCTION public.ai_cache_cleanup()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  removidos integer;
BEGIN
  DELETE FROM public.ai_response_cache WHERE expires_at < now();
  GET DIAGNOSTICS removidos = ROW_COUNT;
  RETURN removidos;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_cache_cleanup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_cache_cleanup() FROM anon;
GRANT EXECUTE ON FUNCTION public.ai_cache_cleanup() TO service_role;