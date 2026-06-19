-- Caderno de Erros — Flashcards com SRS (Fase 3). NÃO aplicada ainda.
-- Reaproveita o mesmo motor SM-2-lite (versão simplificada: sem reason/confidence).

CREATE TABLE IF NOT EXISTS public.flashcards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL,
  front_md            text NOT NULL CHECK (char_length(front_md) BETWEEN 1 AND 2000),
  back_md             text NOT NULL CHECK (char_length(back_md) BETWEEN 1 AND 4000),
  question_id         uuid,
  srs_ease            float8 NOT NULL DEFAULT 2.5,
  srs_interval        int4   NOT NULL DEFAULT 1,
  srs_reps            int4   NOT NULL DEFAULT 0,
  srs_lapses          int4   NOT NULL DEFAULT 0,
  srs_due_at          timestamptz NOT NULL DEFAULT now(),
  last_review_outcome text CHECK (last_review_outcome IN ('errei','dificil','bom','facil')),
  mastered_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fc_due ON public.flashcards (user_id, srs_due_at)
  WHERE deleted_at IS NULL AND mastered_at IS NULL;

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='fc_select_own' AND tablename='flashcards') THEN
    CREATE POLICY fc_select_own ON public.flashcards FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='fc_insert_own' AND tablename='flashcards') THEN
    CREATE POLICY fc_insert_own ON public.flashcards FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='fc_update_own' AND tablename='flashcards') THEN
    -- sem "deleted_at IS NULL" (não bloquear o soft-delete)
    CREATE POLICY fc_update_own ON public.flashcards FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_flashcards_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_flashcards_updated_at ON public.flashcards;
CREATE TRIGGER trg_flashcards_updated_at BEFORE UPDATE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.touch_flashcards_updated_at();

-- Agendamento SM-2-lite simplificado para flashcards (sem reason/confidence/gating)
CREATE OR REPLACE FUNCTION public.schedule_flashcard_review_guarded(
  p_flashcard_id uuid,
  p_outcome      text   -- errei | dificil | bom | facil
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f            flashcards%ROWTYPE;
  q            int;
  delta        float8;
  new_ease     float8;
  new_interval int;
  new_reps     int;
  new_lapses   int;
  is_leech     boolean := false;
  did_master   boolean := false;
BEGIN
  SELECT * INTO f FROM flashcards WHERE id = p_flashcard_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'flashcard_not_found'; END IF;

  q := CASE p_outcome WHEN 'errei' THEN 0 WHEN 'dificil' THEN 2 WHEN 'bom' THEN 3 WHEN 'facil' THEN 4 ELSE 0 END;

  IF q = 0 THEN
    new_reps := 0;
    new_lapses := f.srs_lapses + 1;
    new_ease := GREATEST(1.3, f.srs_ease - 0.20);
    new_interval := GREATEST(1, ROUND(f.srs_interval * 0.20));
  ELSE
    new_reps := f.srs_reps + 1;
    new_lapses := f.srs_lapses;
    delta := 0.1 - (4 - q) * (0.08 + (4 - q) * 0.02);
    new_ease := LEAST(3.5, GREATEST(1.3, f.srs_ease + delta));
    new_interval := CASE new_reps WHEN 1 THEN 1 WHEN 2 THEN 4 ELSE ROUND(f.srs_interval * new_ease) END;
    new_interval := LEAST(365, GREATEST(1, new_interval));
  END IF;

  IF new_lapses >= 4 THEN is_leech := true; END IF;
  IF q > 0 AND new_reps >= 3 AND new_interval >= 21 AND p_outcome IN ('bom','facil') AND f.srs_lapses = 0 THEN
    did_master := true;
  END IF;

  UPDATE flashcards SET
    srs_ease = new_ease, srs_interval = new_interval, srs_reps = new_reps, srs_lapses = new_lapses,
    srs_due_at = now() + (new_interval || ' days')::interval,
    last_review_outcome = p_outcome,
    mastered_at = CASE WHEN q = 0 THEN NULL WHEN did_master THEN COALESCE(f.mastered_at, now()) ELSE f.mastered_at END,
    updated_at = now()
  WHERE id = p_flashcard_id;

  RETURN jsonb_build_object('srs_interval', new_interval, 'srs_reps', new_reps,
    'srs_ease', new_ease, 'srs_lapses', new_lapses, 'mastered', did_master, 'is_leech', is_leech);
END $$;
GRANT EXECUTE ON FUNCTION public.schedule_flashcard_review_guarded(uuid,text) TO authenticated;
