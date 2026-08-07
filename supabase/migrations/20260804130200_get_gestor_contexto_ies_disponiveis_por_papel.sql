-- 20260804130200_get_gestor_contexto_ies_disponiveis_por_papel.sql
--
-- Corrige o achado 15 da revisao adversarial de 03/08 (card Ordem 119) em
-- public.get_gestor_contexto.
--
-- O DEFEITO
-- ---------
-- A autorizacao de troca de IES (podeTrocarIes) ja e correta: so admin e
-- gestor_grupo podem trocar. O problema e iesDisponiveis, que ate aqui era
-- preenchido por public.get_accessible_ies(v_uid) para QUALQUER papel que nao
-- fosse admin -- inclusive 'gestor' puro. get_accessible_ies enumera as IES
-- do(s) grupo(s) em que o usuario esta inscrito via user_groups, e nada no
-- schema impede um usuario com role 'gestor' (users.id_ies = A) de tambem
-- estar inscrito num user_groups cujo grupo cobre {A, B}. Esse estado nao e
-- hipotetico: e o resultado natural de downgrade de papel (gestor_grupo ->
-- gestor) sem limpar user_groups, e a UI de admin ja permite esse downgrade
-- hoje. Resultado: um gestor puro, que NAO pode trocar de IES (podeTrocarIes
-- = false, correto), recebia mesmo assim o id e o NOME da IES B no payload --
-- vazamento de existencia/identidade de uma IES que ele nao deveria enxergar,
-- mesmo que so como item de uma lista que a UI nao deixa ele selecionar.
--
-- A CORRECAO
-- ----------
-- iesDisponiveis passa a depender do papel, nao mais uniformemente de
-- get_accessible_ies:
--   - admin        -> todas as IES (inalterado);
--   - gestor_grupo -> get_accessible_ies(v_uid) (inalterado: e exatamente o
--                     papel para o qual essa funcao existe: multiplas IES);
--   - gestor       -> SOMENTE users.id_ies do proprio usuario. Nunca
--                     get_accessible_ies, independentemente do que user_groups
--                     contenha para ele.
-- v_ies_atual e sua resolucao (SELECT u.id_ies, fallback v_ies_list[1]) NAO
-- mudam: para 'gestor' isso ja apontava para users.id_ies, que agora tambem e
-- o unico elemento de v_ies_list -- coerente, nao redundante-quebrado.
--
-- PARTIU de supabase/migrations/20260729210000_get_gestor_contexto.sql (unica
-- migration desta funcao no repo). NENHUMA outra logica foi alterada: mesmo
-- SECURITY DEFINER, SET search_path, STABLE, guard de papel, guard de
-- feature (user_has_feature -- ver nota abaixo, NAO troca por
-- user_has_feature_for_ies), derivacao de v_papel, contrato, podeTrocarIes,
-- podeExportar, grants e assinatura () -> jsonb.
--
-- NOTA -- por que esta funcao NAO usa user_has_feature_for_ies: ela nao
-- recebe p_ies_id (enumera as IES do switcher antes do gestor escolher uma;
-- e a excecao explicita documentada em 20260804120000_user_has_feature_for_ies.sql).
-- O achado 2 (bool_or de user_has_feature sobre multiplas IES) nao se aplica
-- aqui do mesmo jeito que nas 9 RPCs de dado: esta funcao PRECISA responder
-- "o usuario tem o portal v2 em ALGUMA IES sua?" antes de saber qual IES ele
-- vai escolher. Continua com public.user_has_feature('gestao.portal_v2').
-- Nao trocar por engano numa proxima rodada.
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv): rodar
--   SELECT pg_get_functiondef('public.get_gestor_contexto()'::regprocsignature);
-- e comparar com o corpo de 20260729210000 assumido acima. Se divergir
-- (patch aplicado direto em prod fora do repo), ABORTAR e investigar antes de
-- rodar este arquivo -- nao sobrescrever um corpo que nao foi conferido.

