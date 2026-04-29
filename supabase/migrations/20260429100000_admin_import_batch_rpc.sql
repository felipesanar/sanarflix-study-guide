-- =========================================================================
-- Batch RPC: importa N respostas em UMA chamada PG (elimina N+1 round-trip
-- entre edge function e Postgres). Mantém a mesma semântica de
-- admin_import_one_response, mas em loop interno com savepoint por linha.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.admin_import_responses_batch(
  p_batch_id uuid,
  p_simulado_id uuid,
  p_rows jsonb,            -- [{user_id, answers:[{question_id,resposta,correct}], tempo_segundos, saidas_aba, finalizado_em}]
  p_conflict_mode text     -- 'skip' | 'replace'
)
RETURNS jsonb              -- {results:[...], summary:{imported,skipped,replaced,failed,already_in_batch}}
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_user_id uuid;
  v_answers jsonb;
  v_tempo int;
  v_saidas int;
  v_finalizado timestamptz;
  v_existing record;
  v_proxima_tentativa int;
  v_finalizacao_id uuid;
  v_started_at timestamptz;
  v_replaced boolean;
  v_results jsonb := '[]'::jsonb;
  v_imported int := 0;
  v_skipped int := 0;
  v_replaced_count int := 0;
  v_failed int := 0;
  v_already_in_batch int := 0;
  v_err text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_conflict_mode NOT IN ('skip','replace') THEN
    RAISE EXCEPTION 'invalid conflict_mode: %', p_conflict_mode;
  END IF;

  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a jsonb array';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_user_id := NULL;
    v_replaced := false;
    v_proxima_tentativa := 1;
    v_finalizacao_id := NULL;

    BEGIN
      v_user_id := (v_row->>'user_id')::uuid;
      v_answers := v_row->'answers';
      v_tempo := COALESCE((v_row->>'tempo_segundos')::int, 0);
      v_saidas := COALESCE((v_row->>'saidas_aba')::int, 0);
      v_finalizado := COALESCE((v_row->>'finalizado_em')::timestamptz, now());

      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';
      END IF;

      -- Idempotência: já processado neste lote?
      IF EXISTS (
        SELECT 1 FROM public.admin_import_records
        WHERE batch_id = p_batch_id AND user_id = v_user_id AND simulado_id = p_simulado_id
      ) THEN
        v_already_in_batch := v_already_in_batch + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'user_id', v_user_id, 'status', 'already_in_batch'
        ));
        CONTINUE;
      END IF;

      -- Lock advisory pra evitar race com finalização real do aluno
      PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text || ':' || p_simulado_id::text));

      SELECT id, tentativa_numero
      INTO v_existing
      FROM public.simulados_finalizados
      WHERE user_id = v_user_id AND simulado_id = p_simulado_id
      ORDER BY tentativa_numero DESC
      LIMIT 1;

      IF FOUND THEN
        IF p_conflict_mode = 'skip' THEN
          INSERT INTO public.admin_import_records (batch_id, user_id, simulado_id, status, reason)
          VALUES (p_batch_id, v_user_id, p_simulado_id, 'skipped', 'Aluno já possui finalização e modo é "skip"');
          v_skipped := v_skipped + 1;
          v_results := v_results || jsonb_build_array(jsonb_build_object(
            'user_id', v_user_id, 'status', 'skipped', 'reason', 'already_finalized'
          ));
          CONTINUE;
        END IF;

        v_replaced := true;
        v_proxima_tentativa := COALESCE(v_existing.tentativa_numero, 1) + 1;

        INSERT INTO public.answer_progress_historico (
          answer_id, user_id, simulado, question_id, resposta_usuario, correct,
          "respondida?", finalizacao_original_id, substituida_em
        )
        SELECT
          ap.answer_id::text, ap.user_id, ap.simulado, ap.question_id,
          ap.resposta_usuario, ap.correct, ap."respondida?",
          v_existing.id, now()
        FROM public.answer_progress ap
        WHERE ap.user_id = v_user_id AND ap.simulado = p_simulado_id;

        DELETE FROM public.answer_progress
        WHERE user_id = v_user_id AND simulado = p_simulado_id;

        UPDATE public.simulados_finalizados
        SET liberado_novamente = false
        WHERE id = v_existing.id;
      END IF;

      v_started_at := v_finalizado - make_interval(secs => v_tempo);

      INSERT INTO public.simulados_iniciados (user_id, simulado_id, started_at)
      VALUES (v_user_id, p_simulado_id, v_started_at);

      INSERT INTO public.answer_progress (
        answer_id, user_id, simulado, question_id, resposta_usuario, correct, "respondida?"
      )
      SELECT
        gen_random_uuid(),
        v_user_id,
        p_simulado_id,
        (a->>'question_id')::uuid,
        NULLIF(a->>'resposta', ''),
        (a->>'correct')::boolean,
        (a->>'resposta') IS NOT NULL AND (a->>'resposta') <> ''
      FROM jsonb_array_elements(v_answers) AS a;

      INSERT INTO public.simulados_finalizados (
        user_id, simulado_id, tentativa_numero, tempo_total_segundos,
        saidas_de_aba, saidas_de_fullscreen, finalizado_em, liberado_novamente
      )
      VALUES (
        v_user_id, p_simulado_id, v_proxima_tentativa, v_tempo,
        v_saidas, 0, v_finalizado, false
      )
      RETURNING id INTO v_finalizacao_id;

      INSERT INTO public.admin_import_records (
        batch_id, user_id, simulado_id, finalizacao_id, status, reason
      )
      VALUES (
        p_batch_id, v_user_id, p_simulado_id, v_finalizacao_id,
        CASE WHEN v_replaced THEN 'replaced' ELSE 'imported' END, NULL
      );

      IF v_replaced THEN
        v_replaced_count := v_replaced_count + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'user_id', v_user_id, 'status', 'replaced', 'finalizacao_id', v_finalizacao_id,
          'tentativa', v_proxima_tentativa
        ));
      ELSE
        v_imported := v_imported + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'user_id', v_user_id, 'status', 'imported', 'finalizacao_id', v_finalizacao_id
        ));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'user_id', v_user_id, 'status', 'failed', 'reason', LEFT(v_err, 500)
      ));
      -- Insert do failure roda em sub-transação separada (savepoint do BEGIN/EXCEPTION
      -- foi rolledback, retornamos pra transação parent — o INSERT abaixo é uma nova
      -- operação na transação principal).
      IF v_user_id IS NOT NULL THEN
        BEGIN
          INSERT INTO public.admin_import_records (batch_id, user_id, simulado_id, status, reason)
          VALUES (p_batch_id, v_user_id, p_simulado_id, 'failed', LEFT(v_err, 500))
          ON CONFLICT (batch_id, user_id, simulado_id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
          -- ignora se nem isso conseguir gravar
          NULL;
        END;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'results', v_results,
    'summary', jsonb_build_object(
      'imported', v_imported,
      'skipped', v_skipped,
      'replaced', v_replaced_count,
      'failed', v_failed,
      'already_in_batch', v_already_in_batch
    )
  );
