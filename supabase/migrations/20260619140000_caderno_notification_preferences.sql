-- Caderno de Erros — preferências de notificação (Fase 4, scaffold Novu). NÃO aplicada.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id              uuid PRIMARY KEY,
  caderno_daily_review boolean NOT NULL DEFAULT true,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='np_select_own' AND tablename='notification_preferences') THEN
    CREATE POLICY np_select_own ON public.notification_preferences FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='np_insert_own' AND tablename='notification_preferences') THEN
    CREATE POLICY np_insert_own ON public.notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='np_update_own' AND tablename='notification_preferences') THEN
    CREATE POLICY np_update_own ON public.notification_preferences FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_notification_preferences_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_np_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_np_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_notification_preferences_updated_at();

-- Upsert guardado (cliente atualiza as próprias preferências de forma parcial)
CREATE OR REPLACE FUNCTION public.upsert_notification_preferences(p_caderno_daily_review boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notification_preferences (user_id, caderno_daily_review)
  VALUES (auth.uid(), COALESCE(p_caderno_daily_review, true))
  ON CONFLICT (user_id) DO UPDATE
    SET caderno_daily_review = COALESCE(EXCLUDED.caderno_daily_review, notification_preferences.caderno_daily_review),
        updated_at = now();
END $$;
GRANT EXECUTE ON FUNCTION public.upsert_notification_preferences(boolean) TO authenticated;
