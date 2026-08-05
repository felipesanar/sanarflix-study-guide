-- 20260804161000_get_gestor_avisos_gestor_pode_acessar_ies.sql
--
-- SUCEDE 20260804130400_get_gestor_avisos_feature_por_ies.sql. NAO edita
-- aquele arquivo -- as migrations de 04/08 JA FORAM APLICADAS EM PRODUCAO
-- (gvqv, 04/08 16:11) e o Supabase registra migration aplicada pelo PREFIXO
-- da versao: editar o conteudo de um arquivo ja aplicado faz o conteudo novo
-- NUNCA rodar, em silencio. A correcao ficaria no repo com cara de pronta e
-- jamais chegaria ao produto. Por isso esta correcao nasce em arquivo novo,
-- com timestamp posterior tanto a 20260804130400 quanto a 20260804160000
-- (a funcao nova de que este arquivo depende).
--
-- O GAP QUE ESTA MIGRATION FECHA (card Ordem 119, achado da verificacao
-- independente das 21 correcoes de 04/08)
-- --------------------------------------------------------------------------
-- 20260804130400 corrigiu o achado 2 (feature por IES). Continuou, porem,
-- autorizando a IES por public.user_can_access_ies(v_uid, p_ies_id), que
-- delega para public.get_accessible_ies(_user) quando a IES nao e a do
-- proprio cadastro -- e get_accessible_ies e a UNIAO de users.id_ies com as
-- IES de TODO grupo em que o usuario aparece em user_groups, SEM olhar o
-- papel. Um usuario com role SOMENTE 'gestor' (users.id_ies = A) que tenha
-- ficado com uma linha orfa em user_groups (residuo de downgrade
-- gestor_grupo -> gestor, permitido pela UI de admin hoje) apontando para um
-- grupo que cobre {A, B} passa em user_can_access_ies para a IES B. A UI nao
-- oferece o switcher para esse usuario (podeTrocarIes = false) -- mas isso e
-- so a UI: um POST direto em /rest/v1/rpc/get_gestor_avisos com
-- p_ies_id = B ainda devolvia os avisos configurados para a IES B.
--
-- A CORRECAO: troca public.user_can_access_ies(v_uid, p_ies_id) por
-- public.gestor_pode_acessar_ies(v_ies) -- a funcao criada em
-- 20260804160000_gestor_pode_acessar_ies.sql, que para o papel 'gestor'
-- autoriza SOMENTE users.id_ies, nunca get_accessible_ies. O guard tambem
-- sai de dentro do `IF p_ies_id IS NOT NULL` e passa a rodar DEPOIS da
-- resolucao de v_ies: o guard antigo so cobria aquele ramo -- o ramo ELSE
-- (p_ies_id omitido) cai em `(get_accessible_ies(v_uid))[1]`, que para o
-- mesmo gestor puro com users.id_ies NULL e user_groups orfao devolve uma
-- IES do grupo -- o mesmo vazamento, por outra porta, sem p_ies_id nenhum.
-- Autorizar v_ies (o valor que a query vai de fato usar), e nao p_ies_id,
-- fecha os dois ramos com um unico IF. Nada e emitido antes do guard, logo
-- continua negando antes de revelar qualquer coisa sobre a IES.
--
-- NENHUMA outra logica foi alterada: mesmo SECURITY DEFINER, SET
-- search_path, STABLE, guard de papel, ordem "Access denied" -> resolucao de
-- v_ies -> "IES not resolved" -> autorizacao -> "feature_not_enabled", corpo
-- da query de avisos, criterio de visibilidade, COALESCE de publico_alvo,
-- ordenacao (nao lidos primeiro), grants e assinatura (uuid) -> jsonb.
--
-- NAO alterada a mensagem 'Permission denied: cannot access this IES' -- o
-- front-end mapeia essa string; mudar o texto quebraria o tratamento de erro
-- sem trocar nada de seguranca.
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv) -- rodar os dois readbacks
-- abaixo e ABORTAR se qualquer um divergir do que este arquivo assume:
--
--   -- (a) o corpo hoje em producao tem que ser o de 20260804130400:
--   SELECT pg_get_functiondef('public.get_gestor_avisos(uuid)'::regprocedure);
--   -- ESPERADO: guard de papel + `user_can_access_ies(v_uid, p_ies_id)`
--   -- dentro do `IF p_ies_id IS NOT NULL`, seguido de
--   -- `user_has_feature_for_ies('gestao.portal_v2', v_ies)`. Se vier
--   -- diferente (patch aplicado direto em prod, fora do repo), PARAR.
--
--   -- (b) a funcao de que este arquivo depende precisa existir:
--   SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'gestor_pode_acessar_ies';
--   -- ESPERADO: 1 linha (aplicada por 20260804160000). Se vier 0, aplicar
--   -- aquela migration ANTES desta -- esta funcao nao compila sem ela.

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

  -- resolucao de v_ies (ainda NAO autoriza -- ver "A CORRECAO" no cabecalho)
  IF p_ies_id IS NOT NULL THEN
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

  -- autorizacao da IES RESOLVIDA, por papel (gap 119: gestor puro so acessa
  -- users.id_ies, nunca get_accessible_ies, mesmo com user_groups orfao)
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
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
-- VERIFICACAO (rodar manualmente em gvqv, autenticado como o usuario de
-- teste -- nao como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
-- 1) Readback do corpo aplicado:
--    SELECT pg_get_functiondef('public.get_gestor_avisos(uuid)'::regprocedure);
--
-- 2) Cenario do gap (:uid = gestor PURO de teste, users.id_ies = :ies_a, com
--    linha orfa em user_groups cobrindo :ies_a E :ies_b):
--
--    SELECT public.user_can_access_ies(:uid::uuid, :ies_b::uuid) AS antigo_libera_b,
--           public.gestor_pode_acessar_ies(:ies_b::uuid)         AS novo_nega_b;
--    -- ESPERADO: antigo_libera_b = true (o gap), novo_nega_b = false.
--
-- 3) Gap fechado ponta a ponta, em transacao revertida:
--
--    BEGIN;
--      SELECT public.get_gestor_avisos(:ies_b::uuid);
--      -- ESPERADO: RAISE 'Permission denied: cannot access this IES'
--      -- (antes desta migration: retornava os avisos da IES B normalmente)
--      SELECT public.get_gestor_avisos(:ies_a::uuid);
--      -- ESPERADO: retorna jsonb normalmente (caso legitimo preservado)
--    ROLLBACK;
--
-- 4) Nao-regressao do achado 2 (feature por IES), repetindo o teste da
--    migration anterior (:ies_c = IES do PROPRIO gestor_grupo com a flag
--    desligada; :ies_d = IES irma do mesmo grupo com a flag ligada):
--
--    BEGIN;
--      SELECT public.get_gestor_avisos(:ies_c::uuid);  -- esperado: RAISE 'feature_not_enabled'
--      SELECT public.get_gestor_avisos(:ies_d::uuid);  -- esperado: retorna jsonb normalmente
--    ROLLBACK;
--
-- 5) Nao-regressao de gestor_grupo e admin (autenticados como cada um,
--    testando :ies_a e :ies_b): ambos continuam com acesso a qualquer IES do
--    grupo (gestor_grupo) ou qualquer IES (admin) -- so o 'gestor' puro muda.
