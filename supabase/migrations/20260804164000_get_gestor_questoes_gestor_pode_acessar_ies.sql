-- 20260804164000_get_gestor_questoes_gestor_pode_acessar_ies.sql
--
-- SUCEDE 20260804133000_get_gestor_questoes_gabarito_prova_aberta.sql. NAO
-- edita aquele arquivo -- as migrations de 04/08 JA FORAM APLICADAS EM
-- PRODUCAO (gvqv, 04/08 16:11) e o Supabase registra migration aplicada pelo
-- PREFIXO da versao: editar o conteudo de um arquivo ja aplicado faz o
-- conteudo novo NUNCA rodar, em silencio. A correcao ficaria no repo com
-- cara de pronta e jamais chegaria ao produto. Por isso esta correcao nasce
-- em arquivo novo, com timestamp posterior tanto a 20260804133000 quanto a
-- 20260804160000 (a funcao nova de que este arquivo depende).
--
-- O GAP QUE ESTA MIGRATION FECHA (card Ordem 119, achado da verificacao
-- independente das 21 correcoes de 04/08)
-- --------------------------------------------------------------------------
-- 20260804133000 corrigiu os achados 2 (feature por IES) e 14 (gabarito de
-- prova aberta -- CONFIRMADO abaixo que `v_aberta` continua intocado, nao
-- regredido). Continuou, porem, autorizando a IES por
-- public.user_can_access_ies(v_uid, p_ies_id), que delega para
-- public.get_accessible_ies(_user) quando a IES nao e a do proprio cadastro
-- -- e get_accessible_ies e a UNIAO de users.id_ies com as IES de TODO grupo
-- em que o usuario aparece em user_groups, SEM olhar o papel. Um usuario com
-- role SOMENTE 'gestor' (users.id_ies = A) que tenha ficado com uma linha
-- orfa em user_groups (residuo de downgrade gestor_grupo -> gestor,
-- permitido pela UI de admin hoje) apontando para um grupo que cobre {A, B}
-- passa em user_can_access_ies para a IES B. A UI nao oferece o switcher
-- para esse usuario (podeTrocarIes = false) -- mas isso e so a UI: um POST
-- direto em /rest/v1/rpc/get_gestor_questoes com p_ies_id = B ainda devolvia
-- a tabela de questoes (enunciado, alternativas, %% de acerto e, se a prova
-- ja tivesse encerrado, o gabarito) da IES B.
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
-- ACHADO 14 -- CONFIRMADO, NAO REGREDIDO: `v_aberta` continua calculado
-- exatamente como em 20260804133000 (status = 'ativo' e dentro da janela de
-- liberacao/encerramento, espelhando simuladosApi.listarSimulados em modo
-- aluno) e continua controlando `correta` e `distratorDominante` (NULL
-- enquanto a prova esta aberta, nunca false). Nenhuma linha dessa logica foi
-- tocada -- so o preambulo de autorizacao de IES mudou.
--
-- NENHUMA outra logica foi alterada: mesmo SECURITY DEFINER, SET
-- search_path, STABLE, guard de papel, obrigatoriedade de p_simulado_id,
-- ordem "Access denied" -> "simulado_obrigatorio" -> resolucao de v_ies ->
-- "IES not resolved" -> autorizacao -> "feature_not_enabled", checagem de
-- escopo do simulado, calculo de v_aberta (achado 14), paginacao/ordenacao/
-- filtro de area, distribuicao de alternativas, grants e assinatura
-- (uuid, uuid, int, int, text, text) -> jsonb.
--
-- NAO alterada a mensagem 'Permission denied: cannot access this IES' -- o
-- front-end mapeia essa string; mudar o texto quebraria o tratamento de erro
-- sem trocar nada de seguranca.
--
-- EXIGENCIA ANTES DE APLICAR EM PRODUCAO (gvqv) -- rodar os dois readbacks
-- abaixo e ABORTAR se qualquer um divergir do que este arquivo assume:
--
--   -- (a) o corpo hoje em producao tem que ser o de 20260804133000:
--   SELECT pg_get_functiondef('public.get_gestor_questoes(uuid, uuid, int, int, text, text)'::regprocedure);
--   -- ESPERADO: guard de papel + `user_can_access_ies(v_uid, p_ies_id)`
--   -- dentro do `IF p_ies_id IS NOT NULL`, `v_aberta` calculado e usado em
--   -- `q_alts.correta`/`q_alts.distrator`, seguido de
--   -- `user_has_feature_for_ies('gestao.portal_v2', v_ies)`. Se vier
--   -- diferente (patch aplicado direto em prod, fora do repo), PARAR.
--
--   -- (b) a funcao de que este arquivo depende precisa existir:
--   SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'gestor_pode_acessar_ies';
--   -- ESPERADO: 1 linha (aplicada por 20260804160000). Se vier 0, aplicar
--   -- aquela migration ANTES desta -- esta funcao nao compila sem ela.

