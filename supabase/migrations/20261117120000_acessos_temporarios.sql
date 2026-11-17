-- acessos_temporarios: expiração opcional e automática de acesso por usuário.
--
-- Regra: expirar é OPCIONAL. Usuário sem linha em user_access_expirations é
-- permanente e nunca entra no job. Só um admin cancelando a conta o remove.
--
-- Mecanismo: ao vencer, o cron aplica auth.users.banned_until (o GoTrue recusa
-- login, magic link, recuperação de senha e refresh de token) e apaga as
-- sessões. Nenhuma RLS, has_role ou RPC do gestor/aluno é alterada.
--
-- A validade fica em tabela própria (não em public.users) porque a policy
-- "Usuário pode atualizar seu próprio perfil" deixaria o aluno apagar o prazo.

-- ============================================================
-- 1. Tabela
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_access_expirations (
  user_id      uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  expira_em    timestamptz NOT NULL,
  expirado_em  timestamptz NULL,
  definido_por uuid NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_access_expirations IS
  'Prazo de validade opcional por usuário. Sem linha = acesso permanente. expirado_em preenchido = bloqueio já aplicado pelo cron.';

CREATE INDEX IF NOT EXISTS user_access_expirations_pendentes_idx
  ON public.user_access_expirations (expira_em)
  WHERE expirado_em IS NULL;

ALTER TABLE public.user_access_expirations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin e atendimento veem validades" ON public.user_access_expirations;
CREATE POLICY "Admin e atendimento veem validades"
  ON public.user_access_expirations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'atendimento'::public.app_role)
  );

-- O default ACL do projeto dá privilégio total a anon/authenticated: revogar
-- de authenticated explicitamente. Escrita só via funções SECURITY DEFINER.
REVOKE ALL ON TABLE public.user_access_expirations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_access_expirations TO authenticated;
GRANT ALL ON TABLE public.user_access_expirations TO service_role;

-- ============================================================
-- 2. Aplica o bloqueio nas validades vencidas
--    p_user_id NULL = todas as vencidas (cron); com valor = só aquele usuário
--    (usado pelo auth-login entre o vencimento e o próximo tick do cron).
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_temporary_accesses(p_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT e.user_id, e.expira_em, e.definido_por
    FROM public.user_access_expirations e
    WHERE e.expirado_em IS NULL
      AND e.expira_em <= now()
      AND (p_user_id IS NULL OR e.user_id = p_user_id)
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE auth.users
       SET banned_until = '2999-12-31 00:00:00+00'::timestamptz
     WHERE id = r.user_id;

    -- refresh_tokens e mfa_amr_claims caem em cascata
    DELETE FROM auth.sessions WHERE user_id = r.user_id;

    UPDATE public.user_access_expirations
       SET expirado_em = now(), updated_at = now()
     WHERE user_id = r.user_id;

    IF r.definido_por IS NOT NULL THEN
      INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, metadata)
      VALUES (
        r.definido_por,
        'access_expired',
        r.user_id,
        jsonb_build_object('expira_em', r.expira_em)
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 3. Define, renova ou remove a validade
--    p_expira_em NULL  = torna permanente (apaga a linha; desbane se já expirado)
--    p_expira_em data  = define/renova (desbane se já expirado)
--    Só desbane quem NÓS banimos (expirado_em preenchido).
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_user_access_expiration(
  p_user_id uuid,
  p_expira_em timestamptz,
  p_actor uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_was_expired boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_expira_em IS NULL THEN
    DELETE FROM public.user_access_expirations
     WHERE user_id = p_user_id
    RETURNING (expirado_em IS NOT NULL) INTO v_was_expired;
  ELSE
    IF p_expira_em <= now() THEN
      RAISE EXCEPTION 'expiration_in_past' USING ERRCODE = '22023';
    END IF;

    SELECT (expirado_em IS NOT NULL) INTO v_was_expired
      FROM public.user_access_expirations
     WHERE user_id = p_user_id;

    INSERT INTO public.user_access_expirations (user_id, expira_em, expirado_em, definido_por)
    VALUES (p_user_id, p_expira_em, NULL, p_actor)
    ON CONFLICT (user_id) DO UPDATE
      SET expira_em    = EXCLUDED.expira_em,
          expirado_em  = NULL,
          definido_por = EXCLUDED.definido_por,
          updated_at   = now();
  END IF;

  IF COALESCE(v_was_expired, false) THEN
    UPDATE auth.users SET banned_until = NULL WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_temporary_accesses(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_temporary_accesses(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.set_user_access_expiration(uuid, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_access_expiration(uuid, timestamptz, uuid) TO service_role;

-- ============================================================
-- 4. Cron: a cada minuto. Só processa linhas da tabela acima.
-- ============================================================
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'acessos-temporarios-expirar';
SELECT cron.schedule(
  'acessos-temporarios-expirar',
  '* * * * *',
  $$SET statement_timeout TO '30s'; SELECT public.expire_temporary_accesses();$$
);
