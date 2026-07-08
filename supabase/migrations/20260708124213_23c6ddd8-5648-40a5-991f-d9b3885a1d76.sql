-- Automação: notificar no Slack a cada novo feedback de aluno
-- Trigger AFTER INSERT em public.user_feedback -> chama edge function notify-feedback-slack via pg_net

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.tg_notify_feedback_slack()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_url text := 'https://gvqvrmkizemwsasmupmo.supabase.co/functions/v1/notify-feedback-slack';
BEGIN
  -- Fire-and-forget: pg_net enfileira o request e retorna imediatamente.
  PERFORM extensions.http_post(
    url := v_url,
    body := jsonb_build_object('feedback_id', NEW.id),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear a inserção do feedback por causa da notificação.
  RAISE WARNING '[tg_notify_feedback_slack] falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_notify_feedback_slack() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_notify_feedback_slack ON public.user_feedback;
CREATE TRIGGER trg_notify_feedback_slack
AFTER INSERT ON public.user_feedback
FOR EACH ROW
EXECUTE FUNCTION public.tg_notify_feedback_slack();