-- Fase 0b · Task 11 — leitura do contrato de simulados para a tela de admin (spec §6.3).
-- VOLATILE (default) por consistência com admin_command_center/admin_get_audit_log
-- (20260707172740), que também não declaram STABLE.
CREATE OR REPLACE FUNCTION public.admin_get_ies_contratos(
  p_ies_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_ies record;
  v_contratos jsonb;
  v_simulados jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT id, nome INTO v_ies FROM public.ies WHERE id = p_ies_id;
  IF v_ies.id IS NULL THEN
    RAISE EXCEPTION 'IES % não encontrada', p_ies_id;
  END IF;

  SELECT COALESCE(jsonb_agg(c ORDER BY c->>'nome_contrato'), '[]'::jsonb)
    INTO v_contratos
  FROM (
    SELECT jsonb_build_object(
             'id', ct.id,
             'nome_contrato', ct.nome_contrato,
             'simulados_contratados', ct.simulados_contratados,
             'vigencia_inicio', ct.vigencia_inicio,
             'vigencia_fim', ct.vigencia_fim,
             'created_at', ct.created_at,
             'slots', COALESCE((
               SELECT jsonb_agg(
                        jsonb_build_object(
                          'id', sp.id,
                          'ordem', sp.ordem,
                          'nome_previsto', sp.nome_previsto,
                          'simulado_id', sp.simulado_id,
                          'simulado', CASE WHEN sa.id IS NULL THEN NULL ELSE jsonb_build_object(
                            'id', sa.id,
                            'nome', sa.nome,
                            'status', sa.status,
                            'modalidade', sa.modalidade,
                            'data_realizacao', sa.data_realizacao,
                            'data_liberacao', sa.data_liberacao,
                            'data_encerramento', sa.data_encerramento,
                            'data_agendada_original', sa.data_agendada_original
                          ) END
                        ) ORDER BY sp.ordem
                      )
               FROM public.ies_simulado_previsto sp
               LEFT JOIN public.simulados_admin sa ON sa.id = sp.simulado_id
               WHERE sp.contrato_id = ct.id
             ), '[]'::jsonb)
           ) AS c
    FROM public.ies_contrato_simulados ct
    WHERE ct.ies_id = p_ies_id
  ) t;

  -- Simulados da IES, para o select de vínculo de slot na tela de admin.
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'id', sa.id,
             'nome', sa.nome,
             'status', sa.status,
             'modalidade', sa.modalidade,
             'data_realizacao', sa.data_realizacao,
             'data_liberacao', sa.data_liberacao,
             'data_encerramento', sa.data_encerramento,
             'data_agendada_original', sa.data_agendada_original
           ) ORDER BY COALESCE(sa.data_realizacao, sa.data_liberacao, sa.created_at) DESC NULLS LAST
         ), '[]'::jsonb)
    INTO v_simulados
  FROM public.simulados_admin sa
  WHERE p_ies_id = ANY(sa.ies_ids);

  RETURN jsonb_build_object(
    'ies', jsonb_build_object('id', v_ies.id, 'nome', v_ies.nome),
    'contratos', v_contratos,
    'simulados_disponiveis', v_simulados
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_ies_contratos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_ies_contratos(uuid) TO authenticated, service_role;
