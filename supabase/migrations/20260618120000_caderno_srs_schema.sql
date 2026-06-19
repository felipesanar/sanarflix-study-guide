-- Caderno de Erros — SRS schema (Fase 1)
-- Port adaptado do enamed-arena. NÃO altera dados existentes de forma destrutiva.
-- Ver docs/caderno-de-erros-port-plan.md e docs/caderno-de-erros-port-sql.md.

-- 1. Colunas SRS em error_notebook_entries
ALTER TABLE public.error_notebook_entries
  ADD COLUMN IF NOT EXISTS srs_ease             float8      NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS srs_interval         int4        NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS srs_reps             int4        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_lapses           int4        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_due_at           timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS confidence_at_answer text CHECK (confidence_at_answer IN ('baixa','media','alta')),
  ADD COLUMN IF NOT EXISTS last_review_outcome  text CHECK (last_review_outcome IN ('errei','dificil','bom','facil','snoozed','awaiting_lesson','leech_blocked')),
  ADD COLUMN IF NOT EXISTS mastered_at          timestamptz;

-- 2. Backfill: itens vivos entram na fila como "devidos agora"
UPDATE public.error_notebook_entries
   SET srs_due_at = COALESCE(srs_due_at, now())
 WHERE deleted_at IS NULL AND srs_due_at IS NULL;

-- 3. Índices parciais (fila de devidas, leech)
CREATE INDEX IF NOT EXISTS idx_en_srs_due
  ON public.error_notebook_entries (user_id, srs_due_at)
  WHERE deleted_at IS NULL AND mastered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_en_leech
  ON public.error_notebook_entries (user_id)
  WHERE srs_lapses >= 4;

-- 4. FK question_id -> questoes_simulado (OPCIONAL).
--    Antes de habilitar, rodar a checagem de órfãos:
--      SELECT count(*) FROM error_notebook_entries en
--      LEFT JOIN questoes_simulado q ON q.id = en.question_id
--      WHERE en.question_id IS NOT NULL AND q.id IS NULL;
--    Se zero, descomentar:
-- ALTER TABLE public.error_notebook_entries
--   ADD CONSTRAINT fk_en_question FOREIGN KEY (question_id)
--   REFERENCES public.questoes_simulado(id) ON DELETE SET NULL;

-- NOTA (bug do enamed a evitar): a policy de UPDATE de error_notebook_entries
-- NÃO deve conter "deleted_at IS NULL" — isso bloquearia o próprio soft-delete.
-- A policy atual do academy usa auth.uid() = user_id (ok); não regredir.

-- 5. Log imutável de revisões
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

ALTER TABLE public.review_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ra_select_own' AND tablename = 'review_attempts') THEN
    CREATE POLICY ra_select_own ON public.review_attempts
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ra_no_insert' AND tablename = 'review_attempts') THEN
    -- INSERT só via RPC SECURITY DEFINER (record_review_attempt_guarded)
    CREATE POLICY ra_no_insert ON public.review_attempts
      FOR INSERT WITH CHECK (false);
  END IF;
END $$;
