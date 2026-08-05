-- 20260804162000_get_gestor_diagnostico_gestor_pode_acessar_ies.sql
--
-- SUCEDE 20260804131500_get_gestor_diagnostico_nivel_e_feature_por_ies.sql.
-- NAO edita aquele arquivo -- as migrations de 04/08 JA FORAM APLICADAS EM
-- PRODUCAO (gvqv, 04/08 16:11) e o Supabase registra migration aplicada pelo
-- PREFIXO da versao: editar o conteudo de um arquivo ja aplicado faz o
-- conteudo novo NUNCA rodar, em silencio. A correcao ficaria no repo com
-- cara de pronta e jamais chegaria ao produto. Por isso esta correcao nasce
-- em arquivo novo, com timestamp posterior tanto a 20260804131500 quanto a
-- 20260804160000 (a funcao nova de que este arquivo depende).
--
-- O GAP QUE ESTA MIGRATION FECHA (card Ordem 119, achado da verificacao
-- independente das 21 correcoes de 04/08)
-- --------------------------------------------------------------------------
-- 20260804131500 corrigiu os achados 2 (feature por IES) e 18 (arredondamento
-- de desempenho -- CONFIRMADO abaixo que continua unificado, nao regredido).
-- Continuou, porem, autorizando a IES por
-- public.user_can_access_ies(v_uid, p_ies_id), que delega para
-- public.get_accessible_ies(_user) quando a IES nao e a do proprio cadastro
-- -- e get_accessible_ies e a UNIAO de users.id_ies com as IES de TODO grupo
-- em que o usuario aparece em user_groups, SEM olhar o papel. Um usuario com
-- role SOMENTE 'gestor' (users.id_ies = A) que tenha ficado com uma linha
-- orfa em user_groups (residuo de downgrade gestor_grupo -> gestor,
-- permitido pela UI de admin hoje) apontando para um grupo que cobre {A, B}
-- passa em user_can_access_ies para a IES B. A UI nao oferece o switcher
-- para esse usuario (podeTrocarIes = false) -- mas isso e so a UI: um POST
-- direto em /rest/v1/rpc/get_gestor_diagnostico com p_ies_id = B ainda
-- devolvia o diagnostico curricular (grandes areas/especialidades, %% de
-- acerto, amostra) da IES B.
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
-- ACHADO 18 -- CONFIRMADO, NAO REGREDIDO: a CTE `agg` calcula `acerto_pct`
-- (arredondado) uma unica vez; `nos` reaproveita essa MESMA coluna tanto para
-- `acertoPct` quanto para classificar `desempenho` (CASE sobre `a.acerto_pct`,
-- nunca sobre a razao bruta `100.0 * acertos / total`). Esta migration copia
-- essa parte literalmente do corpo de 20260804131500, sem tocar.
--
-- NENHUMA outra logica foi alterada: mesmo SECURITY DEFINER, SET
-- search_path, STABLE, guard de papel, ordem "Access denied" -> resolucao de
-- v_ies -> "IES not resolved" -> autorizacao -> "feature_not_enabled",
-- parsing de p_semestre, cascata grande_area/especialidade, CTEs de
-- simulados/alunos/tentativas/respostas, classificacao de desempenho
-- (achado 18), grants e assinatura (uuid, text, text) -> jsonb.
--
-- NAO alterada a mensagem 'Permission denied: cannot access this IES' -- o
-- front-end mapeia essa string; mudar o texto quebraria o tratamento de erro
-- sem trocar nada de seguranca.
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv) -- rodar os dois readbacks
-- abaixo e ABORTAR se qualquer um divergir do que este arquivo assume:
--
--   -- (a) o corpo hoje em producao tem que ser o de 20260804131500:
--   SELECT pg_get_functiondef('public.get_gestor_diagnostico(uuid, text, text)'::regprocedure);
--   -- ESPERADO: guard de papel + `user_can_access_ies(v_uid, p_ies_id)`
--   -- dentro do `IF p_ies_id IS NOT NULL`, `agg.acerto_pct` reaproveitado em
--   -- `nos.desempenho`, seguido de `user_has_feature_for_ies('gestao.portal_v2',
--   -- v_ies)`. Se vier diferente (patch aplicado direto em prod, fora do
--   -- repo), PARAR.
--
--   -- (b) a funcao de que este arquivo depende precisa existir:
--   SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'gestor_pode_acessar_ies';
--   -- ESPERADO: 1 linha (aplicada por 20260804160000). Se vier 0, aplicar
--   -- aquela migration ANTES desta -- esta funcao nao compila sem ela.

