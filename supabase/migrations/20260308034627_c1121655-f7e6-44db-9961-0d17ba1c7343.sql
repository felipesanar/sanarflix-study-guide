
-- 1. Add soft delete column
ALTER TABLE public.error_notebook_entries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Make question_id and simulado_id nullable for manual entries
ALTER TABLE public.error_notebook_entries
  ALTER COLUMN question_id DROP NOT NULL,
  ALTER COLUMN simulado_id DROP NOT NULL,
  ALTER COLUMN simulado_nome DROP NOT NULL;

-- 3. Partial index for active entries
CREATE INDEX IF NOT EXISTS idx_error_notebook_active
  ON public.error_notebook_entries (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- 4. Index on deleted_at for restore queries
CREATE INDEX IF NOT EXISTS idx_error_notebook_deleted_at
  ON public.error_notebook_entries (deleted_at)
  WHERE deleted_at IS NOT NULL;
