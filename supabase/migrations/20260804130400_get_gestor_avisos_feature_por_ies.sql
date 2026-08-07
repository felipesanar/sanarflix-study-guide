-- 20260804130000_get_gestor_avisos_feature_por_ies.sql
--
-- Corrige o achado 2 da revisao adversarial de 03/08 (card Ordem 101) em
-- public.get_gestor_avisos: a checagem de feature usava public.user_has_feature
-- ('gestao.portal_v2'), que resolve por bool_or sobre TODAS as IES acessiveis
-- ao usuario (get_accessible_ies) quando users.id_ies e null -- o caso normal
-- de gestor_grupo. Isso libera avisos do portal v2 para uma IES do grupo que
-- tem a flag desligada, contanto que outra IES irma a tenha ligada.
--
-- PARTIU de supabase/migrations/20260729210200_get_gestor_avisos.sql (unica
-- migration desta funcao no repo). NENHUMA outra logica foi alterada: mesmo
-- SECURITY DEFINER, SET search_path, STABLE, guard de papel, chamada a
-- user_can_access_ies, fallback de v_ies, corpo da query de avisos, grants e
-- assinatura (uuid) -> jsonb.
--
-- MUDANCA: troca public.user_has_feature('gestao.portal_v2') por
-- public.user_has_feature_for_ies('gestao.portal_v2', v_ies) -- a funcao
-- criada em 20260804120000_user_has_feature_for_ies.sql. O guard foi movido
-- para DEPOIS da resolucao de v_ies (ver "AVISO CRITICO" na migration do
-- helper): antes disso p_ies_id pode ser NULL e a funcao nova e fail-closed
-- para NULL, o que faria toda chamada sem p_ies_id explodir em
-- 'feature_not_enabled' -- regressao que este reordenamento evita. Ordem final
-- do preambulo: papel (Access denied) -> user_can_access_ies -> resolucao de
-- v_ies -> feature (feature_not_enabled).
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv): rodar
--   SELECT pg_get_functiondef('public.get_gestor_avisos(uuid)'::regprocsignature);
-- e comparar com o corpo de 20260729210200 assumido acima. Se divergir
-- (patch aplicado direto em prod fora do repo), ABORTAR e investigar antes de
-- rodar este arquivo -- nao sobrescrever um corpo que nao foi conferido.

CREATE OR REPLACE FUNCTION public.get_gestor_avisos(p_ies_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_ies    uuid;
  v_result jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_uid, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_uid))[1];
    END IF;
  END IF;
  IF v_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  IF NOT public.user_has_feature_for_ies('gestao.portal_v2', v_ies) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  WITH visiveis AS (
    SELECT a.id, a.titulo, a.descricao, a.created_at,
           EXISTS (SELECT 1 FROM public.announcements_viewed av
                   WHERE av.announcement_id = a.id AND av.user_id = v_uid) AS lido
    FROM public.announcements a
    WHERE a.ativo = true
      AND (a.data_expiracao IS NULL OR a.data_expiracao > now())
      AND 'gestor' = ANY (COALESCE(a.publico_alvo, ARRAY['aluno']::text[]))
      AND (
            a.visibilidade = 'todas'
        OR (a.visibilidade = 'seletivo' AND v_ies = ANY (COALESCE(a.ies_selecionadas, ARRAY[]::uuid[])))
        OR (a.visibilidade = 'exceto'   AND NOT (v_ies = ANY (COALESCE(a.ies_excluidas, ARRAY[]::uuid[]))))
      )
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',     v.id,
               'titulo', v.titulo,
               'resumo', CASE WHEN length(v.descricao) > 180
                              THEN left(v.descricao, 180) || '…'
                              ELSE v.descricao END,
               'data',   to_char(v.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
               'lido',   v.lido
             ) ORDER BY v.lido ASC, v.created_at DESC)
      FROM visiveis v
    ), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      'avisos ativos e não expirados',
      'fonte',        'announcements · announcements_viewed',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     'Aviso ativo, não expirado, com ''gestor'' em publico_alvo e visível para a IES pelas regras de visibilidade (todas/seletivo/exceto). semestre_destino é ignorado: gestor não tem semestre. Não lidos primeiro, depois mais recentes.',
      'partial',      false,
      'lowSample',    false
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_avisos(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_avisos(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICACAO (rodar manualmente em gvqv, autenticado como o usuario gestor
-- de teste -- nao como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
-- 1) Readback do corpo aplicado:
--    SELECT pg_get_functiondef('public.get_gestor_avisos(uuid)'::regprocsignature);
--
-- 2) Caso funcional, em transacao revertida (:ies_b = IES do grupo do gestor
--    com 'gestao.portal_v2' DESLIGADA; :ies_a = IES irmã com a flag LIGADA):
--
--    BEGIN;
--      SELECT public.get_gestor_avisos(:ies_b::uuid);  -- esperado: RAISE 'feature_not_enabled'
--      SELECT public.get_gestor_avisos(:ies_a::uuid);   -- esperado: retorna jsonb normalmente
--    ROLLBACK;
