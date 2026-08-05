-- 20260804160000_gestor_pode_acessar_ies.sql
--
-- SUCEDE 20260804130200_get_gestor_contexto_ies_disponiveis_por_papel.sql (achado 15,
-- card Ordem 119). NAO edita aquele arquivo, nem nenhum outro de 04/08.
--
-- POR QUE UMA MIGRATION NOVA E NAO UMA EDICAO
-- -------------------------------------------
-- As migrations de 04/08 JA FORAM APLICADAS EM PRODUCAO (gvqv, 04/08 16:11). O Supabase
-- registra migration aplicada pelo PREFIXO da versao: editar o conteudo de um arquivo ja
-- aplicado faz o conteudo novo NUNCA rodar, em silencio. A correcao ficaria no repo com
-- cara de pronta e jamais chegaria ao produto. Toda correcao posterior nasce em arquivo
-- novo, com timestamp posterior. Sem excecao.
--
-- O GAP QUE ESTA MIGRATION FECHA
-- ------------------------------
-- A verificacao independente das 21 correcoes de 04/08 constatou que o card Ordem 119
-- ficou INCOMPLETO:
--
--   "Um usuario com papel so `gestor` e linha orfa em `user_groups` continua conseguindo
--    chamar qualquer das 10 RPCs com `p_ies_id` da outra IES e receber dado nominal de
--    aluno — a correcao fechou apenas o vazamento de identidade da IES no payload do
--    contexto."
--
-- Ou seja: 20260804130200 corrigiu `iesDisponiveis` em get_gestor_contexto (o gestor puro
-- deixou de VER o id/nome da IES irma no switcher), mas nao tocou na AUTORIZACAO das 10
-- RPCs que servem dado. Essas RPCs autorizam por
--
--   public.user_can_access_ies(v_uid, p_ies_id)
--     -> ... ELSE _ies = ANY (public.get_accessible_ies(_user))
--
-- e public.get_accessible_ies e a UNIAO de users.id_ies COM as IES de todo grupo em que o
-- usuario aparece em user_groups -- SEM olhar o papel:
--
--   SELECT id_ies FROM users WHERE id = _user AND id_ies IS NOT NULL
--   UNION
--   SELECT gi.ies_id FROM user_groups ug JOIN group_ies gi ON gi.group_id = ug.group_id
--   WHERE ug.user_id = _user
--
-- Logo, um usuario com role SO 'gestor' (users.id_ies = A) que tenha ficado com linha em
-- user_groups apontando para um grupo que cobre {A, B} passa em user_can_access_ies para a
-- IES B. A UI nao oferece o switcher (podeTrocarIes = false) e desde 20260804130200 nem
-- lista a IES B -- mas a UI nao e o guard: um POST direto em
-- /rest/v1/rpc/get_gestor_alunos com p_ies_id = B devolve nome, semestre e desempenho
-- individual dos alunos da IES B.
--
-- O vetor NAO e hipotetico: e o resultado natural de downgrade de papel
-- (gestor_grupo -> gestor) sem limpar user_groups, e a UI de admin permite esse downgrade
-- hoje. user_groups fica orfao e vira permissao residual.
--
-- POR QUE NAO CORRIJO get_accessible_ies NEM user_can_access_ies
-- --------------------------------------------------------------
-- A causa raiz esta nas duas, e mesmo assim NENHUMA DAS DUAS E ALTERADA AQUI --
-- deliberadamente. Elas sao infraestrutura compartilhada, em producao, com escopo muito
-- maior que este card:
--
--   * get_accessible_ies e chamada por >= 10 RLS POLICIES vivas (todas as
--     "Gestor de grupo pode ver ..."): resultados_alunos_tri, resultados_ies_tri,
--     answer_progress, simulados_admin, simulados_finalizados, questoes_simulado e users
--     (migrations 20260603181804, 20260624125202, 20260701133641). Estreitar o corpo dela
--     mudaria, de uma vez, o que o gestor_grupo LE via RLS em sete tabelas.
--   * user_can_access_ies aparece em ~80 call sites no repo, incluindo as RPCs
--     institucionais do console legado (get_institutional_performance, _evolution,
--     _tri, _student_scores, _simulados, get_student_growth_tri, ...).
--
-- Mexer no corpo delas seria alterar autorizacao que ja esta em producao e que nao tem a
-- ver com este card -- exatamente o tipo de mudanca que quebra o console legado por efeito
-- colateral. Em vez disso: funcao NOVA e ADITIVA, com a regra de papel que este card exige,
-- consumida SO pelas RPCs do portal do gestor v2. Mesma estrategia (e mesmo motivo) de
-- 20260804120000_user_has_feature_for_ies.sql, que criou uma funcao nova em vez de tocar
-- public.user_has_feature.
--
-- GAP RESIDUAL, MESMA CAUSA RAIZ, FORA DESTE CARD -- NAO PERDER
-- -------------------------------------------------------------
-- Esta funcao fecha o vetor RPC. A causa raiz (get_accessible_ies ignora o papel) tem OUTRA
-- superficie, que esta migration deliberadamente NAO toca porque sao RLS policies em
-- producao, alheias a este card: DUAS policies escopadas ao papel 'gestor' -- nao
-- 'gestor_grupo' -- tambem chamam get_accessible_ies (migration 20260624125202):
--
--   "Gestor pode ver simulados da sua IES"  ON public.simulados_admin
--       USING ( has_role(auth.uid(),'gestor') AND (ies_ids && get_accessible_ies(auth.uid())) )
--   "Gestor pode ver questoes da sua IES"   ON public.questoes_simulado
--       USING ( has_role(auth.uid(),'gestor') AND EXISTS (... sa.ies_ids && get_accessible_ies(...)) )
--
-- Para o MESMO gestor puro com user_groups orfao, essas duas concedem SELECT direto (REST,
-- sem RPC) nos simulados exclusivos da IES B e nas questoes deles. Severidade menor que o
-- vetor RPC -- e catalogo institucional, nao dado nominal de aluno, e simulado compartilhado
-- entre A e B ja era visivel de forma legitima pelo operador && -- mas e a mesma falha.
-- As policies "Gestor de grupo pode ver ..." NAO tem esse problema: sao gateadas em
-- has_role('gestor_grupo'), que o gestor puro nao tem. Registrado como pendencia; corrigir
-- exige decisao sobre as policies (ou sobre get_accessible_ies), nao sobre esta funcao.
--
-- A REGRA, POR PAPEL
-- ------------------
--   admin        -> true. Bypass existente, PRESERVADO de proposito (mesma razao escrita no
--                   bloco "DECISAO JA TOMADA" de 20260804120000): o achado e sobre 'gestor',
--                   nao sobre admin, e remover o bypass agora derrubaria o acesso do admin
--                   ao portal v2 no meio da implementacao. user_can_access_ies tambem
--                   bypassa admin hoje -- nao ha regressao nem afrouxamento novo.
--   gestor_grupo -> p_ies_id em get_accessible_ies(uid). Comportamento ATUAL, e correto:
--                   gestor_grupo e precisamente o papel que existe para operar multiplas
--                   IES, e o grupo e a fonte legitima dessa lista.
--   gestor       -> p_ies_id deve ser EXATAMENTE users.id_ies. Linha em user_groups NAO
--                   amplia o acesso de quem nao pode trocar de IES. Este e o unico ponto em
--                   que a funcao difere de user_can_access_ies, e e o gap.
--   outros       -> false (fail-closed).
--
-- PRECEDENCIA: admin > gestor_grupo > gestor, avaliada nessa ordem. E a MESMA precedencia
-- da derivacao de v_papel em get_gestor_contexto (20260804130200, linhas 84-90). Um usuario
-- que acumule 'gestor' e 'gestor_grupo' e tratado como gestor_grupo nos dois lugares.
--
-- COERENCIA COM podeTrocarIes (exigencia do card) -- CONFERIDA, SEM DIVERGENCIA
-- ----------------------------------------------------------------------------
-- get_gestor_contexto devolve podeTrocarIes = (v_papel IN ('admin','gestor_grupo')) e, desde
-- 20260804130200, monta iesDisponiveis por papel. O conjunto autorizado por esta funcao e
-- IGUAL ao iesDisponiveis daquela funcao, papel por papel:
--
--   papel        | iesDisponiveis (20260804130200)   | gestor_pode_acessar_ies -> true para
--   -------------+-----------------------------------+--------------------------------------
--   admin        | todas as IES (SELECT FROM ies)    | qualquer IES
--   gestor_grupo | get_accessible_ies(uid)           | membro de get_accessible_ies(uid)
--   gestor       | {users.id_ies}                    | exatamente users.id_ies
--
-- Isto e o invariante que o card pede: se a UI diz que a pessoa nao troca de IES, o servidor
-- nega IES diferente. A UI e o servidor passam a derivar do MESMO criterio, nao de dois.
--
-- NOTA sobre 'atendimento': user_has_feature_for_ies bypassa admin E atendimento, esta
-- funcao bypassa SO admin. Nao e inconsistencia: aquela responde "a feature esta ligada?",
-- esta responde "este usuario pode ver esta IES?". As 10 RPCs get_gestor_* ja barram
-- atendimento no guard de papel (admin/gestor/gestor_grupo), entao incluir atendimento aqui
-- alargaria autorizacao sem nenhum caminho de chamada que a use. Nao "uniformizar" depois.
--
-- ESCOPO: esta funcao responde "este usuario pode ver ESTA IES?" e NAO "a feature esta
-- ligada para esta IES?". As duas perguntas continuam separadas e as duas continuam
-- obrigatorias em cada RPC. Nao troque uma pela outra.
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv)
-- ---------------------------------------------
-- Rodar os tres readbacks abaixo e comparar com o que este arquivo assume. Se QUALQUER um
-- divergir (patch aplicado direto em prod, fora do repo), ABORTAR e investigar antes de
-- rodar este arquivo:
--
--   -- (a) a funcao nova nao pode ja existir com outro corpo:
--   SELECT p.oid::regprocedure, pg_get_functiondef(p.oid)
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'gestor_pode_acessar_ies';
--   -- ESPERADO: 0 linhas. Se vier 1 linha, comparar corpo antes de sobrescrever.
--
--   -- (b) as duas funcoes de que esta depende / que NAO devem ser tocadas:
--   SELECT pg_get_functiondef('public.get_accessible_ies(uuid)'::regprocedure);
--   -- ESPERADO: identico ao corpo de 20260525145930 (UNION users.id_ies + user_groups)
--   SELECT pg_get_functiondef('public.user_can_access_ies(uuid,uuid)'::regprocedure);
--   -- ESPERADO: identico ao corpo de 20260603174512 (sem o atalho de b2b_partner)
--
--   -- (c) a funcao com que a coerencia e afirmada:
--   SELECT pg_get_functiondef('public.get_gestor_contexto()'::regprocsignature);
--   -- ESPERADO: corpo de 20260804130200, com
--   --   'podeTrocarIes', (v_papel IN ('admin','gestor_grupo'))
--   -- e o ELSE de iesDisponiveis lendo SOMENTE users.id_ies. Se podeTrocarIes tiver mudado
--   -- de regra em prod, a tabela de coerencia acima esta invalidada -- PARAR.

