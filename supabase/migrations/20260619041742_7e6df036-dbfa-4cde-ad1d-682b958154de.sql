
-- ============================================================
-- Migration 1: 20260618120000_caderno_srs_schema.sql
-- ============================================================
ALTER TABLE public.error_notebook_entries
  ADD COLUMN IF NOT EXISTS srs_ease             float8      NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS srs_interval         int4        NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS srs_reps             int4        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_lapses           int4        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_due_at           timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS confidence_at_answer text CHECK (confidence_at_answer IN ('baixa','media','alta')),
  ADD COLUMN IF NOT EXISTS last_review_outcome  text CHECK (last_review_outcome IN ('errei','dificil','bom','facil','snoozed','awaiting_lesson','leech_blocked')),
  ADD COLUMN IF NOT EXISTS mastered_at          timestamptz;

UPDATE public.error_notebook_entries
   SET srs_due_at = COALESCE(srs_due_at, now())
 WHERE deleted_at IS NULL AND srs_due_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_en_srs_due
  ON public.error_notebook_entries (user_id, srs_due_at)
  WHERE deleted_at IS NULL AND mastered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_en_leech
  ON public.error_notebook_entries (user_id)
  WHERE srs_lapses >= 4;

-- FK opcional: checagem prévia confirmou 0 órfãos
ALTER TABLE public.error_notebook_entries
  ADD CONSTRAINT fk_en_question FOREIGN KEY (question_id)
  REFERENCES public.questoes_simulado(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.review_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    uuid NOT NULL REFERENCES public.error_notebook_entries(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  was_correct boolean NOT NULL,
  confidence  text NOT NULL CHECK (confidence IN ('baixa','media','alta')),
  self_grade  text NOT NULL CHECK (self_grade IN ('errei','dificil','bom','facil')),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ra_entry ON public.review_attempts (entry_id, reviewed_at DESC);

GRANT SELECT, INSERT ON public.review_attempts TO authenticated;
GRANT ALL ON public.review_attempts TO service_role;

ALTER TABLE public.review_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ra_select_own' AND tablename = 'review_attempts') THEN
    CREATE POLICY ra_select_own ON public.review_attempts
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ra_no_insert' AND tablename = 'review_attempts') THEN
    CREATE POLICY ra_no_insert ON public.review_attempts
      FOR INSERT WITH CHECK (false);
  END IF;
END $$;

-- ============================================================
-- Migration 2: 20260618120100_caderno_srs_rpcs.sql
-- ============================================================
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

CREATE OR REPLACE FUNCTION public.schedule_next_review_guarded(
  p_entry_id   uuid,
  p_outcome    text,
  p_confidence text
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

  IF e.last_review_outcome IN ('awaiting_lesson','leech_blocked') THEN
    RAISE EXCEPTION 'review_blocked';
  END IF;

  IF e.srs_reps = 0 AND e.srs_ease = 2.5 THEN
    ease_base := CASE e.reason
      WHEN 'did_not_know'                 THEN 2.1
      WHEN 'answered_without_confidence'  THEN 2.1
      WHEN 'did_not_understand_statement' THEN 2.8
      ELSE 2.5
    END;
  ELSE
    ease_base := e.srs_ease;
  END IF;

  q := CASE p_outcome WHEN 'errei' THEN 0 WHEN 'dificil' THEN 2
                      WHEN 'bom' THEN 3 WHEN 'facil' THEN 4 ELSE 0 END;
  IF p_confidence = 'baixa' AND q > 2 THEN q := 2; END IF;

  is_atencao := (e.reason = 'did_not_understand_statement');

  IF q = 0 THEN
    new_reps     := 0;
    new_lapses   := e.srs_lapses + 1;
    new_ease     := GREATEST(1.3, ease_base - 0.20);
    new_interval := GREATEST(1, ROUND(e.srs_interval * 0.20));
  ELSE
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

    IF e.reason = 'answered_without_confidence' AND new_reps >= 2 AND new_ease < 2.5 THEN
      SELECT bool_and(confidence IN ('media','alta')) INTO last2_ok
        FROM (SELECT confidence FROM review_attempts
               WHERE entry_id = p_entry_id ORDER BY reviewed_at DESC LIMIT 2) t;
      IF COALESCE(last2_ok, false) THEN
        new_ease := 2.5;
      END IF;
    END IF;
  END IF;

  IF new_lapses >= 4 THEN is_leech := true; END IF;

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

-- ============================================================
-- Migration 3: 20260618120200_caderno_bulk_add.sql
-- ============================================================
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
    IF v_count > 100 THEN EXIT; END IF;

    v_question := NULLIF(v_item->>'question_id', '')::uuid;
    v_reason   := COALESCE(v_item->>'reason', 'did_not_know');

    v_ease := CASE v_reason
      WHEN 'did_not_know'                 THEN 2.1
      WHEN 'answered_without_confidence'  THEN 2.1
      WHEN 'did_not_understand_statement' THEN 2.8
      ELSE 2.5
    END;

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

-- ============================================================
-- Migration 4: 20260618120300_caderno_favorites_notes.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS public.question_favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  question_id uuid NOT NULL,
  simulado_id uuid,
  grande_area text,
  tema        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_qf_user ON public.question_favorites (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_favorites TO authenticated;
GRANT ALL ON public.question_favorites TO service_role;

ALTER TABLE public.question_favorites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='qf_select_own' AND tablename='question_favorites') THEN
    CREATE POLICY qf_select_own ON public.question_favorites FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='qf_insert_own' AND tablename='question_favorites') THEN
    CREATE POLICY qf_insert_own ON public.question_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='qf_delete_own' AND tablename='question_favorites') THEN
    CREATE POLICY qf_delete_own ON public.question_favorites FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  title       text NOT NULL DEFAULT '',
  body_md     text NOT NULL DEFAULT '',
  question_id uuid,
  simulado_id uuid,
  grande_area text,
  tema        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_un_user ON public.user_notes (user_id, updated_at DESC) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notes TO authenticated;
GRANT ALL ON public.user_notes TO service_role;

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='un_select_own' AND tablename='user_notes') THEN
    CREATE POLICY un_select_own ON public.user_notes FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='un_insert_own' AND tablename='user_notes') THEN
    CREATE POLICY un_insert_own ON public.user_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='un_update_own' AND tablename='user_notes') THEN
    CREATE POLICY un_update_own ON public.user_notes FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_user_notes_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_user_notes_updated_at ON public.user_notes;
CREATE TRIGGER trg_user_notes_updated_at BEFORE UPDATE ON public.user_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_notes_updated_at();
