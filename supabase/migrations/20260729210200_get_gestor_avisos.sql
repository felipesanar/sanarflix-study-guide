-- 20260729210200_get_gestor_avisos.sql
-- Fase 1 / Task 16 do Portal do Gestor v2.
-- Segmenta avisos pelo publico_alvo (coluna da Task 7). O COALESCE para
-- ARRAY['aluno'] e a segunda linha de defesa caso algum aviso antigo tenha
-- ficado sem backfill -- sem ele, aviso de aluno vazaria para o gestor.
-- semestre_destino e ignorado de proposito: gestor nao tem semestre.
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
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

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