CREATE OR REPLACE FUNCTION public.gestor_pode_acessar_ies(p_ies_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid     uuid := auth.uid();
  v_own_ies uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Fail-closed para IES nula, igual a user_can_access_ies (WHEN _ies IS NULL THEN false).
  -- Quem chama resolve v_ies ANTES e passa v_ies -- ver "COMO CONSUMIR" no fim do arquivo.
  IF p_ies_id IS NULL THEN
    RETURN false;
  END IF;

  -- admin: bypass preservado. Ver "A REGRA, POR PAPEL" no topo -- decisao explicita.
  IF public.has_role(v_uid, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  -- gestor_grupo ANTES de gestor: mesma precedencia (admin > gestor_grupo > gestor) da
  -- derivacao de v_papel em get_gestor_contexto. Quem acumula os dois papeis e gestor_grupo
  -- nos dois lugares -- e o que mantem podeTrocarIes e esta funcao coerentes.
  IF public.has_role(v_uid, 'gestor_grupo'::public.app_role) THEN
    RETURN p_ies_id = ANY (COALESCE(public.get_accessible_ies(v_uid), ARRAY[]::uuid[]));
  END IF;

  -- gestor puro: SOMENTE a IES do proprio cadastro. NUNCA get_accessible_ies aqui -- e
  -- exatamente o gap: uma linha orfa em user_groups (residuo de downgrade gestor_grupo ->
  -- gestor) nao pode ampliar o acesso de quem a UI diz que nao troca de IES.
  IF public.has_role(v_uid, 'gestor'::public.app_role) THEN
    SELECT u.id_ies
      INTO v_own_ies
    FROM public.users u
    WHERE u.id = v_uid;

    RETURN v_own_ies IS NOT NULL AND p_ies_id = v_own_ies;
  END IF;

  -- Qualquer outro papel (professor, atendimento, aluno, sem papel): fail-closed.
  RETURN false;
END;
$fn$;

REVOKE ALL ON FUNCTION public.gestor_pode_acessar_ies(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gestor_pode_acessar_ies(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.gestor_pode_acessar_ies(uuid) IS
'Autorizacao de IES para o portal do gestor v2, por papel: admin -> qualquer IES; gestor_grupo -> IES de get_accessible_ies; gestor -> SOMENTE users.id_ies (linha orfa em user_groups nao amplia acesso); outros -> false. Use no lugar de user_can_access_ies nas 10 RPCs get_gestor_*. Mesma regra que decide podeTrocarIes em get_gestor_contexto. NAO substitui o guard de feature (user_has_feature_for_ies). Achado 15 / card Ordem 119, gap remanescente apos 20260804130200.';

-- ---------------------------------------------------------------------------
-- COMO CONSUMIR NAS 10 RPCs -- LEIA ANTES DE SUBSTITUIR
-- ---------------------------------------------------------------------------
-- Assinatura: public.gestor_pode_acessar_ies(p_ies_id uuid) RETURNS boolean
-- UM parametro. NAO recebe o uid: resolve auth.uid() por dentro, como
-- user_has_feature_for_ies e AO CONTRARIO de user_can_access_ies(_user, _ies).
-- Nao passe v_uid -- nao existe sobrecarga de dois argumentos.
--
-- 1) NOVE RPCs com p_ies_id
--    (get_gestor_visao_geral, get_gestor_alunos, get_gestor_aluno, get_gestor_avisos,
--     get_gestor_cronograma, get_gestor_detalhamento, get_gestor_diagnostico,
--     get_gestor_diagnostico_temas, get_gestor_questoes)
--
--    HOJE (em producao, apos 04/08) o preambulo e:
--
--      IF NOT ( has_role(v_uid,'admin') OR has_role(v_uid,'gestor')
--               OR has_role(v_uid,'gestor_grupo') ) THEN
--        RAISE EXCEPTION 'Access denied';
--      END IF;
--
--      IF p_ies_id IS NOT NULL THEN
--        IF NOT public.user_can_access_ies(v_uid, p_ies_id) THEN     -- <<< o gap
--          RAISE EXCEPTION 'Permission denied: cannot access this IES';
--        END IF;
--        v_ies := p_ies_id;
--      ELSE
--        SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
--        IF v_ies IS NULL THEN
--          v_ies := (public.get_accessible_ies(v_uid))[1];           -- <<< o mesmo gap
--        END IF;
--      END IF;
--      IF v_ies IS NULL THEN RAISE EXCEPTION 'IES not resolved'; END IF;
--
--      IF NOT public.user_has_feature_for_ies('gestao.portal_v2', v_ies) THEN
--        RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
--      END IF;
--
--    PASSA A SER (copiar VERBATIM -- as duas ocorrencias do gap fecham num unico guard):
--
--      IF NOT ( has_role(v_uid,'admin') OR has_role(v_uid,'gestor')
--               OR has_role(v_uid,'gestor_grupo') ) THEN
--        RAISE EXCEPTION 'Access denied';
--      END IF;
--
--      -- resolucao de v_ies (ainda NAO autoriza)
--      IF p_ies_id IS NOT NULL THEN
--        v_ies := p_ies_id;
--      ELSE
--        SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
--        IF v_ies IS NULL THEN
--          v_ies := (public.get_accessible_ies(v_uid))[1];
--        END IF;
--      END IF;
--      IF v_ies IS NULL THEN
--        RAISE EXCEPTION 'IES not resolved';
--      END IF;
--
--      -- autorizacao da IES RESOLVIDA, por papel
--      IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
--        RAISE EXCEPTION 'Permission denied: cannot access this IES';
--      END IF;
--
--      IF NOT public.user_has_feature_for_ies('gestao.portal_v2', v_ies) THEN
--        RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
--      END IF;
--
--    ORDEM FINAL DO PREAMBULO -- nao inventar outra, seis RPCs precisam bater:
--      papel (Access denied) -> resolucao de v_ies -> IES not resolved
--      -> autorizacao (Permission denied: cannot access this IES)
--      -> feature (feature_not_enabled).
--
--    PORQUE O GUARD VAI PARA DEPOIS DA RESOLUCAO, E NAO DENTRO DO IF:
--    o guard antigo so cobria o ramo p_ies_id IS NOT NULL. O ramo ELSE cai em
--    (get_accessible_ies(v_uid))[1], que para um gestor puro com users.id_ies NULL e
--    user_groups orfao devolve uma IES do GRUPO -- o mesmo vazamento, por outra porta, sem
--    p_ies_id nenhum. Autorizar v_ies (o valor que a query vai de fato usar) fecha os dois
--    ramos com um unico IF. Nada e emitido antes do guard, entao continua negando antes de
--    revelar qualquer coisa sobre a IES.
--
--    NAO manter as duas chamadas. O conjunto autorizado por gestor_pode_acessar_ies e
--    subconjunto do de user_can_access_ies em todos os papeis (admin: ambos true;
--    gestor_grupo: identico; gestor: {users.id_ies} ⊂ get_accessible_ies, porque
--    get_accessible_ies e a UNIAO que inclui users.id_ies). Logo a troca so NEGA casos --
--    que e o objetivo -- e nunca LIBERA um caso que hoje e negado. Deixar user_can_access_ies
--    junto seria redundante e faria parecer que ainda ha uma regra a mais.
--
--    NAO alterar a mensagem 'Permission denied: cannot access this IES': o front-end mapeia
--    essa string. Mudar o texto quebraria o tratamento de erro sem trocar nada de seguranca.
--
-- 2) DECIMA RPC: get_gestor_aluno_contato(p_aluno_id) -- NAO TEM p_ies_id
--    Ela deriva v_ies do aluno pedido e autoriza no mesmo IF, com mensagem propria
--    (aluno_nao_encontrado, para nao confirmar a existencia do aluno). So trocar a funcao,
--    preservando estrutura e mensagem:
--
--      -- ANTES
--      IF v_ies IS NULL OR NOT public.user_can_access_ies(v_uid, v_ies) THEN
--        RAISE EXCEPTION 'aluno_nao_encontrado' USING ERRCODE = '42501';
--      END IF;
--
--      -- DEPOIS
--      IF v_ies IS NULL OR NOT public.gestor_pode_acessar_ies(v_ies) THEN
--        RAISE EXCEPTION 'aluno_nao_encontrado' USING ERRCODE = '42501';
--      END IF;
--
--    Aqui NAO reordenar nada: o guard ja esta depois da resolucao de v_ies, e a mensagem
--    generica e intencional (achado do card do contato). O guard de feature dessa RPC
--    (gestao.enabled OR gestao.portal_v2) fica onde esta, DEPOIS deste IF.
--
-- 3) get_gestor_contexto() -- NAO CONSOME esta funcao. Ela nao recebe p_ies_id: enumera as
--    IES do switcher antes de o gestor escolher uma, e ja aplica a regra por papel
--    diretamente (20260804130200). Chamar gestor_pode_acessar_ies ali seria circular. Nao
--    "uniformizar".
--
-- 4) NAO usar esta funcao nas RPCs institucionais do console legado
--    (get_institutional_*, get_student_growth_tri, get_theme_evolution, ...). Elas admitem
--    'professor' no guard de papel, e esta funcao e fail-closed para professor: a troca
--    derrubaria o console legado. Elas continuam com user_can_access_ies.

