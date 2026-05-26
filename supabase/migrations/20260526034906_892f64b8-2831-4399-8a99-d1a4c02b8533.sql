
-- Enums
DO $$ BEGIN
  CREATE TYPE public.feedback_category AS ENUM ('bug', 'suggestion', 'feature_request', 'praise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.feedback_status AS ENUM ('received', 'in_review', 'resolved', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category public.feedback_category NOT NULL,
  message text NOT NULL CHECK (char_length(message) BETWEEN 5 AND 4000),
  screenshot_url text,
  status public.feedback_status NOT NULL DEFAULT 'received',
  admin_response text,
  responded_by uuid,
  responded_at timestamptz,
  page_url text,
  viewport text,
  user_agent text,
  ies_id uuid,
  semestre integer,
  user_role text,
  include_metadata boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON public.user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON public.user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON public.user_feedback(created_at DESC);

-- RLS
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own feedback" ON public.user_feedback;
CREATE POLICY "Users view own feedback" ON public.user_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own feedback" ON public.user_feedback;
CREATE POLICY "Users insert own feedback" ON public.user_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all feedback" ON public.user_feedback;
CREATE POLICY "Admins view all feedback" ON public.user_feedback
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update feedback" ON public.user_feedback;
CREATE POLICY "Admins update feedback" ON public.user_feedback
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_user_feedback_updated_at ON public.user_feedback;
CREATE TRIGGER trg_user_feedback_updated_at
  BEFORE UPDATE ON public.user_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (path = {user_id}/...)
DROP POLICY IF EXISTS "Users upload own feedback screenshots" ON storage.objects;
CREATE POLICY "Users upload own feedback screenshots" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users read own feedback screenshots" ON storage.objects;
CREATE POLICY "Users read own feedback screenshots" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Admins read all feedback screenshots" ON storage.objects;
CREATE POLICY "Admins read all feedback screenshots" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Admins delete feedback screenshots" ON storage.objects;
CREATE POLICY "Admins delete feedback screenshots" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
