-- 20260807040000_invariante_user_groups_requer_gestor_grupo.sql
--
-- O FURO
-- ------
-- Nove RLS policies, em seis tabelas (answer_progress, questoes_simulado,
-- resultados_alunos_tri, resultados_ies_tri, simulados_admin,
-- simulados_finalizados), autorizam leitura por
-- public.get_accessible_ies(auth.uid()) -- a uniao de users.id_ies com todas
-- as IES dos grupos do usuario, via user_groups -> group_ies (migrations
-- 20260525145930, 20260525150143, 20260603181804, 20260624125202,
-- 20260701133641). Correto para gestor_grupo, o papel que existe para operar
-- multiplas IES.
--
-- Para gestor puro e diferente: public.gestor_pode_acessar_ies
-- (20260804160000), usada dentro das 11 RPCs get_gestor_*, restringe o gestor
-- puro a SOMENTE a propria users.id_ies, de proposito -- ver "A REGRA, POR
-- PAPEL" naquele arquivo. As nove policies NAO fazem essa distincao: chamam
-- get_accessible_ies direto, sem olhar o papel do usuario.
--
-- O ESTADO QUE EXPLORA O FURO
-- ---------------------------
-- Um usuario rebaixado de gestor_grupo para gestor cuja linha em user_groups
-- nao foi limpa. get_accessible_ies soma a IES do grupo (via user_groups ->
-- group_ies) a propria IES -- ela confere so a EXISTENCIA da linha, nao o
-- papel atual do usuario. Esse usuario le dados de IES-irmas direto pelo
-- REST (SELECT nas seis tabelas acima), sem passar por nenhuma RPC nem pela
-- UI -- que nem oferece o switcher para ele (podeTrocarIes = false).
--
-- Medido em producao hoje (07/08/2026): ZERO usuarios nesse estado -- ver
-- consulta de verificacao mais abaixo. Escala do papel: 28 gestor,
-- 27 gestor_grupo, 26 admin, 9 atendimento.
--
-- POR QUE A CORRECAO E A INVARIANTE, E NAO REESCREVER AS NOVE POLICIES
-- -----------------------------------------------------------------------
-- As mesmas seis tabelas (e as mesmas nove policies) tambem sao lidas pelo
-- ALUNO, com outras policies de aluno ao lado das de gestor_grupo. Um erro
-- ali derruba a experiencia do aluno, nao a do gestor -- e reescrever nove
-- policies para trocar o criterio de get_accessible_ies por algo sensivel a
-- papel e cirurgia de alto risco para um alvo que, medido, tem ZERO
-- instancias hoje.
--
-- Decisao (Felipe, 07/08/2026, com a medicao acima na mao): em vez de mudar o
-- que as policies leem, IMPEDIR QUE O ESTADO EXISTA. Se e impossivel ter
-- linha em user_groups sem o papel gestor_grupo em user_roles,
-- get_accessible_ies passa a devolver o conjunto certo para os dois papeis
-- (gestor_grupo: unida ao grupo, de proposito; gestor: sem linha de grupo,
-- logo so a propria IES) -- e as nove policies passam a autorizar
-- corretamente SEM que o corpo delas mude uma linha.
--
-- DECISAO REGISTRADA, NAO ESQUECIMENTO: as nove policies CONTINUAM
-- autorizando por get_accessible_ies. Nao "aproveitar" esta migration para
-- toca-las.
--
-- A INVARIANTE
-- ------------
-- So quem tem o papel gestor_grupo (public.user_roles) pode ter linha em
-- public.user_groups. Nao cabe num CHECK -- envolve outra tabela -- por isso
-- duas triggers, as duas bordas do mesmo problema:
--
--   1) BEFORE INSERT OR UPDATE ON public.user_groups: recusa a escrita se o
--      usuario (NEW.user_id) nao tem gestor_grupo em user_roles. Falha alta,
--      com mensagem que diz o que fazer.
--
--   2) AFTER DELETE OR UPDATE ON public.user_roles, quando a linha
--      afetada tinha role = 'gestor_grupo' e o usuario deixou de ter esse
--      papel: LIMPA (DELETE) as linhas de user_groups do usuario -- elas
--      deixam de ter sentido e SAO exatamente o bug. Loga em
--      admin_audit_log, best-effort, quando houver sessao autenticada.
--
-- QUEM MAIS ESCREVE EM user_groups (investigado ANTES de escrever a trigger 1)
-- -------------------------------------------------------------------------------
-- grep em src/, supabase/functions/ e supabase/migrations/: NENHUM escritor
-- em runtime. Os dois unicos INSERT INTO public.user_groups do repo sao seed
-- migrations pontuais, JA APLICADAS em producao:
--   * 20260525150305 (Stela/UNIATENAS): insere user_roles(gestor_grupo) E
--     user_groups no MESMO arquivo, nesta ordem -- papel antes de grupo.
--   * 20260527175304: INSERT INTO user_groups isolado, para um usuario que
--     ja e gestor_grupo por outra migration.
-- Em runtime, src/contexts/AuthContext.tsx (linha ~89) e
-- supabase/functions/auth-login/index.ts (linha ~210) SO leem (.select)
-- user_groups, para montar o contexto de grupo/switcher que a UI exibe. Nao
-- ha import em lote, script de seed vivo, nem integracao que grave nesta
-- tabela hoje. Logo a trigger 1 nao quebra fluxo legitimo algum: nao ha fluxo
-- legitimo de escrita em runtime, so migrations futuras -- que devem inserir
-- o papel gestor_grupo em user_roles ANTES (ou no mesmo arquivo, como
-- 20260525150305 ja faz).
--
-- COMO O ADMIN REBAIXA PAPEL HOJE (investigado ANTES de decidir limpar x recusar)
-- ---------------------------------------------------------------------------------
-- src/components/admin/UsersListTable.tsx: 'gestor_grupo' esta em
-- EDITABLE_ROLES/PRIVILEGED_ROLES (linhas 102-109, checkbox "Gestor de
-- Grupo" no editor de usuario). Ao desmarcar, o handler saveEdit roda
-- (linha ~448):
--   supabase.from('user_roles').delete().eq('user_id', user.id).in('role', toRemove)
-- em request PostgREST isolado (nao e RPC transacional) -- e exatamente esse
-- DELETE, hoje, que deixa a linha de user_groups orfa. E' o vetor descrito no
-- card que abriu este achado (ver cabecalho de 20260807023000).
--
-- POR QUE LIMPAR (borda 2) E NAO RECUSAR
-- ---------------------------------------
-- Um admin desmarcando a checkbox "Gestor de Grupo" no console nao deveria
-- receber erro -- e deixar as linhas de user_groups la e justamente o
-- defeito que este PR fecha. Por isso a borda 2 AUTO-CORRIGE (exclusao
-- automatica de dados, deliberada, comentada no corpo da funcao abaixo) em
-- vez de recusar a operacao do admin.
--
-- AUDITORIA: NAO E TABELA NOVA
-- -----------------------------
-- public.admin_audit_log ja existe (20260309165540) e ja recebe INSERT
-- direto de funcoes SECURITY DEFINER hoje (admin_anular_questao,
-- admin_liberar_tentativa, admin_set_ies_features, em 20260707172740) --
-- mesmo padrao usado abaixo. Ressalva encontrada: admin_audit_log.admin_id e
-- NOT NULL. Quando a borda 2 dispara FORA de uma sessao autenticada
-- (auth.uid() IS NULL -- ex.: uma migration futura que faca DELETE FROM
-- user_roles fora de contexto de usuario, como 20260527164445 ja fez para o
-- papel 'gestor'), o INSERT no audit log e PULADO -- so a limpeza (DELETE em
-- user_groups) roda. Nao ha como logar sem admin_id, e nao cabe alterar essa
-- coluna para nullable aqui (migration aditiva; nao e tabela nossa e a
-- restricao pede para nao fazer ALTER em coluna existente). O DELETE de
-- limpeza NUNCA depende de auth.uid() -- so o log e best-effort, no mesmo
-- espirito de src/services/admin/logAction.ts ("falha de auditoria nao deve
-- bloquear a acao principal").
--
-- O QUE NAO E TOCADO AQUI (decisao, nao esquecimento)
-- -----------------------------------------------------
--   * public.get_accessible_ies, public.gestor_pode_acessar_ies e
--     public.has_role: intocadas.
--   * As nove RLS policies "Gestor de grupo pode ver ..." em
--     answer_progress, questoes_simulado, resultados_alunos_tri,
--     resultados_ies_tri, simulados_admin e simulados_finalizados
--     (migrations 20260525150143, 20260603181804, 20260624125202,
--     20260701133641): intocadas. Continuam autorizando por
--     get_accessible_ies -- decisao registrada acima, nao regressao.
--
-- CONSULTA DE VERIFICACAO -- RODAR ANTES DE APLICAR EM PRODUCAO
-- -----------------------------------------------------------------
-- Confirma que o estado que a invariante impede ainda nao existe (medido
-- ZERO linhas em 07/08/2026):
--
--   SELECT ug.user_id FROM public.user_groups ug
--   WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur
--                      WHERE ur.user_id = ug.user_id AND ur.role = 'gestor_grupo');
--
-- Se essa consulta devolver linha(s) no dia da aplicacao: a borda 1 (trigger
-- de INSERT/UPDATE) passa a barrar ESCRITAS FUTURAS em user_groups, mas os
-- orfaos JA EXISTENTES nao sao tocados por ela (ela so dispara em
-- INSERT/UPDATE, nao varre linhas existentes). Nesse caso, ANTES de aplicar
-- esta migration, rode a limpeza manual equivalente a borda 2 para os orfaos
-- encontrados (e considere logar o resultado em admin_audit_log manualmente,
-- com o admin_id de quem aplicar, antes do DELETE):
--
--   DELETE FROM public.user_groups ug
--   WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur
--                      WHERE ur.user_id = ug.user_id AND ur.role = 'gestor_grupo');
--
-- NAO FOI APLICADA em producao (07/08/2026).

