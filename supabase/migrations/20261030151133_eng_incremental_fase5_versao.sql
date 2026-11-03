-- eng_incremental_fase5_versao: "atualizado em" honesto e RPC de versão para a tela se atualizar sozinha
-- Spec: docs/superpowers/specs/2026-10-28-engajamento-refresh-incremental-design.md (§5.4, Fase 5)
--
-- ATENÇÃO: esta migration só é aplicada em produção DEPOIS do DoD da Fase 4 (spec §7: "Aplicar a migration da
-- Fase 5 depois do DoD da Fase 4"). Ela está no repositório antes disso porque o código do front da Fase 5 corre
-- em paralelo à observação das 24 h.

-- ============================================================
-- 1. eng_atualizado_em(): o MENOR entre o fim do último refresh ok e as cargas da fonte que ele leu
-- Se a DAG parar, o selo envelhece em vez de dizer "há 2 min". Lê só a última linha ok do log (índice
-- eng_refresh_log_ok_idx); não varre fonte na hora da RPC. LEAST ignora NULL: linhas antigas, de antes das
-- chaves fonte_carregado_*, valem só pelo terminado_em. O texto do selo não muda.
-- ============================================================
CREATE OR REPLACE FUNCTION public.eng_atualizado_em() RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$
  SELECT least(l.terminado_em,
               (l.contagens->>'fonte_carregado_resp')::timestamptz,
               (l.contagens->>'fonte_carregado_cons')::timestamptz)
  FROM public.eng_refresh_log l
  WHERE l.status = 'ok'
  ORDER BY l.terminado_em DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.eng_atualizado_em() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2. get_gestor_engajamento_versao: a versão dos dados, barata, para o front invalidar o cache
-- Mesma ordem de autorização das outras RPCs do gestor (papel → v_ies → gestor_pode_acessar_ies).
-- Não tem período: não há validação de datas.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_versao(
  p_ies_id uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ies uuid;
BEGIN
  IF NOT ( has_role(v_uid,'admin'::app_role) OR has_role(v_uid,'gestor'::app_role) OR has_role(v_uid,'gestor_grupo'::app_role) ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_ies_id IS NOT NULL THEN
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN v_ies := (public.get_accessible_ies(v_uid))[1]; END IF;
  END IF;
  IF v_ies IS NULL THEN RAISE EXCEPTION 'IES not resolved'; END IF;
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  RETURN jsonb_build_object(
    'data', jsonb_build_object('atualizadoEm', public.eng_atualizado_em()),
    'meta', public.eng_meta(public.eng_hoje(), public.eng_hoje(), false,
                            'Versão dos dados do Engajamento: o horário mais antigo entre o fim do último refresh e as cargas das fontes que ele leu.')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_versao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_versao(uuid) TO authenticated;
