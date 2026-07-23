
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS telefone_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_my_phone(p_telefone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized text;
  v_len int;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Normaliza: remove tudo que não é dígito.
  v_normalized := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_len := length(v_normalized);

  IF v_len NOT IN (10, 11) THEN
    RAISE EXCEPTION 'Telefone inválido: informe DDD + número (10 ou 11 dígitos).';
  END IF;

  UPDATE public.users
     SET telefone = v_normalized,
         telefone_updated_at = now()
   WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_phone(text) TO authenticated;
