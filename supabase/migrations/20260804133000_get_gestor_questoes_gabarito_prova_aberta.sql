-- 20260804133000_get_gestor_questoes_gabarito_prova_aberta.sql
--
-- Corrige, em public.get_gestor_questoes, os achados 2 e 14 da revisão
-- adversarial de 03/08.
--
-- ACHADO 2 (card Ordem 101): a checagem de feature usava
-- public.user_has_feature('gestao.portal_v2'), que resolve por bool_or sobre
-- TODAS as IES acessíveis ao usuário (get_accessible_ies) quando
-- users.id_ies é null -- o caso normal de gestor_grupo. Isso liberava a
-- tabela de questões do portal v2 para uma IES do grupo com a flag
-- desligada, contanto que outra IES irmã a tenha ligada.
--
-- ACHADO 14 (card 102): a função entregava o gabarito -- campo `correta` em
-- cada alternativa, e `distratorDominante` (que só existe porque o servidor
-- sabe qual é `correta`) -- de prova ainda ABERTA ao aluno responder. O
-- guard de escopo (`sims`/EXISTS) usava a mesma condição de "desempenho
-- liberado" das outras RPCs get_gestor_*, que basta `status IN ('ativo',
-- 'encerrado')` + `liberacao_desempenho = 'imediato'` -- e 'imediato' é o
-- DEFAULT do formulário de criação de simulado, sem depender de nenhuma
-- resposta existir. Ou seja: um simulado 'ativo', recém-criado, com o
-- default de liberação de desempenho, já passava essa checagem mesmo
-- enquanto os alunos ainda estavam respondendo -- o gestor via o gabarito
-- completo de uma prova em andamento.
--
-- CRITÉRIO DE "ABERTA" (mesmo critério usado nos dois lados -- ver
-- decisões_tomadas do agente de get_gestor_detalhamento, achado 14 espelho):
-- espelha EXATAMENTE `simuladosApi.listarSimulados` (modo aluno, sem
-- `includeAll`) em src/services/simuladosApi.ts:
--   - query base já teria excluído status = 'encerrado';
--   - `liberado = !data_liberacao || data_liberacao <= agora`;
--   - `naoEncerrado = !data_encerramento || data_encerramento >= agora`;
--   - disponível ao aluno = liberado && naoEncerrado (com status != 'encerrado').
-- Traduzido para este guard, que já restringe `status IN ('ativo',
-- 'encerrado')`: "aberta ao aluno" = status = 'ativo' AND (data_liberacao IS
-- NULL OR data_liberacao <= now()) AND (data_encerramento IS NULL OR
-- data_encerramento >= now()).
--
-- CORTE ESCOLHIDO (o mais conservador dentro do pedido -- política final é
-- decisão do Felipe, registrada em pendências): enquanto a prova está
-- aberta, `correta` some (`NULL`, nunca `false` -- `false` afirmaria "esta
-- alternativa está errada", o que é tão inventado quanto afirmar que está
-- certa) em TODAS as alternativas da questão, e `distratorDominante` também
-- vira `NULL` (seu cálculo depende de saber qual é `correta`, então expô-lo
-- é expor gabarito parcial pela borda). `enunciado`, `alternativas[].texto`,
-- `marcadaPct` e `acertoPct` continuam saindo normalmente -- não fazem parte
-- do gabarito e são o dado que o gestor precisa para agir enquanto a prova
-- ainda roda (ex.: quantos já responderam).
--
-- PARTIU de supabase/migrations/20260729210900_get_gestor_questoes.sql
-- (única migration desta função no repo; nasceu com o guard escrito direto
-- no corpo, então não está sujeita ao risco de guard-apagado-por-CREATE-OR-
-- REPLACE que existe nas 19 RPCs institucionais antigas). NENHUMA outra
-- lógica foi alterada: mesmo SECURITY DEFINER, SET search_path, STABLE,
-- guard de papel, obrigatoriedade de p_simulado_id, chamada a
-- user_can_access_ies, fallback de v_ies, checagem de escopo do simulado,
-- paginação/ordenação/filtro de área, distribuição de alternativas, grants e
-- assinatura (uuid, uuid, int, int, text, text) -> jsonb.
--
-- EXIGÊNCIA ANTES DE APLICAR EM PRODUÇÃO (gvqv): rodar
--   SELECT pg_get_functiondef('public.get_gestor_questoes(uuid, uuid, int, int, text, text)'::regprocedure);
-- e comparar com o corpo de 20260729210900 assumido acima. Se divergir
-- (patch aplicado direto em prod fora do repo), ABORTAR e investigar antes
-- de rodar este arquivo -- não sobrescrever um corpo que não foi conferido.

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
-- VERIFICAÇÃO (rodar manualmente em gvqv, autenticado como o usuário gestor
-- de teste -- não como service_role, senão auth.uid()/has_role não valem)
-- ---------------------------------------------------------------------------
-- 1) Readback do corpo aplicado:
--    SELECT pg_get_functiondef('public.get_gestor_questoes(uuid, uuid, int, int, text, text)'::regprocedure);
--
-- 2) Achado 2, em transação revertida (:ies_b = IES do grupo do gestor com
--    'gestao.portal_v2' DESLIGADA; :ies_a = IES irmã com a flag LIGADA;
--    :sim = um simulado elegível):
--
--    BEGIN;
--      SELECT public.get_gestor_questoes(:ies_b::uuid, :sim::uuid, 1, 20, 'numero', NULL);  -- esperado: RAISE 'feature_not_enabled'
--      SELECT public.get_gestor_questoes(:ies_a::uuid, :sim::uuid, 1, 20, 'numero', NULL);   -- esperado: retorna jsonb normalmente
--    ROLLBACK;
--
-- 3) Achado 14, em transação revertida: escolha (ou monte) um simulado
--    status = 'ativo', liberacao_desempenho = 'imediato', com
--    data_liberacao <= now() e (data_encerramento null OU >= now()) --
--    exatamente o default do formulário de criação. Confira que:
--      a) a chamada retorna 'meta.criterio' com "aberta... true";
--      b) TODAS as alternativas de TODAS as questões vêm com 'correta': null;
--      c) 'distratorDominante' vem null em todas as questões.
--    Repita com data_encerramento no passado (prova encerrada) e confira que
--    'correta' e 'distratorDominante' voltam a ser expostos normalmente.
