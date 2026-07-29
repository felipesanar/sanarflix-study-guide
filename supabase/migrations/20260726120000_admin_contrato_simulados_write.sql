-- Fase 0b · Task 9 — RPCs de escrita do contrato de simulados por IES (spec §6.2/§6.3).
-- Padrão idêntico ao de 20260707172740 (admin_set_ies_features & cia):
-- SECURITY DEFINER + search_path=public,pg_temp + guard has_role(admin) + audit + REVOKE/GRANT.

-- 1) admin_upsert_ies_contrato — cria ou atualiza o contrato de uma IES.
--    Idempotente pela chave natural (ies_id, nome_contrato): chamar duas vezes
--    com o mesmo nome ATUALIZA, não duplica.
CREATE OR REPLACE FUNCTION public.admin_upsert_ies_contrato(
  p_ies_id uuid,
  p_nome text,
  p_simulados_contratados int,
  p_vigencia_inicio date,
  p_vigencia_fim date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_nome text := btrim(COALESCE(p_nome, ''));
  v_ies_nome text;
  v_id uuid;
  v_existia boolean;
  v_slots_atuais int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT nome INTO v_ies_nome FROM public.ies WHERE id = p_ies_id;
  IF v_ies_nome IS NULL THEN
    RAISE EXCEPTION 'IES % não encontrada', p_ies_id;
  END IF;

  IF length(v_nome) = 0 THEN
    RAISE EXCEPTION 'p_nome é obrigatório';
  END IF;
  IF length(v_nome) > 120 THEN
    RAISE EXCEPTION 'p_nome muito longo (máx 120)';
  END IF;
  IF p_simulados_contratados IS NULL OR p_simulados_contratados <= 0 THEN
    RAISE EXCEPTION 'p_simulados_contratados deve ser maior que zero';
  END IF;
  IF p_simulados_contratados > 60 THEN
    RAISE EXCEPTION 'p_simulados_contratados fora da faixa esperada (máx 60)';
  END IF;
  IF p_vigencia_inicio IS NULL OR p_vigencia_fim IS NULL THEN
    RAISE EXCEPTION 'vigência (início e fim) é obrigatória';
  END IF;
  IF p_vigencia_fim < p_vigencia_inicio THEN
    RAISE EXCEPTION 'vigencia_fim (%) é anterior a vigencia_inicio (%)', p_vigencia_fim, p_vigencia_inicio;
  END IF;

  SELECT id INTO v_id
  FROM public.ies_contrato_simulados
  WHERE ies_id = p_ies_id AND nome_contrato = v_nome;
  v_existia := v_id IS NOT NULL;

  -- Reduzir o contratado abaixo do número de slots JÁ criados deixaria slots
  -- órfãos (o KPI "3 de 7" ficaria com denominador menor que o numerador).
  IF v_existia THEN
    SELECT count(*) INTO v_slots_atuais
    FROM public.ies_simulado_previsto
    WHERE contrato_id = v_id;

    IF p_simulados_contratados < v_slots_atuais THEN
      RAISE EXCEPTION
        'contrato já tem % slot(s); remova slots antes de reduzir para %',
        v_slots_atuais, p_simulados_contratados;
    END IF;
  END IF;

  INSERT INTO public.ies_contrato_simulados
    (ies_id, nome_contrato, simulados_contratados, vigencia_inicio, vigencia_fim, created_by)
  VALUES
    (p_ies_id, v_nome, p_simulados_contratados, p_vigencia_inicio, p_vigencia_fim, auth.uid())
  ON CONFLICT (ies_id, nome_contrato) DO UPDATE
    SET simulados_contratados = EXCLUDED.simulados_contratados,
        vigencia_inicio       = EXCLUDED.vigencia_inicio,
        vigencia_fim          = EXCLUDED.vigencia_fim
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_log(admin_id, action, metadata)
  VALUES (
    auth.uid(),
    CASE WHEN v_existia THEN 'ies_contrato_update' ELSE 'ies_contrato_create' END,
    jsonb_build_object(
      'contrato_id', v_id,
      'ies_id', p_ies_id,
      'ies_nome', v_ies_nome,
      'nome_contrato', v_nome,
      'simulados_contratados', p_simulados_contratados,
      'vigencia_inicio', p_vigencia_inicio,
      'vigencia_fim', p_vigencia_fim,
      'slots_atuais', v_slots_atuais
    )
  );

  RETURN jsonb_build_object(
    'contrato_id', v_id,
    'criado', NOT v_existia,
    'ies_id', p_ies_id,
    'nome_contrato', v_nome,
    'simulados_contratados', p_simulados_contratados,
    'vigencia_inicio', p_vigencia_inicio,
    'vigencia_fim', p_vigencia_fim
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_ies_contrato(uuid,text,int,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_ies_contrato(uuid,text,int,date,date) TO authenticated, service_role;

-- 2) admin_delete_ies_contrato — apaga o contrato (cascade nos slots).
--    Recusa se algum slot já aponta para um simulado real: apagar levaria embora
--    o vínculo do cronograma sem o operador perceber.
CREATE OR REPLACE FUNCTION public.admin_delete_ies_contrato(
  p_contrato_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_contrato record;
  v_slots_total int;
  v_slots_vinculados int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT id, ies_id, nome_contrato, simulados_contratados
    INTO v_contrato
  FROM public.ies_contrato_simulados
  WHERE id = p_contrato_id;

  IF v_contrato.id IS NULL THEN
    RAISE EXCEPTION 'contrato % não encontrado', p_contrato_id;
  END IF;

  SELECT count(*), count(simulado_id)
    INTO v_slots_total, v_slots_vinculados
  FROM public.ies_simulado_previsto
  WHERE contrato_id = p_contrato_id;

  IF v_slots_vinculados > 0 THEN
    RAISE EXCEPTION
      'contrato tem % slot(s) vinculados a simulado; desvincule antes de excluir',
      v_slots_vinculados;
  END IF;

  DELETE FROM public.ies_contrato_simulados WHERE id = p_contrato_id;

  INSERT INTO public.admin_audit_log(admin_id, action, metadata)
  VALUES (
    auth.uid(),
    'ies_contrato_delete',
    jsonb_build_object(
      'contrato_id', p_contrato_id,
      'ies_id', v_contrato.ies_id,
      'nome_contrato', v_contrato.nome_contrato,
      'simulados_contratados', v_contrato.simulados_contratados,
      'slots_removidos', v_slots_total
    )
  );

  RETURN jsonb_build_object(
    'contrato_id', p_contrato_id,
    'slots_removidos', v_slots_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_ies_contrato(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_ies_contrato(uuid) TO authenticated, service_role;
