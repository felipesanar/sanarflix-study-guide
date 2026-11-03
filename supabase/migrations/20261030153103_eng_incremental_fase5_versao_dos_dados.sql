-- eng_incremental_fase5_versao_dos_dados: a tela se atualiza quando os DADOS mudam, não só quando o selo muda
-- Spec: docs/superpowers/specs/2026-10-28-engajamento-refresh-incremental-design.md (§5.4, Fase 5)
--
-- Achado no QA da Fase 5 (30/10/2026, PARACATU): get_gestor_engajamento_versao devolvia só `atualizadoEm`, que é o
-- MENOR entre o fim do refresh e as cargas das fontes. O consumo carrega de hora em hora e as questões a cada
-- 5 min, então o menor fica parado até a próxima carga de consumo: em 6 rodadas seguidas (15:02 a 15:27 UTC) o
-- `atualizadoEm` ficou em 14:20:59 enquanto a carga de questões avançou a cada 5 min e os dados da PARACATU
-- mudaram (147.871 → 147.885 questões). O hook comparava `atualizadoEm`, então a tela só se atualizaria sozinha
-- 1x por hora. O selo continua honesto (mostra a fonte mais atrasada, §5.4 e R6); o que muda é o SINAL de
-- invalidação, que passa a ser a MAIOR carga lida (mais o último rebuild total, que pode reclassificar).

-- ============================================================
-- 1. eng_versao_dados(): o instante do dado mais novo que as eng_* já incorporaram
-- Maior entre as cargas das fontes lidas pelo último refresh ok e o fim do último rebuild total.
-- Só lê a última linha ok do log e o índice parcial (tipo, terminado_em) WHERE status = 'ok'.
-- ============================================================
CREATE OR REPLACE FUNCTION public.eng_versao_dados() RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$
  SELECT greatest(
    (SELECT greatest((l.contagens->>'fonte_carregado_resp')::timestamptz,
                     (l.contagens->>'fonte_carregado_cons')::timestamptz)
     FROM public.eng_refresh_log l
     WHERE l.status = 'ok'
     ORDER BY l.terminado_em DESC
     LIMIT 1),
    (SELECT max(l.terminado_em)
     FROM public.eng_refresh_log l
     WHERE l.status = 'ok' AND l.tipo = 'completo')
  )
$$;

REVOKE ALL ON FUNCTION public.eng_versao_dados() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2. get_gestor_engajamento_versao: acrescenta `versao`; `atualizadoEm` (o selo) não muda
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
    'data', jsonb_build_object('atualizadoEm', public.eng_atualizado_em(), 'versao', public.eng_versao_dados()),
    'meta', public.eng_meta(public.eng_hoje(), public.eng_hoje(), false,
                            'Versão dos dados do Engajamento: o horário mais antigo entre o fim do último refresh e as cargas das fontes que ele leu.')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_versao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_versao(uuid) TO authenticated;
