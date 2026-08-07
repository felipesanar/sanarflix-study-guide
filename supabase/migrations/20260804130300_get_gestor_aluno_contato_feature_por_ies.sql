-- 20260804130300_get_gestor_aluno_contato_feature_por_ies.sql
--
-- Endereca os achados 12 e 16 da revisao adversarial de 03/08 (card Ordem 116)
-- em public.get_gestor_aluno_contato.
--
-- O DEFEITO
-- ---------
-- O guard aceitava user_has_feature('gestao.enabled') OR user_has_feature
-- ('gestao.portal_v2') -- SEM NUNCA passar por uma IES especifica. Como
-- user_has_feature bool_or sobre TODAS as IES acessiveis ao usuario
-- (get_accessible_ies) quando users.id_ies e null, um gestor_grupo com
-- QUALQUER IES no portfolio tendo gestao.enabled=true OU gestao.portal_v2=true
-- destrava o telefone de aluno de QUALQUER OUTRA IES do mesmo portfolio --
-- inclusive uma IES onde NENHUMA das duas features esta ligada. A
-- autorizacao por IES (user_can_access_ies) so confere se o aluno pedido esta
-- no portfolio do gestor; ela nunca checou se aquela IES especifica tem
-- QUALQUER produto de gestor habilitado. Dado nominal (telefone) vazando por
-- uma checagem de feature que nao e por IES.
--
-- A INSTRUCAO ORIGINAL DESTE CARD E POR QUE NAO FOI SEGUIDA AO PE DA LETRA
-- -------------------------------------------------------------------------
-- O pedido inicial era "restrinja ao portal v2" (remover o branch
-- gestao.enabled do OR). Antes de aplicar, foi lido o consumidor real:
-- src/components/analytics/v2/shared/StudentAnalyticsDrawer.tsx chama
-- fetchAlunoContato -> esta RPC, e esse Drawer e usado por
-- src/components/analytics/v2/modules/VisaoAlunosModule.tsx, que por sua vez
-- e usado em DOIS lugares:
--   1. src/experiences/gestor/pages/AlunosPage.tsx, rota `/gestor/alunos`
--      registrada em src/experiences/gestor/gestorRoutes.tsx com o gate
--      GestorFeatureGate featureKey="gestao.alunos" (sub-feature do master
--      gestao.enabled) -- e essa arvore de rotas legada e reusada dentro de
--      src/features/gestor/gestorV2Routes.tsx como `telasLegadas`, embrulhada
--      em <LegacyGestorGate>, que so a mantem no ar quando gestao.portal_v2
--      esta DESLIGADA para a IES atual do usuario (ver
--      src/features/gestor/portalV2Gates.tsx). Ou seja: em produção,
--      `/gestor/alunos` -- e portanto esta RPC -- e alcançavel HOJE
--      precisamente pelos gestores cuja IES NAO esta no piloto do v2, sob
--      gestao.enabled.
--   2. src/pages/DesempenhoInstitucionalV2.tsx, que importa
--      ModuleContentRenderer -> VisaoAlunosModule. Esta pagina NAO esta
--      registrada em nenhuma arvore de rotas (nem gestorRoutes, nem
--      gestorV2Routes -- as duas rotas antigas, /desempenho-institucional e
--      /desempenho-institucional-v2, so fazem <Navigate to="/gestor" />).
--      E' codigo orfao, nao servido.
-- As paginas proprias do portal v2 (src/features/gestor/routes/VisaoGeral.tsx,
-- Detalhamento.tsx, Inicio.tsx) NAO chamam fetchAlunoContato nem montam o
-- StudentAnalyticsDrawer -- nao existe hoje nenhum consumidor legitimo que
-- precise do branch 'gestao.portal_v2' deste OR. Trocar o guard para exigir
-- SOMENTE gestao.portal_v2 teria quebrado, em produção, a unica tela viva que
-- usa esta RPC (`/gestor/alunos` legado, que roda sob gestao.enabled) sem
-- destravar nenhuma tela nova em troca. Por isso este card cai na clausula do
-- proprio brief: "se a restricao quebrar o uso legitimo, proponha o desenho
-- correto em vez de quebrar produção" -- ver "pendencias" no retorno desta
-- tarefa para o registro dessa decisao.
--
-- A CORRECAO REAL
-- ---------------
-- O problema nao e QUAL feature o OR aceita -- e que NENHUM dos dois lados do
-- OR era avaliado contra a IES do aluno pedido. A correcao preserva o mesmo
-- OR (gestao.enabled OR gestao.portal_v2 -- mantendo tanto o consumidor legado
-- vivo quanto a porta aberta para o v2 reusar, exatamente como a funcao foi
-- desenhada) mas cada lado passa a usar
-- public.user_has_feature_for_ies(<chave>, v_ies) com v_ies = a IES do PROPRIO
-- ALUNO pedido (resolvida do registro de public.users, nao de um parametro --
-- esta funcao nao recebe p_ies_id). Isso fecha o vazamento entre IES do mesmo
-- portfolio (nenhuma das duas checagens usa mais get_accessible_ies/bool_or)
-- sem tirar acesso de nenhum caminho hoje legitimo: para o gestor do
-- `/gestor/alunos` legado, o aluno exibido ja pertence a uma IES com
-- gestao.enabled=true (e' a mesma IES que a tela esta consultando), logo
-- user_has_feature_for_ies('gestao.enabled', v_ies) continua true do mesmo
-- jeito que user_has_feature('gestao.enabled') continuava. So passa a
-- BLOQUEAR o caso que nao tinha uso legitimo: aluno de uma IES SEM nenhuma das
-- duas features, alcançado só porque outra IES do portfolio do gestor as tem.
--
-- Ordem do preambulo foi reordenada: papel (Access denied) -> aluno_obrigatorio
-- -> resolve v_ies e telefone a partir do proprio p_aluno_id -> autorizacao
-- (user_can_access_ies, mesma mensagem aluno_nao_encontrado de antes, sem
-- diferenciar "nao existe" de "nao e seu" -- anti-enumeracao preservada) ->
-- feature por IES. A checagem de feature so acontece DEPOIS da autorizacao,
-- entao nunca revela nada sobre um aluno fora do portfolio do chamador; so
-- informa, para um aluno que ja e seu, se aquela IES especifica tem
-- gestor habilitado -- informacao que a UI do proprio gestor ja deriva de
-- get_gestor_contexto/feature flags.
--
-- PARTIU de supabase/migrations/20260731143924_b020effc-e15e-4188-afb0-ded8ad6bf464.sql
-- (unica migration desta funcao no repo). NENHUMA outra logica foi alterada:
-- mesma SECURITY DEFINER, SET search_path, STABLE, guard de papel,
-- aluno_obrigatorio, exclusao de staff via user_roles, mensagem unica
-- aluno_nao_encontrado, formato do retorno, grants e assinatura
-- (uuid) -> jsonb.
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv): rodar
--   SELECT pg_get_functiondef('public.get_gestor_aluno_contato(uuid)'::regprocsignature);
-- e comparar com o corpo de 20260731143924 assumido acima. Se divergir
-- (patch aplicado direto em prod fora do repo), ABORTAR e investigar antes de
-- rodar este arquivo -- nao sobrescrever um corpo que nao foi conferido.

