-- Caderno de Erros — adição em lote a partir da triagem pós-prova (Fase 1)
-- Ver docs/caderno-de-erros-port-plan.md §1.5.

CREATE OR REPLACE FUNCTION public.add_to_notebook_bulk_guarded(p_entries jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item       jsonb;
  v_uid        uuid := auth.uid();
  v_question   uuid;
  v_reason     text;
  v_ease       float8;
  v_added      int := 0;
  v_skipped    int := 0;
  v_entry_ids  uuid[] := '{}';
  v_existing   uuid;
  v_new_id     uuid;
  v_count      int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF jsonb_typeof(p_entries) <> 'array' THEN RAISE EXCEPTION 'invalid_payload'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_count := v_count + 1;
    IF v_count > 100 THEN EXIT; END IF;  -- limite de 100 por chamada

    v_question := NULLIF(v_item->>'question_id', '')::uuid;
    v_reason   := COALESCE(v_item->>'reason', 'did_not_know');

    -- ease inicial por causa do erro
    v_ease := CASE v_reason
      WHEN 'did_not_know'                 THEN 2.1
      WHEN 'answered_without_confidence'  THEN 2.1
      WHEN 'did_not_understand_statement' THEN 2.8
      ELSE 2.5
    END;

    -- dedup por (user_id, question_id) entre itens não deletados
    v_existing := NULL;
    IF v_question IS NOT NULL THEN
      SELECT id INTO v_existing
        FROM error_notebook_entries
       WHERE user_id = v_uid AND question_id = v_question AND deleted_at IS NULL
       LIMIT 1;
    END IF;

    IF v_existing IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      v_entry_ids := array_append(v_entry_ids, v_existing);
      CONTINUE;
    END IF;

    -- ressuscita soft-delete da mesma questão, se houver
    IF v_question IS NOT NULL THEN
      UPDATE error_notebook_entries
         SET deleted_at = NULL, updated_at = now()
       WHERE user_id = v_uid AND question_id = v_question AND deleted_at IS NOT NULL
       RETURNING id INTO v_existing;
      IF v_existing IS NOT NULL THEN
        v_skipped := v_skipped + 1;
        v_entry_ids := array_append(v_entry_ids, v_existing);
        CONTINUE;
      END IF;
    END IF;

    INSERT INTO error_notebook_entries (
      user_id, question_id, simulado_id, simulado_nome,
      grande_area, especialidade, tema, reason, learning_text, was_correct,
      source, confidence_at_answer, srs_ease, srs_interval, srs_reps, srs_lapses, srs_due_at
    ) VALUES (
      v_uid,
      v_question,
      NULLIF(v_item->>'simulado_id', '')::uuid,
      v_item->>'simulado_nome',
      v_item->>'grande_area',
      v_item->>'especialidade',
      v_item->>'tema',
      v_reason,
      LEFT(COALESCE(v_item->>'learning_text', ''), 280),
      COALESCE((v_item->>'was_correct')::boolean, false),
      'simulation_correction',
      NULLIF(v_item->>'confidence_at_answer', ''),
      v_ease, 1, 0, 0, now()
    )
    RETURNING id INTO v_new_id;

    v_added := v_added + 1;
    v_entry_ids := array_append(v_entry_ids, v_new_id);
  END LOOP;

  RETURN jsonb_build_object('added', v_added, 'skipped', v_skipped, 'entry_ids', to_jsonb(v_entry_ids));
END $$;
GRANT EXECUTE ON FUNCTION public.add_to_notebook_bulk_guarded(jsonb) TO authenticated;
