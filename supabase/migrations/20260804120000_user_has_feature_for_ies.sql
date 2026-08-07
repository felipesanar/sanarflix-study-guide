-- 20260804120000_user_has_feature_for_ies.sql
-- Corrige na raiz o achado 2 da revisao adversarial de 03/08 (card Ordem 101).
--
-- O DEFEITO
-- ---------
-- public.user_has_feature(p_feature) resolve a permissao olhando o USUARIO, nao a IES pedida:
-- quando users.id_ies e null -- o caso normal de gestor_grupo -- ela monta a lista de IES com
-- public.get_accessible_ies(uid) e faz bool_or(enabled) sobre TODAS as IES do grupo. Resultado:
-- basta UMA IES do grupo com 'gestao.portal_v2' ligada para que o portal v2 fique liberado para
-- as IES irmas que estao desligadas. As 9 RPCs get_gestor_* recebem p_ies_id, mas checavam a
-- feature por essa funcao -- ou seja, nunca contra a IES efetivamente pedida.
--
-- A CORRECAO
-- ----------
-- Esta migration NAO ALTERA public.user_has_feature. Aquela funcao e compartilhada com as 19 RPCs
-- institucionais antigas (guard injetado pela migration 20260709171344, cujo corpo real nao existe
-- em nenhum .sql do repo) e com o resto do produto; mexer nela mudaria o comportamento de toda
-- chave 'gestao.%' de uma vez. Em vez disso criamos uma funcao NOVA, aditiva, com a MESMA semantica
-- exceto num ponto: a lista de IES avaliada e exatamente {p_ies_id}. Sem get_accessible_ies, sem
-- bool_or sobre multiplas IES. Master e feature especifica, os dois para ESSA IES.
--
-- ESCOPO: esta funcao responde "a feature esta ligada para esta IES?", e NAO "este usuario pode ver
-- esta IES?". A autorizacao (o p_ies_id pedido pertence ao usuario) continua sendo responsabilidade
-- de cada RPC, via get_accessible_ies. Nao troque um check pelo outro: sao perguntas diferentes.
--
-- Por que sem bool_or: public.ies_features tem UNIQUE (ies_id, feature_key) (migration 20260109004617),
-- logo o filtro por uma unica IES retorna no maximo uma linha e a leitura escalar e equivalente ao
-- bool_or de user_has_feature. O bool_or de la existe apenas por causa das multiplas IES do grupo --
-- que e exatamente o que esta funcao elimina.
--
-- DECISAO JA TOMADA -- NAO "CONSERTAR" DEPOIS
-- -------------------------------------------
-- O bypass de papel (admin e atendimento => true incondicional) e PRESERVADO de proposito, identico
-- ao de user_has_feature. Motivo: o achado 2 e sobre gestor_grupo, nao sobre admin. Remover o bypass
-- agora derrubaria o acesso de admin ao portal v2 no meio da implementacao -- regressao surpresa que
-- ninguem pediu. Manter o bypass NAO enfraquece a correcao, porque gestor_grupo nao e admin: o
-- vazamento entre IES irmas fica fechado do mesmo jeito. Se algum dia o bypass de admin precisar
-- sair, ele sai de user_has_feature e daqui JUNTOS, como decisao explicita e nao como faxina.

