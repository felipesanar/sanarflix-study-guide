CREATE OR REPLACE FUNCTION public.admin_set_simulado_type(p_simulado_id uuid, p_type text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  IF p_type NOT IN ('simulado_enamed','trilha') THEN
    RAISE EXCEPTION 'Tipo inválido: %', p_type;
  END IF;
  SELECT type INTO v_old FROM simulados_admin WHERE id = p_simulado_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Simulado não encontrado'; END IF;
  IF v_old IS DISTINCT FROM p_type THEN
    UPDATE simulados_admin SET type = p_type, updated_at = now() WHERE id = p_simulado_id;
    INSERT INTO admin_audit_log(admin_id, action, metadata)
    VALUES (auth.uid(), 'editar_simulado_tipo', jsonb_build_object('simulado_id', p_simulado_id, 'antes', v_old, 'depois', p_type));
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_simulado_type(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_simulado_type(uuid, text) TO authenticated;