CREATE OR REPLACE FUNCTION public.get_gestor_questoes(
  p_ies_id     uuid,
  p_simulado_id uuid,
  p_page       int,
  p_page_size  int,
  p_sort       text,
  p_area       text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_ies    uuid;
  v_sort   text;
  v_page   int;
  v_size   int;
  v_aberta boolean;
  v_result jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_simulado_id IS NULL THEN
    RAISE EXCEPTION 'simulado_obrigatorio' USING ERRCODE = '22023';
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

  IF NOT EXISTS (
    SELECT 1 FROM public.simulados_admin sa
    WHERE sa.id = p_simulado_id
      AND v_ies = ANY (sa.ies_ids)
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
  ) THEN
    RAISE EXCEPTION 'simulado_fora_do_escopo' USING ERRCODE = '42501';
  END IF;

  -- achado 14: "desempenho liberado" (checagem acima) não é o mesmo que
  -- "prova encerrada para o aluno". v_aberta espelha simuladosApi.ts
  -- (listarSimulados, modo aluno): status = 'ativo' e dentro da janela de
  -- liberação/encerramento. Enquanto true, o gabarito fica oculto.
  SELECT (
    sa.status = 'ativo'
    AND (sa.data_liberacao IS NULL OR sa.data_liberacao <= now())
    AND (sa.data_encerramento IS NULL OR sa.data_encerramento >= now())
  )
  INTO v_aberta
  FROM public.simulados_admin sa
  WHERE sa.id = p_simulado_id;

  v_sort := lower(COALESCE(NULLIF(btrim(p_sort),''), 'numero'));
  IF v_sort NOT IN ('numero','acerto') THEN
    RAISE EXCEPTION 'sort_invalido' USING ERRCODE = '22023';
  END IF;
  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_size := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);

  WITH grupo AS (
    SELECT sa.id AS simulado_id
    FROM public.simulados_admin sa
    WHERE sa.id = p_simulado_id OR sa.simulado_pai_id = p_simulado_id
  ),
  alunos AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id) sf.user_id, sf.simulado_id
    FROM public.simulados_finalizados sf
    WHERE sf.simulado_id IN (SELECT simulado_id FROM grupo)
      AND sf.user_id IN (SELECT id FROM alunos)
    ORDER BY sf.user_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fb AS (
    SELECT DISTINCT ON (ap.user_id) ap.user_id, ap.simulado AS simulado_id
    FROM public.answer_progress ap
    JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.simulado IN (SELECT simulado_id FROM grupo)
      AND ap.user_id IN (SELECT id FROM alunos)
      AND ap.user_id NOT IN (SELECT user_id FROM ultima)
    ORDER BY ap.user_id, sa_ord.created_at DESC NULLS LAST
  ),
  tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb),
  q_base AS (
    SELECT q.id, COALESCE(q.numero_questao, q.ordem) AS numero,
           q.grande_area, q.especialidade, q.tema, q.enunciado, upper(q.correta) AS correta,
           q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d, q.alternativa_e
    FROM public.questoes_simulado q
    WHERE q.simulado_id IN (SELECT simulado_id FROM grupo)
      AND COALESCE(q.anulada,false) = false
      AND (p_area IS NULL OR q.grande_area = p_area)
  ),
  q_resp AS (
    SELECT ap.question_id,
           count(*) AS total,
           count(*) FILTER (WHERE ap.correct) AS acertos,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) IN ('A','B','C','D','E')) AS marcadas,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'A') AS m_a,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'B') AS m_b,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'C') AS m_c,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'D') AS m_d,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'E') AS m_e
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    GROUP BY ap.question_id
  ),
  q_full AS (
    SELECT b.*, COALESCE(r.total,0) AS total, COALESCE(r.acertos,0) AS acertos,
           COALESCE(r.marcadas,0) AS marcadas,
           COALESCE(r.m_a,0) AS m_a, COALESCE(r.m_b,0) AS m_b, COALESCE(r.m_c,0) AS m_c,
           COALESCE(r.m_d,0) AS m_d, COALESCE(r.m_e,0) AS m_e,
           CASE WHEN COALESCE(r.total,0) > 0 THEN round(100.0 * r.acertos / r.total, 0) END AS acerto_pct
    FROM q_base b LEFT JOIN q_resp r ON r.question_id = b.id
  ),
  q_alts AS (
    SELECT f.id,
           jsonb_agg(jsonb_build_object(
             'letra',      a.letra,
             'texto',      a.texto,
             -- achado 14: enquanto a prova está aberta, não expõe qual
             -- alternativa é a correta. NULL, nunca false.
             'correta',    CASE WHEN v_aberta THEN NULL ELSE (a.letra = f.correta) END,
             'marcadaPct', CASE WHEN f.marcadas > 0 THEN round(100.0 * a.n / f.marcadas, 0) END
           ) ORDER BY a.letra) AS alternativas,
           -- mesmo corte: distrator dominante só existe sabendo qual é a
           -- correta, então some junto enquanto a prova está aberta.
           CASE WHEN v_aberta THEN NULL ELSE (
             SELECT d.letra FROM (VALUES ('A',f.m_a),('B',f.m_b),('C',f.m_c),('D',f.m_d),('E',f.m_e)) AS d(letra,n)
               WHERE d.letra <> f.correta AND d.n > 0 ORDER BY d.n DESC, d.letra LIMIT 1
           ) END AS distrator
    FROM q_full f
    CROSS JOIN LATERAL (VALUES
      ('A', f.alternativa_a, f.m_a), ('B', f.alternativa_b, f.m_b), ('C', f.alternativa_c, f.m_c),
      ('D', f.alternativa_d, f.m_d), ('E', f.alternativa_e, f.m_e)
    ) AS a(letra, texto, n)
    WHERE a.texto IS NOT NULL
    GROUP BY f.id, f.correta, f.marcadas, f.m_a, f.m_b, f.m_c, f.m_d, f.m_e
  ),
  ordenado AS (
    SELECT f.*, al.alternativas, al.distrator,
           row_number() OVER (
             ORDER BY
               CASE WHEN v_sort = 'acerto' THEN f.acerto_pct END ASC NULLS LAST,
               f.numero ASC
           ) AS rn
    FROM q_full f JOIN q_alts al ON al.id = f.id
  ),
  totais AS (SELECT count(*) AS total FROM ordenado)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'data', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'numero',             o.numero,
                 'grandeArea',         o.grande_area,
                 'especialidade',      o.especialidade,
                 'tema',               o.tema,
                 'acertoPct',          o.acerto_pct,
                 'enunciado',          o.enunciado,
                 'alternativas',       o.alternativas,
                 'distratorDominante', o.distrator
               ) ORDER BY o.rn)
        FROM ordenado o
        WHERE o.rn > (v_page - 1) * v_size AND o.rn <= v_page * v_size), '[]'::jsonb),
      'page',       v_page,
      'pageSize',   v_size,
      'total',      (SELECT total FROM totais),
      'totalPages', CASE WHEN (SELECT total FROM totais) = 0 THEN 0
                         ELSE ceil((SELECT total FROM totais)::numeric / v_size)::int END
    ),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at),'DD/MM/YYYY')
                                FROM public.simulados_admin sa WHERE sa.id = p_simulado_id), 'sem data'),
      'fonte',        'answer_progress · questoes_simulado · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Índice de acerto da questão = respostas corretas / respostas na última tentativa de cada aluno da IES. marcadaPct = distribuição entre quem marcou alguma alternativa. Questão anulada não é listada. Distrator dominante = alternativa incorreta mais marcada. Ordenação: %s. Filtro de grande área: %s. Prova ainda aberta ao aluno (status ativo, dentro da janela de liberação/encerramento): %s — enquanto aberta, correta e distratorDominante vêm null, gabarito não é exposto.', v_sort, COALESCE(p_area, 'todas'), v_aberta),
      'partial',      (SELECT count(*) FROM q_full WHERE total = 0) > 0,
      'lowSample',    COALESCE((SELECT max(f.total) FROM q_full f), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_questoes(uuid, uuid, int, int, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_questoes(uuid, uuid, int, int, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICACAO (rodar manualmente em gvqv, autenticado como o usuario de
-- teste -- nao como service_role, senao auth.uid()/has_role nao valem)
-- ---------------------------------------------------------------------------
-- 1) Readback do corpo aplicado:
--    SELECT pg_get_functiondef('public.get_gestor_questoes(uuid, uuid, int, int, text, text)'::regprocedure);
--
-- 2) Cenario do gap (:uid = gestor PURO de teste, users.id_ies = :ies_a, com
--    linha orfa em user_groups cobrindo :ies_a E :ies_b; :sim = simulado
--    elegível de :ies_b):
--
--    SELECT public.user_can_access_ies(:uid::uuid, :ies_b::uuid) AS antigo_libera_b,
--           public.gestor_pode_acessar_ies(:ies_b::uuid)         AS novo_nega_b;
--    -- ESPERADO: antigo_libera_b = true (o gap), novo_nega_b = false.
--
-- 3) Gap fechado ponta a ponta, em transacao revertida:
--
--    BEGIN;
--      SELECT public.get_gestor_questoes(:ies_b::uuid, :sim::uuid, 1, 20, 'numero', NULL);
--      -- ESPERADO: RAISE 'Permission denied: cannot access this IES'
--      -- (antes desta migration: retornava a tabela de questões da IES B)
--      SELECT public.get_gestor_questoes(:ies_a::uuid, :sim_a::uuid, 1, 20, 'numero', NULL);
--      -- ESPERADO: retorna jsonb normalmente (caso legitimo preservado,
--      -- :sim_a = simulado elegível da própria IES A)
--    ROLLBACK;
--
-- 4) Nao-regressao do achado 14 (prova aberta, em transacao revertida):
--    monte um simulado status = 'ativo', liberacao_desempenho = 'imediato',
--    data_liberacao <= now(), data_encerramento null OU >= now() (default do
--    formulário). Confira que TODAS as alternativas vêm com 'correta': null
--    e 'distratorDominante': null. Repita com data_encerramento no passado e
--    confira que ambos voltam a ser expostos normalmente.
--
-- 5) Nao-regressao de gestor_grupo e admin (autenticados como cada um,
--    testando :ies_a e :ies_b): ambos continuam com acesso a qualquer IES do
--    grupo (gestor_grupo) ou qualquer IES (admin) -- so o 'gestor' puro muda.
