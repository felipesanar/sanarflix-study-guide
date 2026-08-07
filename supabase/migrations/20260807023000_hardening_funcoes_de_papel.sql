-- Hardening: get_user_roles e get_accessible_ies aceitavam UUID de qualquer
-- usuario, sem conferir se era o do chamador. Qualquer autenticado -- inclusive
-- aluno -- podia enumerar papel e escopo de IES de outra conta.
--
-- Confirmado em producao 07/08/2026: anon NAO tem EXECUTE nas duas
-- (has_function_privilege('anon', ...) = false); o ACL esta em authenticated e
-- service_role. Nao era exposicao publica, era divulgacao entre autenticados.
--
-- Por que nao REVOKE: as RLS policies chamam essas funcoes; revogar de
-- authenticated derrubaria as policies. A checagem vai para dentro.
--
-- Por que o ramo de service_role: a edge auth-login (supabase/functions/auth-
-- login/index.ts) chama as duas com o client service_role antes de existir
-- sessao -- auth.uid() e nulo naquele contexto. Sem esse ramo, o login quebra
-- para todo mundo. O ramo e seguro porque anon nao alcanca EXECUTE nessas
-- funcoes; so service_role chega ao caminho de auth.uid() nulo.
--
-- DIVIDA CONSCIENTE: has_role(uuid, app_role) NAO e endurecida. E chamada por
-- dezenas de RLS policies a cada linha; um EXISTS extra custaria em toda
-- leitura do app, e checar admin dentro dela criaria recursao. Vaza um booleano
-- por UUID ja conhecido.
--
-- NAO FOI APLICADA em producao (07/08/2026).

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF public.app_role
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user <> 'service_role'
     AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles r
        WHERE r.user_id = auth.uid() AND r.role = 'admin'::public.app_role
     )
  THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT role FROM public.user_roles WHERE user_id = _user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_roles(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO authenticated, service_role;

-- get_accessible_ies: mesmo preambulo. Corpo (a partir do UNION) preservado
-- caractere a caractere da fonte em
-- 20260525145930_eabe4239-9c96-4bca-a9ca-5a1e6de67157.sql:39-51 -- so muda o
-- envelope: era LANGUAGE sql, vira plpgsql para caber o IF de guarda; SELECT
-- direto vira SELECT ... INTO v_result seguido de RETURN. STABLE SECURITY
-- DEFINER e search_path = public, pg_temp mantidos (aplicados por
-- 20260526010000_impersonation_rpcs_security_definer.sql).
CREATE OR REPLACE FUNCTION public.get_accessible_ies(_user uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result uuid[];
BEGIN
  IF current_user <> 'service_role'
     AND _user IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles r
        WHERE r.user_id = auth.uid() AND r.role = 'admin'::public.app_role
     )
  THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT ies_id), ARRAY[]::uuid[])
    INTO v_result
    FROM (
      SELECT id_ies AS ies_id FROM public.users WHERE id = _user AND id_ies IS NOT NULL
      UNION
      SELECT gi.ies_id
      FROM public.user_groups ug
      JOIN public.group_ies gi ON gi.group_id = ug.group_id
      WHERE ug.user_id = _user
    ) t;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_accessible_ies(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_accessible_ies(uuid) TO authenticated, service_role;
