-- A3 do plano docs/superpowers/plans/2026-08-09-gestor-v2-correcoes-e-features.md
--
-- Nova RPC: granularidade por grande_area/especialidade/tema do desempenho de
-- UM aluno, com quantitativo de questões respondidas -- get_gestor_aluno so
-- agrega por grande_area (GROUP BY q.grande_area), sem contar questões e sem
-- ir até especialidade/tema.
--
-- Reaproveita (copiado, não reinventado) o preâmbulo canônico de autorização
-- e as CTEs de "tentativa" (última tentativa do aluno por simulado-pai, com
-- fallback simulados_finalizados -> answer_progress) de public.get_gestor_aluno,
-- só que escopadas diretamente para p_aluno_id (get_gestor_aluno computa
-- tentativas para TODOS os alunos da IES porque também precisa de ranking
-- entre alunos; aqui não há ranking, então filtramos por user_id desde a
-- CTE, resultado equivalente e mais barato).
--
-- Diferença deliberada de get_gestor_aluno/get_gestor_diagnostico: esta RPC
-- filtra answer_progress."respondida?" = true no denominador de questões
-- respondidas. As duas RPCs citadas NÃO filtram por essa coluna (contam toda
-- linha de answer_progress, respondida ou não) -- bug de contagem que não
-- deve ser reproduzido aqui.
--
-- questoesTotal/questoesRespondidas/acertos usam COUNT(DISTINCT question_id)
-- em vez de COUNT(*): existem ~300 pares (user_id, simulado, question_id)
-- duplicados em answer_progress em produção (achado durante o teste manual
-- desta migration, ex. aluno e801f070.../simulado 89513f46... tinha 200
-- linhas de answer_progress para 100 questões, cada uma duplicada). Contar
-- com COUNT(*) dobraria o quantitativo de questões nesses casos; o objetivo
-- desta RPC é justamente dar quantitativo confiável, então a proteção contra
-- duplicidade é intencional.
--
-- critica = acertoPct < 30 é o mesmo corte usado em get_gestor_diagnostico
-- (classificação 'critico'), aplicado aqui diretamente sobre o acertoPct do
-- PRÓPRIO aluno naquele tema (não uma comparação com a média da IES, que é o
-- padrão diferente usado em get_gestor_aluno.acertoPorArea.critica).
--
-- Tema sem nenhuma resposta do aluno (questoesRespondidas = 0, mas
-- questoesTotal > 0 porque o simulado tem a questão) tem acertoPct = 0 e
-- portanto critica = true -- ver meta.criterio no retorno.

