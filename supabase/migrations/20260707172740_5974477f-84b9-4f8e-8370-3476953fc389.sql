
-- 1) admin_command_center
CREATE OR REPLACE FUNCTION public.admin_command_center()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'alunos_total', (SELECT count(*) FROM public.users),
      'alunos_ativos_30d', (SELECT count(DISTINCT user_id) FROM public.user_sessions WHERE started_at > now() - interval '30 days'),
      'ies_parceiras', (SELECT count(*) FROM public.ies),
      'simulados_publicados', (SELECT count(*) FROM public.simulados_admin),
      'finalizacoes_7d', (SELECT count(*) FROM public.simulados_finalizados WHERE finalizado_em > now() - interval '7 days')
    ),
    'attention', jsonb_build_object(
      'simulados_encerrando_hoje', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'data_encerramento', data_encerramento) ORDER BY data_encerramento)
        FROM public.simulados_admin
        WHERE status <> 'encerrado'
          AND data_encerramento IS NOT NULL
          AND (data_encerramento AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
      ), '[]'::jsonb),
      'import_batches_falha_7d', COALESCE((
        SELECT jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC)
        FROM (
          SELECT b.id, sa.nome AS simulado_nome, b.source_label, b.failed_count, b.total_rows, b.status, b.created_at
          FROM public.admin_import_batches b
          LEFT JOIN public.simulados_admin sa ON sa.id = b.simulado_id
          WHERE b.created_at > now() - interval '7 days'
            AND (b.failed_count > 0 OR b.status IN ('failed','error','falha','erro'))
          ORDER BY b.created_at DESC
          LIMIT 10
        ) t
      ), '[]'::jsonb),
      'feedbacks_pendentes', jsonb_build_object(
        'total', (SELECT count(*) FROM public.user_feedback WHERE status='received'),
        'by_category', jsonb_build_object(
          'bug', (SELECT count(*) FROM public.user_feedback WHERE status='received' AND category='bug'),
          'suggestion', (SELECT count(*) FROM public.user_feedback WHERE status='received' AND category='suggestion'),
          'feature_request', (SELECT count(*) FROM public.user_feedback WHERE status='received' AND category='feature_request'),
          'praise', (SELECT count(*) FROM public.user_feedback WHERE status='received' AND category='praise')
        )
      ),
      'ies_sem_simulado_ativo', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome) ORDER BY i.nome)
        FROM public.ies i
        WHERE NOT EXISTS (
          SELECT 1 FROM public.simulados_admin sa
          WHERE sa.status <> 'encerrado'
            AND (sa.data_encerramento IS NULL OR sa.data_encerramento > now())
            AND i.id = ANY(sa.ies_ids)
        )
      ), '[]'::jsonb)
    ),
    'audit_recentes', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT al.id, al.created_at, al.action,
               ua.nome AS admin_nome, ut.email AS target_email, al.metadata
        FROM public.admin_audit_log al
        LEFT JOIN public.users ua ON ua.id = al.admin_id
        LEFT JOIN public.users ut ON ut.id = al.target_user_id
        WHERE al.action NOT LIKE 'view_%'
        ORDER BY al.created_at DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_command_center() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_command_center() TO authenticated, service_role;