-- ---------------------------------------------------------------------------
-- Borda 1: recusa INSERT/UPDATE em user_groups sem o papel gestor_grupo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_user_groups_requer_gestor_grupo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = NEW.user_id
      AND ur.role = 'gestor_grupo'::public.app_role
  ) THEN
    RAISE EXCEPTION
      'user_groups requer o papel gestor_grupo: usuario % nao tem esse papel em public.user_roles. Conceda o papel gestor_grupo (INSERT INTO public.user_roles) ANTES de inserir ou atualizar a linha em public.user_groups.',
      NEW.user_id
      USING ERRCODE = '23514'; -- check_violation: e uma invariante de integridade, ainda que nao caiba num CHECK literal (envolve outra tabela)
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_user_groups_requer_gestor_grupo ON public.user_groups;
CREATE TRIGGER trg_user_groups_requer_gestor_grupo
  BEFORE INSERT OR UPDATE ON public.user_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_groups_requer_gestor_grupo();

COMMENT ON FUNCTION public.enforce_user_groups_requer_gestor_grupo() IS
'Invariante: uma linha em public.user_groups so pode existir para um usuario com o papel gestor_grupo em public.user_roles. Fecha o furo em que um usuario rebaixado de gestor_grupo para gestor, com user_groups nao limpo, e lido pelas nove RLS policies que autorizam por get_accessible_ies (que nao olha o papel). Ver cabecalho de 20260807040000_invariante_user_groups_requer_gestor_grupo.sql. NAO recusa se o proprio user_roles ainda nao tiver a linha gestor_grupo na mesma transacao -- por isso migrations de seed devem inserir o papel ANTES do grupo (ver 20260525150305).';