CREATE OR REPLACE FUNCTION public.get_gestor_aluno_contato(p_aluno_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_ies      uuid;
  v_telefone text;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_aluno_id IS NULL THEN
    RAISE EXCEPTION 'aluno_obrigatorio' USING ERRCODE = '22023';
  END IF;

  SELECT u.id_ies, u.telefone
    INTO v_ies, v_telefone
  FROM public.users u
  WHERE u.id = p_aluno_id
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id);

  IF v_ies IS NULL OR NOT public.user_can_access_ies(v_uid, v_ies) THEN
    RAISE EXCEPTION 'aluno_nao_encontrado' USING ERRCODE = '42501';
  END IF;

  IF NOT (
       public.user_has_feature_for_ies('gestao.enabled', v_ies)
    OR public.user_has_feature_for_ies('gestao.portal_v2', v_ies)
  ) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'id',       p_aluno_id,
    'telefone', v_telefone
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_aluno_contato(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_aluno_contato(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICACAO (rodar manualmente em gvqv, autenticado como o usuario gestor
-- de teste -- nao como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
-- 1) Readback do corpo aplicado:
--    SELECT pg_get_functiondef('public.get_gestor_aluno_contato(uuid)'::regprocsignature);
--
-- 2) Confirmar o cenario do achado (gestor_grupo com users.id_ies IS NULL,
--    portfolio cobrindo IES A com gestao.enabled=true e IES C SEM NENHUMA
--    feature de gestor ligada; :aluno_c = um aluno com id_ies = :ies_c):
--
--    SELECT u.id, u.id_ies, public.get_accessible_ies(u.id) AS portfolio
--    FROM public.users u WHERE u.id = :uid;
--    -- espera-se id_ies IS NULL e portfolio contendo :ies_a e :ies_c
--
--    SELECT f.ies_id, i.nome, f.feature_key, f.enabled
--    FROM public.ies_features f JOIN public.ies i ON i.id = f.ies_id
--    WHERE f.ies_id IN (:ies_a, :ies_c)
--      AND f.feature_key IN ('gestao.enabled','gestao.portal_v2')
--    ORDER BY i.nome, f.feature_key;
--    -- espera-se IES A com gestao.enabled=true; IES C sem linha (ou false)
--    -- para as duas chaves
--
-- 3) A prova do defeito e da correcao, lado a lado, autenticado como :uid:
--
--    SELECT (public.user_has_feature('gestao.enabled')
--            OR public.user_has_feature('gestao.portal_v2'))     AS antigo_vaza_para_c,
--           public.user_can_access_ies(:uid::uuid, :ies_c::uuid) AS autorizado_para_c;
--    -- ESPERADO: antigo_vaza_para_c = true (bug: bool_or pegou a IES A) e
--    -- autorizado_para_c = true (:ies_c esta no portfolio) -- ou seja, ANTES
--    -- desta migration, get_gestor_aluno_contato(:aluno_c) retornava o
--    -- telefone.
--
-- 4) Caso funcional, em transacao revertida:
--
--    BEGIN;
--      SELECT public.get_gestor_aluno_contato(:aluno_c::uuid);
--      -- ESPERADO AGORA: RAISE 'feature_not_enabled' (IES C nao tem nenhuma
--      -- feature de gestor ligada, e a checagem passou a ser por IES)
--    ROLLBACK;
--
-- 5) Caso legitimo preservado (aluno de IES A, onde gestao.enabled=true):
--
--    BEGIN;
--      SELECT public.get_gestor_aluno_contato(:aluno_a::uuid);
--      -- ESPERADO: retorna jsonb com telefone normalmente -- comportamento
--      -- inalterado para quem a funcao ja servia corretamente hoje
--      -- (`/gestor/alunos` legado, gestao.enabled na IES do proprio aluno).
--    ROLLBACK;