-- 2) admin_get_audit_log
CREATE OR REPLACE FUNCTION public.admin_get_audit_log(
  p_search text DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit int := LEAST(COALESCE(p_limit, 50), 200);
  v_total int;
  v_rows jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  WITH base AS (
    SELECT al.id, al.created_at, al.action, al.admin_id, al.target_user_id, al.metadata,
           ua.nome AS admin_nome, ua.email AS admin_email,
           ut.nome AS target_nome, ut.email AS target_email
    FROM public.admin_audit_log al
    LEFT JOIN public.users ua ON ua.id = al.admin_id
    LEFT JOIN public.users ut ON ut.id = al.target_user_id
    WHERE (p_action IS NULL OR al.action = p_action)
      AND (p_from IS NULL OR al.created_at >= p_from)
      AND (p_to IS NULL OR al.created_at <= p_to)
      AND (
        p_search IS NULL OR p_search = '' OR
        ua.nome ILIKE '%'||p_search||'%' OR
        ua.email ILIKE '%'||p_search||'%' OR
        ut.nome ILIKE '%'||p_search||'%' OR
        ut.email ILIKE '%'||p_search||'%' OR
        al.action ILIKE '%'||p_search||'%'
      )
  )
  SELECT count(*) INTO v_total FROM base;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT al.id, al.created_at, al.action, al.admin_id,
           ua.nome AS admin_nome, ua.email AS admin_email,
           al.target_user_id, ut.nome AS target_nome, ut.email AS target_email,
           al.metadata
    FROM public.admin_audit_log al
    LEFT JOIN public.users ua ON ua.id = al.admin_id
    LEFT JOIN public.users ut ON ut.id = al.target_user_id
    WHERE (p_action IS NULL OR al.action = p_action)
      AND (p_from IS NULL OR al.created_at >= p_from)
      AND (p_to IS NULL OR al.created_at <= p_to)
      AND (
        p_search IS NULL OR p_search = '' OR
        ua.nome ILIKE '%'||p_search||'%' OR
        ua.email ILIKE '%'||p_search||'%' OR
        ut.nome ILIKE '%'||p_search||'%' OR
        ut.email ILIKE '%'||p_search||'%' OR
        al.action ILIKE '%'||p_search||'%'
      )
    ORDER BY al.created_at DESC
    LIMIT v_limit OFFSET GREATEST(COALESCE(p_offset,0), 0)
  ) t;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_audit_log(text,text,timestamptz,timestamptz,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_audit_log(text,text,timestamptz,timestamptz,int,int) TO authenticated, service_role;

-- 3) admin_log_action (admin OR atendimento)
CREATE OR REPLACE FUNCTION public.admin_log_action(
  p_action text,
  p_target_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'atendimento'::app_role)) THEN
    RAISE EXCEPTION 'admin or atendimento role required';
  END IF;
  IF p_action IS NULL OR length(btrim(p_action)) = 0 THEN
    RAISE EXCEPTION 'p_action is required';
  END IF;
  IF length(p_action) > 100 THEN
    RAISE EXCEPTION 'p_action too long (max 100)';
  END IF;

  INSERT INTO public.admin_audit_log(admin_id, action, target_user_id, metadata)
  VALUES (auth.uid(), p_action, p_target_user_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_log_action(text,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_action(text,uuid,jsonb) TO authenticated, service_role;

-- 4) admin_anular_questao
CREATE OR REPLACE FUNCTION public.admin_anular_questao(
  p_questao_id uuid,
  p_motivo text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_q record;
  v_recount int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT id, simulado_id, numero_questao, anulada
    INTO v_q
    FROM public.questoes_simulado
    WHERE id = p_questao_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'questão não encontrada';
  END IF;
  IF v_q.anulada IS TRUE THEN
    RAISE EXCEPTION 'questão já anulada';
  END IF;

  UPDATE public.questoes_simulado SET anulada = true WHERE id = p_questao_id;

  WITH upd AS (
    UPDATE public.answer_progress
       SET correct = true
     WHERE question_id = p_questao_id
       AND correct IS DISTINCT FROM true
    RETURNING 1
  )
  SELECT count(*) INTO v_recount FROM upd;

  INSERT INTO public.admin_audit_log(admin_id, action, metadata)
  VALUES (auth.uid(), 'anular_questao', jsonb_build_object(
    'questao_id', v_q.id,
    'simulado_id', v_q.simulado_id,
    'numero_questao', v_q.numero_questao,
    'respostas_recontabilizadas', v_recount,
    'motivo', p_motivo
  ));

  RETURN jsonb_build_object(
    'questao_id', v_q.id,
    'numero_questao', v_q.numero_questao,
    'simulado_id', v_q.simulado_id,
    'respostas_recontabilizadas', v_recount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_anular_questao(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_anular_questao(uuid,text) TO authenticated, service_role;

-- 5) admin_liberar_tentativa
CREATE OR REPLACE FUNCTION public.admin_liberar_tentativa(
  p_finalizacao_id uuid,
  p_motivo text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_f record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT id, user_id, simulado_id, tentativa_numero, liberado_novamente
    INTO v_f
    FROM public.simulados_finalizados
    WHERE id = p_finalizacao_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'finalização não encontrada';
  END IF;
  IF v_f.liberado_novamente IS TRUE THEN
    RAISE EXCEPTION 'tentativa já liberada';
  END IF;

  UPDATE public.simulados_finalizados
     SET liberado_novamente = true,
         liberado_em = now(),
         liberado_por = auth.uid()
   WHERE id = p_finalizacao_id;

  INSERT INTO public.admin_audit_log(admin_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'liberar_tentativa', v_f.user_id, jsonb_build_object(
    'simulado_id', v_f.simulado_id,
    'tentativa_numero', v_f.tentativa_numero,
    'motivo', p_motivo
  ));

  RETURN jsonb_build_object(
    'finalizacao_id', v_f.id,
    'user_id', v_f.user_id,
    'simulado_id', v_f.simulado_id,
    'tentativa_numero', v_f.tentativa_numero
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_liberar_tentativa(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_liberar_tentativa(uuid,text) TO authenticated, service_role;

-- 6) admin_set_ies_features
CREATE OR REPLACE FUNCTION public.admin_set_ies_features(
  p_ies_id uuid,
  p_changes jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_ies_nome text;
  v_key text;
  v_val boolean;
  v_applied int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT nome INTO v_ies_nome FROM public.ies WHERE id = p_ies_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'IES não encontrada';
  END IF;

  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' THEN
    RAISE EXCEPTION 'p_changes must be a JSON object';
  END IF;

  FOR v_key, v_val IN SELECT key, (value)::text::boolean FROM jsonb_each_text(p_changes) LOOP
    INSERT INTO public.ies_features(ies_id, feature_key, enabled)
    VALUES (p_ies_id, v_key, v_val)
    ON CONFLICT (ies_id, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();
    v_applied := v_applied + 1;
  END LOOP;

  INSERT INTO public.admin_audit_log(admin_id, action, metadata)
  VALUES (auth.uid(), 'ies_features_update', jsonb_build_object(
    'ies_id', p_ies_id, 'ies_nome', v_ies_nome, 'changes', p_changes
  ));

  RETURN jsonb_build_object('applied', v_applied);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_ies_features(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_ies_features(uuid,jsonb) TO authenticated, service_role;

-- 7) admin_monitor_summary
CREATE OR REPLACE FUNCTION public.admin_monitor_summary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ontem date := v_hoje - 1;
  v_fh int;
  v_fo int;
  v_int int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT count(*) INTO v_fh FROM public.simulados_finalizados
    WHERE (finalizado_em AT TIME ZONE 'America/Sao_Paulo')::date = v_hoje;
  SELECT count(*) INTO v_fo FROM public.simulados_finalizados
    WHERE (finalizado_em AT TIME ZONE 'America/Sao_Paulo')::date = v_ontem;
  SELECT count(*) INTO v_int FROM public.simulados_finalizados
    WHERE finalizado_em > now() - interval '24 hours'
      AND (COALESCE(saidas_de_aba,0) + COALESCE(saidas_de_fullscreen,0)) >= 3;

  RETURN jsonb_build_object(
    'finalizacoes_hoje', v_fh,
    'finalizacoes_ontem', v_fo,
    'integridade_24h', jsonb_build_object('finalizacoes_com_3mais_saidas', v_int),
    'em_prova_agora', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_monitor_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_monitor_summary() TO authenticated, service_role;

-- 8) admin_question_error_rates
CREATE OR REPLACE FUNCTION public.admin_question_error_rates(p_simulado_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.pct_erro DESC), '[]'::jsonb) INTO v
  FROM (
    SELECT q.id AS question_id,
           q.numero_questao,
           q.grande_area,
           q.tema,
           q.anulada,
           count(ap.answer_id)::int AS total_respostas,
           count(*) FILTER (WHERE ap.correct = false)::int AS erros,
           round(100.0 * count(*) FILTER (WHERE ap.correct = false) / NULLIF(count(ap.answer_id), 0), 1) AS pct_erro
      FROM public.questoes_simulado q
      LEFT JOIN public.answer_progress ap
        ON ap.question_id = q.id AND ap.simulado = q.simulado_id
     WHERE q.simulado_id = p_simulado_id
     GROUP BY q.id, q.numero_questao, q.grande_area, q.tema, q.anulada
     HAVING count(ap.answer_id) > 0
     ORDER BY pct_erro DESC
  ) t;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_question_error_rates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_question_error_rates(uuid) TO authenticated, service_role;