-- ---------------------------------------------------------------------------
-- Borda 2: ao remover gestor_grupo em user_roles, limpa o user_groups orfao
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.limpa_user_groups_ao_perder_gestor_grupo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user_id   uuid;
  v_perdeu    boolean := false;
  v_removidos jsonb;
  v_admin_id  uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'gestor_grupo'::public.app_role THEN
      v_user_id := OLD.user_id;
      v_perdeu := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'gestor_grupo'::public.app_role
       AND NEW.role IS DISTINCT FROM 'gestor_grupo'::public.app_role THEN
      v_user_id := OLD.user_id;
      v_perdeu := true;
    END IF;
  END IF;

  IF NOT v_perdeu THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Reconfirma que o usuario de fato NAO tem mais gestor_grupo. Defensivo:
  -- cobre a mesma transacao reinserir o papel em outro statement depois
  -- desta linha disparar -- UNIQUE(user_id, role) impede duas linhas
  -- gestor_grupo simultaneas para o mesmo usuario, mas nao impede um
  -- DELETE + INSERT sequencial na mesma transacao.
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
      AND ur.role = 'gestor_grupo'::public.app_role
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- EXCLUSAO AUTOMATICA DE DADOS, DELIBERADA: as linhas de user_groups deste
  -- usuario deixam de ter sentido sem o papel gestor_grupo -- SAO exatamente
  -- o estado que explora o furo que esta migration fecha (ver "POR QUE
  -- LIMPAR (borda 2) E NAO RECUSAR" no cabecalho do arquivo). Preferido a
  -- recusar a operacao do admin: desmarcar a checkbox "Gestor de Grupo" no
  -- console (src/components/admin/UsersListTable.tsx) nao deveria falhar.
  WITH removidos AS (
    DELETE FROM public.user_groups
    WHERE user_id = v_user_id
    RETURNING group_id
  )
  SELECT jsonb_agg(group_id) INTO v_removidos FROM removidos;

  IF v_removidos IS NOT NULL THEN
    v_admin_id := auth.uid();
    -- Best-effort: sem sessao autenticada (auth.uid() nulo -- ex.: DELETE
    -- disparado por uma migration ou por service_role, fora de um request
    -- de usuario) NAO loga -- admin_audit_log.admin_id e NOT NULL e esta
    -- tabela nao e alterada por esta migration (aditiva; nao e nossa
    -- tabela). A limpeza roda de qualquer forma; so o registro em
    -- admin_audit_log e condicional. Mesmo espirito best-effort de
    -- src/services/admin/logAction.ts.
    IF v_admin_id IS NOT NULL THEN
      INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, metadata)
      VALUES (
        v_admin_id,
        'user_groups_orfao_removido_ao_perder_gestor_grupo',
        v_user_id,
        jsonb_build_object('group_ids_removidos', v_removidos)
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS trg_limpa_user_groups_ao_perder_gestor_grupo ON public.user_roles;
CREATE TRIGGER trg_limpa_user_groups_ao_perder_gestor_grupo
  AFTER DELETE OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.limpa_user_groups_ao_perder_gestor_grupo();

COMMENT ON FUNCTION public.limpa_user_groups_ao_perder_gestor_grupo() IS
'Quando um usuario perde o papel gestor_grupo (DELETE ou UPDATE de role em public.user_roles), remove (DELETE, exclusao automatica deliberada) as linhas dele em public.user_groups -- elas deixam de ter sentido e sao o estado que explora o furo fechado por esta migration. Loga em public.admin_audit_log SOMENTE quando ha sessao autenticada (auth.uid() nao nulo); fora de sessao (migration/service_role) so limpa, sem logar. Ver cabecalho de 20260807040000_invariante_user_groups_requer_gestor_grupo.sql.';