CREATE OR REPLACE FUNCTION public.get_gestor_diagnostico(p_ies_id uuid, p_semestre text, p_node text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_ies      uuid;
  v_sems     int[];
  v_recorte  text;
  v_nivel    text;
  v_result   jsonb;
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

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  v_nivel := CASE WHEN p_node IS NULL THEN 'grande_area' ELSE 'especialidade' END;

  WITH sims AS (
    SELECT sa.id
    FROM public.simulados_admin sa
    WHERE v_ies = ANY (sa.ies_ids)
      AND sa.simulado_pai_id IS NULL
      AND sa.status IN ('ativo','encerrado')
      AND (
        sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado'
            AND sa.data_liberacao_desempenho IS NOT NULL
            AND sa.data_liberacao_desempenho <= now())
        OR (sa.liberacao_desempenho = 'ao_encerrar'
            AND (sa.status = 'encerrado'
                 OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now())))
      )
  ),
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  alunos AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id
    FROM public.simulados_finalizados sf
    JOIN grupo g ON g.simulado_id = sf.simulado_id
    WHERE sf.user_id IN (SELECT id FROM alunos)
    ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fb AS (
    SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id
    FROM public.answer_progress ap
    JOIN grupo g ON g.simulado_id = ap.simulado
    JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.user_id IN (SELECT id FROM alunos)
      AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id)
    ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST
  ),
  tentativas AS (
    SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb
  ),
  respostas AS (
    SELECT t.user_id, ap.correct, q.grande_area, q.especialidade, q.tema
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
  ),
  base AS (
    SELECT CASE WHEN p_node IS NULL THEN r.grande_area ELSE r.especialidade END AS nome,
           r.user_id, r.correct
    FROM respostas r
    WHERE (p_node IS NULL AND r.grande_area IS NOT NULL)
       OR (p_node IS NOT NULL AND r.grande_area = p_node AND r.especialidade IS NOT NULL)
  ),
  agg AS (
    SELECT b.nome,
           count(*) AS total,
           count(*) FILTER (WHERE b.correct) AS acertos,
           count(DISTINCT b.user_id) AS amostra,
           round(100.0 * count(*) FILTER (WHERE b.correct) / NULLIF(count(*),0), 0) AS acerto_pct
    FROM base b GROUP BY b.nome
  ),
  nos AS (
    SELECT a.nome,
           a.acerto_pct,
           a.amostra,
           -- achado 18: classifica sobre a MESMA base arredondada que sai em
           -- `acertoPct` -- nunca sobre a razão bruta (100.0 * acertos / total).
           CASE WHEN a.total = 0 THEN NULL
                WHEN a.acerto_pct <  30 THEN 'critico'
                WHEN a.acerto_pct >= 80 THEN 'excelente'
                ELSE 'mediano' END AS desempenho,
           CASE
             WHEN p_node IS NULL THEN EXISTS (
               SELECT 1 FROM respostas r2 WHERE r2.grande_area = a.nome AND r2.especialidade IS NOT NULL)
             ELSE EXISTS (
               SELECT 1 FROM respostas r3 WHERE r3.especialidade = a.nome AND r3.tema IS NOT NULL)
           END AS tem_filhos
    FROM agg a
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',         n.nome,
               'nome',       n.nome,
               'nivel',      v_nivel,
               'acertoPct',  n.acerto_pct,
               'desempenho', n.desempenho,
               'amostra',    n.amostra,
               'lowSample',  (n.amostra < 10),
               'temFilhos',  n.tem_filhos
             ) ORDER BY n.acerto_pct NULLS LAST, n.nome)
      FROM nos n), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      'todos os simulados com desempenho liberado para a IES',
      'fonte',        'answer_progress · questoes_simulado · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Desempenho em %% de acerto (crítico < 30, mediano 30–80, excelente >= 80) sobre o mesmo valor arredondado exposto em acertoPct, calculado a partir da última tentativa de cada aluno, questão anulada ignorada. Nível retornado: %s. Amostra = alunos distintos com resposta no nó; lowSample quando < 10. Recorte: %s.', v_nivel, v_recorte),
      'partial',      (SELECT count(*) FROM respostas r WHERE r.grande_area IS NULL) > 0,
      'lowSample',    COALESCE((SELECT max(n.amostra) FROM nos n), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_diagnostico(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_diagnostico(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICACAO (rodar manualmente em gvqv, autenticado como o usuario de
-- teste -- nao como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
-- 1) Readback do corpo aplicado:
--    SELECT pg_get_functiondef('public.get_gestor_diagnostico(uuid, text, text)'::regprocedure);
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
--      SELECT public.get_gestor_diagnostico(:ies_b::uuid, 'geral', NULL);
--      -- ESPERADO: RAISE 'Permission denied: cannot access this IES'
--      -- (antes desta migration: retornava o diagnostico da IES B normalmente)
--      SELECT public.get_gestor_diagnostico(:ies_a::uuid, 'geral', NULL);
--      -- ESPERADO: retorna jsonb normalmente (caso legitimo preservado)
--    ROLLBACK;
--
-- 4) Nao-regressao do achado 18 (caso de fronteira: 296 acertos em 1000 numa
--    grande área, em transacao revertida): confira que o nó volta
--    'acertoPct': 30 e 'desempenho': 'mediano' -- nunca 'critico'. Compare
--    com src/features/gestor/lib/regras.ts::nivelDesempenho(30) (também
--    'mediano').
--
-- 5) Nao-regressao de gestor_grupo e admin (autenticados como cada um,
--    testando :ies_a e :ies_b): ambos continuam com acesso a qualquer IES do
--    grupo (gestor_grupo) ou qualquer IES (admin) -- so o 'gestor' puro muda.
