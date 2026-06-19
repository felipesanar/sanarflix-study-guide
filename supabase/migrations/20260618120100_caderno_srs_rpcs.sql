-- Caderno de Erros — SRS RPCs (Fase 1)
-- Espelho em PL/pgSQL de src/lib/srs.ts. Fonte da verdade em runtime.
-- Ver docs/caderno-de-erros-port-sql.md.

-- ---------------------------------------------------------------------------
-- Log de revisão (único caminho de INSERT em review_attempts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_review_attempt_guarded(
  p_entry_id    uuid,
  p_was_correct boolean,
  p_confidence  text,
  p_self_grade  text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM error_notebook_entries
     WHERE id = p_entry_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'entry_not_found';
  END IF;

  INSERT INTO review_attempts (entry_id, user_id, was_correct, confidence, self_grade)
  VALUES (p_entry_id, auth.uid(), p_was_correct, p_confidence, p_self_grade)
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.record_review_attempt_guarded(uuid,boolean,text,text) TO authenticated;


-- ---------------------------------------------------------------------------
-- Motor SM-2-lite completo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.schedule_next_review_guarded(
  p_entry_id   uuid,
  p_outcome    text,   -- errei | dificil | bom | facil
  p_confidence text    -- baixa | media | alta
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e            error_notebook_entries%ROWTYPE;
  ease_base    float8;
  q            int;
  delta        float8;
  new_ease     float8;
  new_interval int;
  new_reps     int;
  new_lapses   int;
  is_atencao   boolean;
  is_leech     boolean := false;
  did_master   boolean := false;
  last2_ok     boolean;
BEGIN
  SELECT * INTO e FROM error_notebook_entries
   WHERE id = p_entry_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'entry_not_found'; END IF;

  -- Gating: itens bloqueados não são revisados aqui
  IF e.last_review_outcome IN ('awaiting_lesson','leech_blocked') THEN
    RAISE EXCEPTION 'review_blocked';
  END IF;

  -- Step 1: ease base (reason-specific só no primeiro review ainda no default 2.5)
  IF e.srs_reps = 0 AND e.srs_ease = 2.5 THEN
    ease_base := CASE e.reason
      WHEN 'did_not_know'                 THEN 2.1
      WHEN 'answered_without_confidence'  THEN 2.1
      WHEN 'did_not_understand_statement' THEN 2.8
      ELSE 2.5  -- did_not_remember
    END;
  ELSE
    ease_base := e.srs_ease;
  END IF;

  -- Step 2: qualidade + override de confiança baixa
  q := CASE p_outcome WHEN 'errei' THEN 0 WHEN 'dificil' THEN 2
                      WHEN 'bom' THEN 3 WHEN 'facil' THEN 4 ELSE 0 END;
  IF p_confidence = 'baixa' AND q > 2 THEN q := 2; END IF;

  is_atencao := (e.reason = 'did_not_understand_statement');

  IF q = 0 THEN
    -- Lapse
    new_reps     := 0;
    new_lapses   := e.srs_lapses + 1;
    new_ease     := GREATEST(1.3, ease_base - 0.20);
    new_interval := GREATEST(1, ROUND(e.srs_interval * 0.20));
  ELSE
    -- Acerto
    new_reps   := e.srs_reps + 1;
    new_lapses := e.srs_lapses;
    delta      := 0.1 - (4 - q) * (0.08 + (4 - q) * 0.02);
    new_ease   := LEAST(3.5, GREATEST(1.3, ease_base + delta));

    IF is_atencao THEN
      new_interval := CASE new_reps WHEN 1 THEN 2 WHEN 2 THEN 6
                        ELSE ROUND(e.srs_interval * new_ease) END;
    ELSE
      new_interval := CASE new_reps WHEN 1 THEN 1 WHEN 2 THEN 4
                        ELSE ROUND(e.srs_interval * new_ease) END;
    END IF;
    new_interval := LEAST(365, GREATEST(1, new_interval));

    -- Promoção de chute (answered_without_confidence respondido com confiança 2x).
    -- A tentativa atual JÁ está em review_attempts (record roda antes do schedule),
    -- então as 2 últimas = atual + anterior; ambas precisam ser >= media.
    IF e.reason = 'answered_without_confidence' AND new_reps >= 2 AND new_ease < 2.5 THEN
      SELECT bool_and(confidence IN ('media','alta')) INTO last2_ok
        FROM (SELECT confidence FROM review_attempts
               WHERE entry_id = p_entry_id ORDER BY reviewed_at DESC LIMIT 2) t;
      IF COALESCE(last2_ok, false) THEN
        new_ease := 2.5;
      END IF;
    END IF;
  END IF;

  -- Step 5: leech
  IF new_lapses >= 4 THEN is_leech := true; END IF;

  -- Step 6: mastery — as 2 últimas confianças (atual + anterior) >= media.
  -- A tentativa atual já está registrada, então LIMIT 2 cobre atual + anterior.
  SELECT bool_and(confidence IN ('media','alta')) INTO last2_ok
    FROM (SELECT confidence FROM review_attempts
           WHERE entry_id = p_entry_id ORDER BY reviewed_at DESC LIMIT 2) t;

  IF q > 0 AND NOT is_leech AND new_reps >= 3 AND new_interval >= 21
     AND p_outcome IN ('bom','facil') AND p_confidence IN ('media','alta')
     AND e.srs_lapses = 0 AND COALESCE(last2_ok, false) THEN
    did_master := true;
  END IF;

  UPDATE error_notebook_entries SET
    srs_ease            = new_ease,
    srs_interval        = new_interval,
    srs_reps            = new_reps,
    srs_lapses          = new_lapses,
    srs_due_at          = now() + (new_interval || ' days')::interval,
    last_review_outcome = CASE WHEN is_leech THEN 'leech_blocked' ELSE p_outcome END,
    mastered_at         = CASE WHEN q = 0 THEN NULL
                               WHEN did_master THEN COALESCE(e.mastered_at, now())
                               ELSE e.mastered_at END,
    updated_at          = now()
  WHERE id = p_entry_id;

  RETURN jsonb_build_object(
    'srs_due_at',   now() + (new_interval || ' days')::interval,
    'srs_interval', new_interval,
    'srs_reps',     new_reps,
    'srs_ease',     new_ease,
    'srs_lapses',   new_lapses,
    'mastered',     did_master,
    'is_leech',     is_leech
  );
END $$;
GRANT EXECUTE ON FUNCTION public.schedule_next_review_guarded(uuid,text,text) TO authenticated;


-- ---------------------------------------------------------------------------
-- Desbloqueio de leech (mantém histórico de lapses)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_leech_guarded(p_entry_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE error_notebook_entries
     SET srs_interval        = 1,
         srs_ease            = 1.3,
         srs_reps            = 0,
         last_review_outcome = NULL,
         srs_due_at          = now() + interval '1 day',
         updated_at          = now()
   WHERE id = p_entry_id AND user_id = auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION public.reset_leech_guarded(uuid) TO authenticated;