CREATE OR REPLACE FUNCTION public.get_gestor_aluno_desempenho_por_area(
  p_ies_id    uuid,
  p_aluno_id  uuid,
  p_simulados uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- resolucao de v_ies (ainda NAO autoriza -- mesmo padrão de get_gestor_aluno)
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

  -- autorizacao da IES RESOLVIDA, por papel (mesmo padrão de get_gestor_aluno
  -- / get_gestor_diagnostico -- gestor puro so acessa users.id_ies, nunca
  -- get_accessible_ies, mesmo com user_groups orfao)
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  IF p_aluno_id IS NULL THEN
    RAISE EXCEPTION 'aluno_obrigatorio' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_aluno_id
      AND u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ) THEN
    RAISE EXCEPTION 'aluno_nao_encontrado' USING ERRCODE = '42501';
  END IF;

  WITH sims AS (
    SELECT sa.id, sa.nome,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
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
      AND (p_simulados IS NULL OR array_length(p_simulados,1) IS NULL OR sa.id = ANY (p_simulados))
  ),
  sims_ord AS (
    SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord FROM sims s
  ),
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  -- última tentativa DO ALUNO por simulado-pai (copiado de get_gestor_aluno,
  -- escopado desde já para p_aluno_id em vez de filtrar depois)
  ultima AS (
    SELECT DISTINCT ON (g.pai_id) g.pai_id, sf.simulado_id
    FROM public.simulados_finalizados sf
    JOIN grupo g ON g.simulado_id = sf.simulado_id
    WHERE sf.user_id = p_aluno_id
    ORDER BY g.pai_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fb AS (
    SELECT DISTINCT ON (g.pai_id) g.pai_id, ap.simulado AS simulado_id
    FROM public.answer_progress ap
    JOIN grupo g ON g.simulado_id = ap.simulado
    JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.user_id = p_aluno_id
      AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.pai_id = g.pai_id)
    ORDER BY g.pai_id, sa_ord.created_at DESC NULLS LAST
  ),
  tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb),
  -- todas as questões (respondidas ou não) do simulado especifico que o
  -- aluno tentou, por pai_id
  qtotal AS (
    SELECT t.pai_id, q.grande_area, q.especialidade, q.tema,
           count(DISTINCT q.id) AS questoes_total
    FROM tentativas t
    JOIN public.questoes_simulado q ON q.simulado_id = t.simulado_id
    WHERE COALESCE(q.anulada,false) = false
      AND q.grande_area IS NOT NULL AND q.especialidade IS NOT NULL AND q.tema IS NOT NULL
    GROUP BY t.pai_id, q.grande_area, q.especialidade, q.tema
  ),
  -- só as questões com "respondida?" = true (fix do bug de get_gestor_aluno
  -- / get_gestor_diagnostico, que não filtram por essa coluna)
  qresp AS (
    SELECT t.pai_id, q.grande_area, q.especialidade, q.tema,
           count(DISTINCT ap.question_id) AS questoes_respondidas,
           count(DISTINCT ap.question_id) FILTER (WHERE ap.correct) AS acertos
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = p_aluno_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE ap."respondida?" = true
      AND COALESCE(q.anulada,false) = false
      AND q.grande_area IS NOT NULL AND q.especialidade IS NOT NULL AND q.tema IS NOT NULL
    GROUP BY t.pai_id, q.grande_area, q.especialidade, q.tema
  ),
  areas AS (
    SELECT
      COALESCE(qt.pai_id, qr.pai_id)                AS pai_id,
      COALESCE(qt.grande_area, qr.grande_area)      AS grande_area,
      COALESCE(qt.especialidade, qr.especialidade)  AS especialidade,
      COALESCE(qt.tema, qr.tema)                    AS tema,
      COALESCE(qt.questoes_total, 0)                AS questoes_total,
      COALESCE(qr.questoes_respondidas, 0)          AS questoes_respondidas,
      COALESCE(qr.acertos, 0)                       AS acertos
    FROM qtotal qt
    FULL JOIN qresp qr
      ON qr.pai_id = qt.pai_id
     AND qr.grande_area = qt.grande_area
     AND qr.especialidade = qt.especialidade
     AND qr.tema = qt.tema
  ),
  areas_calc AS (
    SELECT a.*,
           round(100.0 * a.acertos / NULLIF(a.questoes_respondidas,0), 0)::int AS acerto_pct_raw
    FROM areas a
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'simuladoId', s.id,
               'nome',       s.nome,
               'areas', COALESCE((
                 SELECT jsonb_agg(jsonb_build_object(
                          'grandeArea',          ac.grande_area,
                          'especialidade',       ac.especialidade,
                          'tema',                ac.tema,
                          'questoesRespondidas', ac.questoes_respondidas,
                          'questoesTotal',       ac.questoes_total,
                          'acertos',             ac.acertos,
                          'acertoPct',           COALESCE(ac.acerto_pct_raw, 0),
                          'critica',             COALESCE(ac.acerto_pct_raw, 0) < 30
                        ) ORDER BY ac.grande_area, ac.especialidade, ac.tema)
                 FROM areas_calc ac WHERE ac.pai_id = s.id), '[]'::jsonb)
             ) ORDER BY s.ord)
      FROM sims_ord s), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(min(s.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(s.data_ref),'DD/MM/YYYY')
                                FROM sims_ord s), 'sem simulado na seleção'),
      'fonte',        'answer_progress · questoes_simulado · simulados_admin · simulados_finalizados',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     'Granularidade por grande_area/especialidade/tema da ÚLTIMA tentativa do aluno em cada simulado-pai selecionado (mesmo critério de desempate de get_gestor_aluno: última simulados_finalizados, com fallback para o simulado mais recentemente respondido via answer_progress quando não há registro em simulados_finalizados). Questão anulada ignorada. questoesRespondidas conta só resposta com "respondida?" = true em answer_progress (questão vista mas não respondida não entra no denominador). questoesTotal é o total de questões daquele tema no simulado que o aluno tentou, respondida ou não. acertoPct é calculado sobre questoesRespondidas, nunca sobre questoesTotal; tema sem nenhuma resposta do aluno tem acertoPct = 0. critica = acertoPct < 30 (mesmo corte de get_gestor_diagnostico), aplicado ao desempenho do PRÓPRIO aluno no tema, não a uma comparação com a média da IES. Simulado sem nenhuma tentativa do aluno aparece com areas = [].'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