CREATE OR REPLACE FUNCTION public.get_gestor_contexto()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid       uuid := auth.uid();
  v_papel     text;
  v_ies_list  uuid[];
  v_ies_atual uuid;
  v_result    jsonb;
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

  IF has_role(v_uid,'admin'::app_role) THEN
    v_papel := 'admin';
  ELSIF has_role(v_uid,'gestor_grupo'::app_role) THEN
    v_papel := 'gestor_grupo';
  ELSE
    v_papel := 'gestor';
  END IF;

  IF v_papel = 'admin' THEN
    SELECT COALESCE(array_agg(i.id ORDER BY i.nome), ARRAY[]::uuid[])
      INTO v_ies_list
    FROM public.ies i;
  ELSIF v_papel = 'gestor_grupo' THEN
    v_ies_list := COALESCE(public.get_accessible_ies(v_uid), ARRAY[]::uuid[]);
  ELSE
    -- papel = 'gestor': nunca pode trocar de IES (podeTrocarIes abaixo), logo
    -- iesDisponiveis so pode conter a IES do proprio cadastro. NUNCA
    -- get_accessible_ies aqui -- ver "O DEFEITO" no topo: um gestor puro pode
    -- estar (erroneamente ou nao) inscrito num user_groups multi-IES, e isso
    -- nao deve vazar para o payload de quem nao pode trocar.
    SELECT COALESCE(array_agg(u.id_ies), ARRAY[]::uuid[])
      INTO v_ies_list
    FROM public.users u
    WHERE u.id = v_uid AND u.id_ies IS NOT NULL;
  END IF;

  SELECT u.id_ies INTO v_ies_atual FROM public.users u WHERE u.id = v_uid;
  IF v_ies_atual IS NULL THEN
    v_ies_atual := v_ies_list[1];
  END IF;
  IF v_ies_atual IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'usuario', jsonb_build_object(
        'id',    v_uid,
        'nome',  COALESCE((SELECT u.nome FROM public.users u WHERE u.id = v_uid), 'Usuário'),
        'papel', v_papel
      ),
      'iesDisponiveis', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome) ORDER BY i.nome)
        FROM public.ies i
        WHERE i.id = ANY (v_ies_list)
      ), '[]'::jsonb),
      'iesAtual', (
        SELECT jsonb_build_object('id', i.id, 'nome', i.nome)
        FROM public.ies i WHERE i.id = v_ies_atual
      ),
      'contrato', (
        SELECT jsonb_build_object(
                 'nome',                 c.nome_contrato,
                 'simuladosContratados', c.simulados_contratados,
                 'vigencia',             to_char(c.vigencia_inicio,'DD/MM/YYYY') || ' — ' || to_char(c.vigencia_fim,'DD/MM/YYYY')
               )
        FROM public.ies_contrato_simulados c
        WHERE c.ies_id = v_ies_atual
        ORDER BY (current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim) DESC,
                 c.vigencia_fim DESC
        LIMIT 1
      ),
      'podeTrocarIes', (v_papel IN ('admin','gestor_grupo')),
      'podeExportar',  true
    ),
    'meta', jsonb_build_object(
      'periodo',     COALESCE((
                       SELECT to_char(c.vigencia_inicio,'DD/MM/YYYY') || ' — ' || to_char(c.vigencia_fim,'DD/MM/YYYY')
                       FROM public.ies_contrato_simulados c
                       WHERE c.ies_id = v_ies_atual
                       ORDER BY (current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim) DESC, c.vigencia_fim DESC
                       LIMIT 1
                     ), 'sem contrato cadastrado'),
      'fonte',       'users · user_roles · ies · educational_groups · ies_contrato_simulados',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',    'Papel derivado de user_roles (admin > gestor_grupo > gestor). IES disponíveis: todas para admin; get_accessible_ies (IES do grupo) para gestor_grupo; SOMENTE users.id_ies do próprio usuário para gestor puro, que nunca pode trocar de IES. Contrato: o vigente na data de hoje; se não houver vigente, o de vigência mais recente. podeExportar é true para os três papéis do portal.',
      'partial',     false,
      'lowSample',   false
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_contexto() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_contexto() TO authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICACAO (rodar manualmente em gvqv, autenticado como o usuario gestor
-- de teste -- nao como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
-- 1) Readback do corpo aplicado:
--    SELECT pg_get_functiondef('public.get_gestor_contexto()'::regprocsignature);
--
-- 2) Confirmar o cenario do achado (substituir :uid pelo id do gestor puro de
--    teste, que deve ter role 'gestor', users.id_ies = :ies_a, e estar
--    inscrito (via user_groups) num grupo que tambem cobre :ies_b):
--
--    SELECT u.id, u.id_ies, public.get_accessible_ies(u.id) AS ies_do_grupo
--    FROM public.users u WHERE u.id = :uid;
--    -- espera-se id_ies = :ies_a e ies_do_grupo contendo :ies_a E :ies_b
--
-- 3) Caso funcional, em transacao revertida, autenticado como esse gestor:
--
--    BEGIN;
--      SELECT public.get_gestor_contexto();
--      -- ESPERADO: data.podeTrocarIes = false (inalterado)
--      --           data.iesDisponiveis = [ { id: :ies_a, ... } ]  -- SO a
--      --           propria IES; :ies_b NAO aparece (antes desta migration
--      --           apareceriam as duas)
--      --           data.iesAtual.id = :ies_a
--    ROLLBACK;
--
-- 4) Confirmar que gestor_grupo e admin continuam inalterados: repetir o
--    passo 3 autenticado como um gestor_grupo com o mesmo grupo multi-IES --
--    ESPERADO: iesDisponiveis continua listando :ies_a e :ies_b (comportamento
--    preservado, so o papel 'gestor' puro muda).
