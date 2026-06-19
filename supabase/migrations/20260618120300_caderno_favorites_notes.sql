-- Caderno de Erros — casca-hub: favoritos + anotações (Fase 2)
-- Ver docs/caderno-de-erros-port-plan.md (FASE 2). NÃO aplicada ainda.

-- ── Favoritos (delete físico, dedup por questão) ──
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

-- ── Anotações (soft-delete) ──
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

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='un_select_own' AND tablename='user_notes') THEN
    CREATE POLICY un_select_own ON public.user_notes FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='un_insert_own' AND tablename='user_notes') THEN
    CREATE POLICY un_insert_own ON public.user_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='un_update_own' AND tablename='user_notes') THEN
    -- sem "deleted_at IS NULL" aqui (bug do enamed: bloquearia o soft-delete)
    CREATE POLICY un_update_own ON public.user_notes FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_user_notes_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_user_notes_updated_at ON public.user_notes;
CREATE TRIGGER trg_user_notes_updated_at BEFORE UPDATE ON public.user_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_notes_updated_at();