END;
$$;

-- =========================================================================
-- RPC pra listar registros de um batch já com email do usuário (pra UI de
-- histórico baixar relatório sem expor users diretamente).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_get_batch_records(p_batch_id uuid)
RETURNS TABLE (
  email text,
  status text,
  reason text,
  finalizacao_id uuid,
  user_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(u.email, '?')::text AS email,
    r.status::text,
    r.reason::text,
    r.finalizacao_id,
    r.user_id,
    r.created_at
  FROM public.admin_import_records r
  LEFT JOIN public.users u ON u.id = r.user_id
  WHERE r.batch_id = p_batch_id
  ORDER BY r.created_at ASC;
END;
$$;

-- =========================================================================
-- RPC pra listar batches recentes com nome do simulado e admin que criou.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_list_import_batches(p_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  simulado_id uuid,
  simulado_nome text,
  source_label text,
  conflict_mode text,
  total_rows int,
  imported_count int,
  skipped_count int,
  replaced_count int,
  failed_count int,
  status text,
  created_by uuid,
  created_by_email text,
  created_at timestamptz,
  finished_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.simulado_id,
    COALESCE(s.nome, '?')::text AS simulado_nome,
    b.source_label,
    b.conflict_mode,
    b.total_rows,
    b.imported_count,
    b.skipped_count,
    b.replaced_count,
    b.failed_count,
    b.status,
    b.created_by,
    COALESCE(u.email, '?')::text AS created_by_email,
    b.created_at,
    b.finished_at
  FROM public.admin_import_batches b
  LEFT JOIN public.simulados_admin s ON s.id = b.simulado_id
  LEFT JOIN public.users u ON u.id = b.created_by
  ORDER BY b.created_at DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_import_responses_batch(uuid, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_batch_records(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_import_batches(int) TO authenticated;
