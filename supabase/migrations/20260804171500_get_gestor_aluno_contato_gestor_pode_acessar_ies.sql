-- 20260804171500_get_gestor_aluno_contato_gestor_pode_acessar_ies.sql
--
-- SUCEDE 20260804130300_get_gestor_aluno_contato_feature_por_ies.sql (achados 12 e 16,
-- card Ordem 116) e DEPENDE de 20260804160000_gestor_pode_acessar_ies.sql (achado 15,
-- card Ordem 119) ja existir. NAO edita nenhum dos dois arquivos.
--
-- POR QUE UMA MIGRATION NOVA E NAO UMA EDICAO
-- -------------------------------------------
-- 20260804130300 JA FOI APLICADA EM PRODUCAO (gvqv, 04/08 16:11). O Supabase registra
-- migration aplicada pelo PREFIXO da versao: editar o conteudo de um arquivo ja aplicado
-- faz o conteudo novo NUNCA rodar, em silencio. A correcao ficaria no repo com cara de
-- pronta e jamais chegaria ao produto. Toda correcao posterior nasce em arquivo novo, com
-- timestamp posterior. Sem excecao. Por isso este arquivo tambem tem que rodar DEPOIS de
-- 20260804160000 (que cria public.gestor_pode_acessar_ies) -- sem aquela funcao existindo,
-- o CREATE OR REPLACE abaixo falha na primeira chamada.
--
-- GAP 1 QUE ESTA MIGRATION FECHA -- achado 119 alcancando a "decima RPC"
-- ------------------------------------------------------------------------
-- A verificacao independente do card Ordem 119 (mesmo gap documentado em
-- 20260804160000) atinge esta funcao por um caminho que aquele arquivo ja antecipa na
-- secao "COMO CONSUMIR / 2) DECIMA RPC": get_gestor_aluno_contato NAO recebe p_ies_id --
-- resolve v_ies a partir do proprio aluno pedido -- mas autoriza com
--
--   public.user_can_access_ies(v_uid, v_ies)
--     -> ... ELSE _ies = ANY (public.get_accessible_ies(_user))
--
-- e get_accessible_ies e a UNIAO de users.id_ies COM as IES de todo grupo em que o usuario
-- aparece em user_groups -- SEM olhar o papel. Um usuario com role SO 'gestor'
-- (users.id_ies = A) que tenha ficado com linha orfa em user_groups apontando para um
-- grupo que cobre {A, B} (residuo de downgrade gestor_grupo -> gestor, que a UI de admin
-- permite hoje sem limpar user_groups) passa em user_can_access_ies para a IES B. A UI
-- nao oferece o switcher para esse gestor (podeTrocarIes = false) -- mas a UI nao e o
-- guard: um POST direto em /rest/v1/rpc/get_gestor_aluno_contato com o id de um aluno de
-- IES B (que tenha gestao.enabled ou gestao.portal_v2 ligada) devolve o TELEFONE desse
-- aluno, dado nominal, para um gestor que a propria interface diz que nao pode ver aquela
-- IES. Mesmo mecanismo, mesmo vetor, mesma causa raiz do card Ordem 119 -- so que faltava
-- fechar tambem nesta RPC porque ela nao tem p_ies_id e por isso nao faz parte das 9 RPCs
-- que 20260804160000 lista no bloco principal (ela e listada separadamente, como a
-- "decima RPC", com a troca de uma linha so).
--
-- A CORRECAO (gap 1): troca `user_can_access_ies(v_uid, v_ies)` por
-- `public.gestor_pode_acessar_ies(v_ies)`, exatamente como prescrito em
-- 20260804160000 / "COMO CONSUMIR / 2". NADA MAIS muda nessa linha: mesma posicao (depois
-- de resolver v_ies a partir do aluno, antes do guard de feature), mesma mensagem
-- ('aluno_nao_encontrado', generica de proposito para nao diferenciar "nao existe" de
-- "nao e seu" -- anti-enumeracao). admin e gestor_grupo nao regridem (gestor_pode_acessar_ies
-- e admin->true e gestor_grupo->get_accessible_ies, igual ao que user_can_access_ies ja
-- fazia para os dois papeis); so o gestor puro com user_groups orfao perde o acesso a IES
-- que nao e a sua -- que e o objetivo.
--
-- GAP 2, DIFERENTE, DA VERIFICACAO DESTE ROUND -- achados 12/16, card Ordem 116
-- ------------------------------------------------------------------------------
-- "o achado continua vivo mesmo com 20260804130300 aplicada: gestor de IES com
--  gestao.enabled=true e gestao.portal_v2=false ainda recebe o telefone do aluno,
--  enquanto get_gestor_aluno/get_gestor_alunos negam para a mesma pessoa -- o
--  gestao.portal_v2 continua nao sendo exigido." Rotulado pela verificacao como
-- PRIVACIDADE, nao inconsistencia cosmetica de flag.
--
-- O que 20260804130300 fechou: o vazamento CROSS-IES (bool_or de user_has_feature sobre
-- TODAS as IES acessiveis ao chamador, sem escopo). Depois daquela correcao, tanto a
-- autorizacao quanto o guard de feature sao avaliados contra v_ies = a IES do PROPRIO
-- ALUNO pedido -- nunca a de outra IES do portfolio do chamador. Isso ja estava fechado
-- ANTES desta migration e continua fechado aqui (o gap 1 acima estreita quem AUTORIZA
-- v_ies; nao toca o guard de feature).
--
-- O que continua abrindo, e que a verificacao aponta: dentro da MESMA IES do aluno, o
-- guard aceita `user_has_feature_for_ies('gestao.enabled', v_ies) OR
-- ...('gestao.portal_v2', v_ies)`, enquanto as 10 RPCs get_gestor_* (que servem a mesma
-- informacao em formato de lista/detalhe) exigem SOMENTE 'gestao.portal_v2'. Logo, para
-- um aluno de uma IES com gestao.enabled=true e gestao.portal_v2=false, o gestor recebe o
-- telefone por esta RPC mesmo que get_gestor_aluno/get_gestor_alunos, para o MESMO aluno,
-- respondam feature_not_enabled.
--
-- INVESTIGACAO -- por que isso NAO e corrigido nesta migration
-- --------------------------------------------------------------
-- Leitura de src/components/analytics/v2/shared/StudentAnalyticsDrawer.tsx e de
-- src/services/institutional.ts (fetchAlunoContato) confirma que esta RPC esta EM USO,
-- HOJE, EM PRODUCAO, exatamente nesse cenario: o Drawer e montado por
-- VisaoAlunosModule -> AlunosPage -> rota `/gestor/alunos`, que so fica no ar (via
-- LegacyGestorGate, ver src/features/gestor/portalV2Gates.tsx) precisamente para a IES
-- ATUAL do usuario cuja gestao.portal_v2 esta DESLIGADA -- ou seja, e o consumidor
-- legitimo do ramo 'gestao.enabled' do OR, e roda hoje sob gestao.enabled=true /
-- gestao.portal_v2=false, ponto por ponto o cenario que a verificacao aponta como vazando
-- (commit 360705e9 na main, anterior a esta branch).
--
-- As duas saidas estruturais que fechariam o gap sem essa colisao:
--   (a) manter as duas chaves aceitas, mas exigir que a IES do aluno tenha a MESMA chave
--       pela qual o CHAMADOR esta entrando na tela que originou a chamada -- exige um
--       sinal de "de onde a chamada partiu" (ex.: um p_origem/p_experiencia) que a RPC
--       hoje nao recebe e o front hoje nao envia;
--   (b) separar em dois caminhos por experiencia -- ex. get_gestor_aluno_contato (legado,
--       exige so gestao.enabled) e uma rota nova para o portal v2 (exige so
--       gestao.portal_v2), com o front chamando uma ou outra conforme a tela.
-- As duas exigem tocar o front (StudentAnalyticsDrawer / fetchAlunoContato) e, na (a),
-- tambem a assinatura da RPC -- nenhuma das duas cabe numa migration SQL isolada, e
-- nenhuma das duas pode ser adivinhada sem decisao de produto sobre o que a tela legada
-- deve continuar autorizando. Reduzir o guard SOMENTE a 'gestao.enabled' (descartando o
-- ramo 'gestao.portal_v2') nao fecha o gap 2 -- o ramo que vaza e exatamente o que sobra
-- -- e SOMENTE a 'gestao.portal_v2' quebra o Drawer em producao para toda IES ainda no
-- legado, que e a maioria hoje. Por isso o guard de feature desta funcao permanece
-- IDENTICO ao de 20260804130300 nesta migration: o gap 2 fica registrado como pendencia
-- (design (a) ou (b) acima), nao como correcao aplicada. O gap 1 (achado 119, autorizacao
-- por papel) e o maximo que este arquivo fecha com seguranca sem quebrar o Drawer.
--
-- PARTIU de supabase/migrations/20260804130300_get_gestor_aluno_contato_feature_por_ies.sql
-- (corpo em producao apos 04/08 16:11). NENHUMA outra logica foi alterada: mesma
-- SECURITY DEFINER, SET search_path, STABLE, guard de papel, aluno_obrigatorio, exclusao
-- de staff via user_roles, guard de feature (OR das duas chaves, por v_ies do aluno),
-- mensagem unica aluno_nao_encontrado, formato do retorno, grants e assinatura
-- (uuid) -> jsonb. Unica troca: a linha de autorizacao.
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv) -- rodar os tres readbacks e comparar com
-- o que este arquivo assume. Se QUALQUER um divergir, ABORTAR e investigar antes de rodar
-- este arquivo -- nao sobrescrever corpo que nao foi conferido:
--
--   -- (a) o helper de que esta migration depende deve existir com o corpo de 20260804160000:
--   SELECT pg_get_functiondef('public.gestor_pode_acessar_ies(uuid)'::regprocedure);
--
--   -- (b) o corpo ATUAL desta funcao deve ser identico ao de 20260804130300 (a troca e so
--   --     a linha de autorizacao -- se o corpo em prod ja divergir daquele, algum patch
--   --     direto foi aplicado fora do repo e precisa ser investigado antes):
--   SELECT pg_get_functiondef('public.get_gestor_aluno_contato(uuid)'::regprocsignature);
--
--   -- (c) sanidade do guard de feature usado por get_gestor_aluno_contato (achado 2) e
--   --     pelas 10 RPCs get_gestor_* (achado 119), para garantir que a tabela de
--   --     coerencia descrita acima nao ficou invalidada por mudanca em outra funcao:
--   SELECT pg_get_functiondef('public.user_has_feature_for_ies(text, uuid)'::regprocedure);

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

  -- GAP 1 (achado 119): trocado de user_can_access_ies(v_uid, v_ies) para
  -- gestor_pode_acessar_ies(v_ies). Mesma posicao, mesma mensagem generica
  -- (aluno_nao_encontrado -- anti-enumeracao preservada), unica troca desta migration.
  IF v_ies IS NULL OR NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'aluno_nao_encontrado' USING ERRCODE = '42501';
  END IF;

  -- GAP 2 (achado 12/16, card Ordem 116): guard INALTERADO nesta migration. Ver secao
  -- "GAP 2 ... por que isso NAO e corrigido nesta migration" no cabecalho -- fechar este
  -- OR sem quebrar o Drawer legado em producao exige sinal de origem da chamada ou duas
  -- rotas por experiencia, nenhuma das duas cabivel numa migration SQL isolada.
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
-- VERIFICACAO (rodar manualmente em gvqv, AUTENTICADO como o usuario de teste -- nao
-- como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
-- 0) Readback do corpo aplicado:
--    SELECT pg_get_functiondef('public.get_gestor_aluno_contato(uuid)'::regprocsignature);
--
-- 1) Montar/confirmar o cenario do gap 1 (:uid = gestor PURO de teste, users.id_ies =
--    :ies_a, com linha em user_groups apontando para grupo que cobre :ies_a E :ies_b;
--    :aluno_b = aluno com id_ies = :ies_b e SEM linha em user_roles; IES B com
--    gestao.enabled=true para que o cenario tambem passe pelo guard de feature e isole
--    o efeito da troca de autorizacao):
--
--    SELECT u.id, u.id_ies,
--           (SELECT array_agg(r.role) FROM public.user_roles r WHERE r.user_id = u.id) AS papeis,
--           public.get_accessible_ies(u.id) AS ies_do_grupo
--    FROM public.users u WHERE u.id = :uid;
--    -- ESPERADO: papeis = {gestor}, id_ies = :ies_a, ies_do_grupo contendo :ies_a E :ies_b
--
-- 2) A prova do gap 1 e da correcao, lado a lado, autenticado como esse gestor:
--
--    SELECT public.user_can_access_ies(:uid::uuid, :ies_b::uuid) AS antigo_libera_b,
--           public.gestor_pode_acessar_ies(:ies_b::uuid)         AS novo_nega_b,
--           public.gestor_pode_acessar_ies(:ies_a::uuid)         AS novo_libera_a;
--    -- ESPERADO: antigo_libera_b = true (o gap), novo_nega_b = false (correcao),
--    --           novo_libera_a = true (caso legitimo preservado)
--
-- 3) Caso funcional, em transacao revertida, autenticado como o gestor puro:
--
--    BEGIN;
--      SELECT public.get_gestor_aluno_contato(:aluno_b::uuid);
--      -- ESPERADO AGORA: RAISE 'aluno_nao_encontrado' (antes: devolvia o telefone, porque
--      -- user_can_access_ies liberava IES B via user_groups orfao)
--      SELECT public.get_gestor_aluno_contato(:aluno_a::uuid);
--      -- ESPERADO: retorna jsonb com telefone normalmente (aluno da propria IES,
--      -- comportamento inalterado)
--    ROLLBACK;
--
-- 4) Nao regressao de gestor_grupo (autenticado como um gestor_grupo do MESMO grupo
--    multi-IES, cobrindo :ies_a e :ies_b):
--
--    BEGIN;
--      SELECT public.get_gestor_aluno_contato(:aluno_a::uuid); -- ESPERADO: telefone normal
--      SELECT public.get_gestor_aluno_contato(:aluno_b::uuid); -- ESPERADO: telefone normal
--    ROLLBACK;
--
-- 5) Nao regressao de admin (autenticado como admin): mesmas duas chamadas do item 4,
--    ambas devem retornar telefone normalmente (bypass preservado).
--
-- 6) Fail-closed de professor (autenticado como um 'professor'):
--
--    SELECT public.get_gestor_aluno_contato(:aluno_a::uuid);
--    -- ESPERADO: RAISE 'Access denied' (guard de papel, inalterado por esta migration)
--
-- 7) Status do gap 2 (card Ordem 116) -- CONFIRMAR QUE PERMANECE AQUEM DO FECHAMENTO,
--    documentado, nao uma regressao introduzida por este arquivo. Cenario: IES C com
--    gestao.enabled=true E gestao.portal_v2=false; :aluno_c com id_ies = :ies_c;
--    :uid_c = gestor (papel correto, sem user_groups orfao) da propria IES C:
--
--    SELECT public.get_gestor_aluno_contato(:aluno_c::uuid) AS contato,      -- ESPERADO: telefone (via ramo gestao.enabled do OR)
--           public.user_has_feature_for_ies('gestao.portal_v2', :ies_c::uuid) AS portal_v2_c; -- ESPERADO: false
--    -- Comparar com get_gestor_aluno(:ies_c, :aluno_c, NULL) na mesma sessao: ESPERADO
--    -- 'feature_not_enabled' (aquela RPC exige SOMENTE gestao.portal_v2). A divergencia
--    -- entre os dois resultados E O GAP 2 -- preservado deliberadamente para nao quebrar
--    -- o Drawer legado (StudentAnalyticsDrawer, gestao.enabled). Ver pendencia no
--    -- cabecalho para o desenho (a)/(b) que fecharia isto.