-- ---------------------------------------------------------------------------
-- VERIFICACAO (rodar manualmente em gvqv, AUTENTICADO como o usuario de teste --
-- nao como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
-- 0) Readback do corpo aplicado:
--    SELECT pg_get_functiondef('public.gestor_pode_acessar_ies(uuid)'::regprocedure);
--
-- 1) Montar/confirmar o cenario do gap (:uid = gestor PURO de teste, users.id_ies = :ies_a,
--    com linha em user_groups apontando para grupo que cobre :ies_a E :ies_b):
--
--    SELECT u.id, u.id_ies,
--           (SELECT array_agg(r.role) FROM public.user_roles r WHERE r.user_id = u.id) AS papeis,
--           public.get_accessible_ies(u.id) AS ies_do_grupo
--    FROM public.users u WHERE u.id = :uid;
--    -- ESPERADO: papeis = {gestor} (SO gestor), id_ies = :ies_a,
--    --           ies_do_grupo contendo :ies_a E :ies_b  <- a linha orfa
--
-- 2) A prova do gap e da correcao, lado a lado, autenticado como esse gestor:
--
--    SELECT public.user_can_access_ies(:uid::uuid, :ies_b::uuid) AS antigo_libera_b,
--           public.gestor_pode_acessar_ies(:ies_b::uuid)         AS novo_nega_b,
--           public.gestor_pode_acessar_ies(:ies_a::uuid)         AS novo_libera_a,
--           public.gestor_pode_acessar_ies(NULL)                 AS nulo_nega;
--    -- ESPERADO: antigo_libera_b = true   (o gap: get_accessible_ies ignorou o papel)
--    --           novo_nega_b     = false  (correcao)
--    --           novo_libera_a   = true   (nao quebrou o caso legitimo)
--    --           nulo_nega       = false  (fail-closed)
--
-- 3) O gap fechado ponta a ponta, DEPOIS de as 10 RPCs adotarem o guard -- e este o teste
--    que o card cobra, autenticado como o gestor puro:
--
--    BEGIN;
--      SELECT public.get_gestor_alunos(:ies_b::uuid, NULL, 1, 25, NULL, NULL, NULL);
--      -- ESPERADO: EXCEPTION 'Permission denied: cannot access this IES'
--      -- (antes: devolvia nome/semestre/desempenho nominal dos alunos da IES B)
--      SELECT public.get_gestor_alunos(:ies_a::uuid, NULL, 1, 25, NULL, NULL, NULL);
--      -- ESPERADO: payload normal da propria IES
--    ROLLBACK;
--    -- Repetir com p_ies_id = :ies_b em get_gestor_visao_geral, get_gestor_aluno,
--    -- get_gestor_avisos, get_gestor_cronograma, get_gestor_detalhamento,
--    -- get_gestor_diagnostico, get_gestor_diagnostico_temas, get_gestor_questoes:
--    -- todas devem negar.
--
-- 4) NAO houve regressao em gestor_grupo (autenticado como um gestor_grupo do MESMO grupo
--    multi-IES):
--
--    SELECT public.gestor_pode_acessar_ies(:ies_a::uuid) AS grupo_libera_a,
--           public.gestor_pode_acessar_ies(:ies_b::uuid) AS grupo_libera_b;
--    -- ESPERADO: as duas true (comportamento preservado -- so 'gestor' puro muda)
--
-- 5) NAO houve regressao em admin (autenticado como admin):
--
--    SELECT public.gestor_pode_acessar_ies(:ies_b::uuid) AS admin_libera;
--    -- ESPERADO: true (bypass preservado, igual a user_can_access_ies)
--
-- 6) Fail-closed para papel fora do portal (autenticado como um 'professor'):
--
--    SELECT public.gestor_pode_acessar_ies(:ies_a::uuid) AS professor_nega;
--    -- ESPERADO: false. Nao e regressao: as 10 RPCs get_gestor_* ja barram professor no
--    -- guard de papel. As RPCs institucionais do legado NAO usam esta funcao (item 4 de
--    -- "COMO CONSUMIR") e seguem com user_can_access_ies, que continua liberando professor.
--
-- 7) Coerencia UI x servidor -- o invariante do card, como o gestor puro:
--
--    SELECT (public.get_gestor_contexto() -> 'data' -> 'podeTrocarIes')     AS pode_trocar,
--           (public.get_gestor_contexto() -> 'data' -> 'iesDisponiveis')    AS disponiveis,
--           public.gestor_pode_acessar_ies(:ies_b::uuid)                    AS servidor_libera_b;
--    -- ESPERADO: pode_trocar = false, disponiveis = [{ id: :ies_a, ... }] (so a propria),
--    --           servidor_libera_b = false. A UI e o servidor concordam.
