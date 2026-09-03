DO $mig$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_gestor_visao_geral'
    AND pg_get_function_identity_arguments(p.oid) = 'p_ies_id uuid, p_semestre text';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'get_gestor_visao_geral(uuid, text) nao encontrada';
  END IF;

  IF position('SELECT * FROM metricas WHERE n_resp > 0 OR n_tri > 0' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CTE realizados nao encontrada no corpo atual (ja alterada?)';
  END IF;

  v_new := replace(
    v_def,
    'SELECT * FROM metricas WHERE n_resp > 0 OR n_tri > 0',
    -- Somente simulados com nota TRI calculada no recorte: sem isso o ponto
    -- ATUAL da regua caia num simulado sem TRI (Conceito e Proficientes em
    -- branco) enquanto o % de acerto falava desse mesmo simulado.
    'SELECT * FROM metricas WHERE n_tri > 0'
  );

  EXECUTE v_new;
END
$mig$;