CREATE OR REPLACE FUNCTION public.user_has_feature_for_ies(p_feature text, p_ies_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid     uuid := auth.uid();
  v_master  boolean;
  v_enabled boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Bypass de papel: identico a public.user_has_feature. Ver bloco "DECISAO JA TOMADA" no topo.
  IF public.has_role(v_uid, 'admin'::app_role)
     OR public.has_role(v_uid, 'atendimento'::app_role) THEN
    RETURN true;
  END IF;

  -- Fail-closed. Em user_has_feature o equivalente e a lista de IES vazia/nula => false.
  IF p_ies_id IS NULL THEN
    RETURN false;
  END IF;

  -- MASTER: uma chave 'gestao.X' so vale se 'gestao.enabled' estiver ligada PARA ESTA IES.
  -- Mesma regra de user_has_feature, inclusive a excecao de 'gestao.enabled' (que e o proprio
  -- master e portanto nao se auto-exige) e o fato de que a regra nao se aplica a 'aluno.%'.
  IF p_feature LIKE 'gestao.%' AND p_feature <> 'gestao.enabled' THEN
    SELECT COALESCE(f.enabled, false)
      INTO v_master
    FROM public.ies_features f
    WHERE f.feature_key = 'gestao.enabled'
      AND f.ies_id = p_ies_id;

    IF NOT COALESCE(v_master, false) THEN
      RETURN false;
    END IF;
  END IF;

  -- Feature especifica, tambem so para esta IES. Ausencia de linha => false (nao herda de irma).
  SELECT COALESCE(f.enabled, false)
    INTO v_enabled
  FROM public.ies_features f
  WHERE f.feature_key = p_feature
    AND f.ies_id = p_ies_id;

  RETURN COALESCE(v_enabled, false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.user_has_feature_for_ies(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_has_feature_for_ies(text, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.user_has_feature_for_ies(text, uuid) IS
'Checa se uma feature de ies_features esta ligada PARA UMA IES ESPECIFICA (master gestao.enabled + chave), sem bool_or sobre as IES do grupo. Use nas RPCs que recebem p_ies_id, no lugar de user_has_feature. Nao substitui a checagem de autorizacao por get_accessible_ies. Achado 2 da revisao de 03/08.';

-- ---------------------------------------------------------------------------
-- COMO ADOTAR NAS 9 RPCs -- LEIA ANTES DE SUBSTITUIR (armadilha real)
-- ---------------------------------------------------------------------------
-- NAO faca uma troca cega de user_has_feature('gestao.portal_v2') por
-- user_has_feature_for_ies('gestao.portal_v2', p_ies_id) no lugar onde o guard esta hoje.
-- Nas 9 RPCs get_gestor_* o guard e a PRIMEIRA instrucao do BEGIN, e nesse ponto p_ies_id
-- ainda pode ser NULL: p_ies_id e opcional e existe um fallback logo abaixo
--   IF p_ies_id IS NOT NULL THEN ... v_ies := p_ies_id;
--   ELSE  SELECT u.id_ies INTO v_ies ...;  IF v_ies IS NULL THEN v_ies := (get_accessible_ies(v_uid))[1]; END IF;
--   END IF;
-- Como esta funcao e fail-closed para p_ies_id NULL, a troca cega faria a RPC estourar
-- 'feature_not_enabled' para todo gestor que chama sem passar a IES -- regressao nova.
--
-- PADRAO CORRETO: mover o guard de feature para DEPOIS da resolucao de v_ies (ou seja, depois
-- do bloco IF/ELSE e do 'IF v_ies IS NULL THEN RAISE ... IES not resolved'), e passar v_ies:
--
--   IF NOT public.user_has_feature_for_ies('gestao.portal_v2', v_ies) THEN
--     RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
--   END IF;
--
-- A ordem final do preambulo passa a ser: papel (Access denied) -> autorizacao da IES
-- (user_can_access_ies) -> resolucao de v_ies -> feature (feature_not_enabled). Isso mantem o
-- comportamento de negar acesso antes de revelar qualquer coisa sobre a IES, e o guard passa a
-- perguntar pela IES que a RPC vai de fato consultar -- que e o ponto do achado 2.
--
-- EXCECAO: public.get_gestor_contexto() nao tem p_ies_id (ela enumera as IES do switcher e nao le
-- dados de uma IES so), portanto continua com user_has_feature('gestao.portal_v2'). Isso e correto:
-- o gestor precisa carregar o contexto para depois escolher a IES. O bloqueio por IES desligada
-- acontece nas outras 9, que sao as que servem dado. Nao "uniformize" isso.

-- ---------------------------------------------------------------------------
-- VERIFICACAO DO CENARIO DO ACHADO (rodar manualmente em gvqv, como o usuario
-- gestor_grupo autenticado -- nao como service_role, senao has_role/auth.uid nao valem)
-- ---------------------------------------------------------------------------
-- Cenario: usuario gestor_grupo com users.id_ies IS NULL, grupo com IES A ligada e IES B desligada.
--
-- 1) Confirmar o cenario (substituir :uid pelo id do gestor_grupo):
--
--    SELECT u.id, u.id_ies, public.get_accessible_ies(u.id) AS ies_do_grupo
--    FROM public.users u WHERE u.id = :uid;
--    -- espera-se id_ies IS NULL e ies_do_grupo com pelo menos 2 IES
--
--    SELECT f.ies_id, i.nome, f.feature_key, f.enabled
--    FROM public.ies_features f JOIN public.ies i ON i.id = f.ies_id
--    WHERE f.ies_id = ANY (public.get_accessible_ies(:uid))
--      AND f.feature_key IN ('gestao.enabled','gestao.portal_v2')
--    ORDER BY i.nome, f.feature_key;
--    -- espera-se IES A com gestao.portal_v2 = true e IES B com gestao.portal_v2 = false (ou sem linha)
--
-- 2) A prova do defeito e da correcao, lado a lado (:ies_b = a IES DESLIGADA):
--
--    SELECT public.user_has_feature('gestao.portal_v2')                        AS antigo_vaza,
--           public.user_has_feature_for_ies('gestao.portal_v2', :ies_b::uuid)  AS novo_bloqueia,
--           public.user_has_feature_for_ies('gestao.portal_v2', :ies_a::uuid)  AS novo_libera_a;
--    -- ESPERADO: antigo_vaza = true  (bug: bool_or pegou a IES A)
--    --           novo_bloqueia = false (correcao: avaliou SO a IES B)
--    --           novo_libera_a = true  (nao quebrou o caso legitimo)
--
-- 3) Master desligado tem precedencia (IES C com gestao.enabled = false e gestao.portal_v2 = true):
--
--    SELECT public.user_has_feature_for_ies('gestao.portal_v2', :ies_c::uuid);
--    -- ESPERADO: false
