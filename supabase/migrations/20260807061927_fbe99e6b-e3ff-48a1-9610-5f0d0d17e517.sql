CREATE OR REPLACE FUNCTION public.get_gestor_diagnostico_temas(p_ies_id uuid, p_semestre text, p_especialidade text, p_grande_area text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_ies     uuid;
  v_sems    int[];
  v_recorte text;
  v_result  jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_especialidade IS NULL OR btrim(p_especialidade) = '' THEN
    RAISE EXCEPTION 'especialidade_obrigatoria' USING ERRCODE = '22023';
  END IF;

  -- string vazia equivale a "grande área não informada" -- mesmo tratamento
  -- de 20260804132000, preservado. A diferença é o que acontece a seguir:
  -- antes, NULL era um valor válido (comportamento ambíguo); agora, NULL é
  -- rejeitado (ver "GAP 1 -- CARD 115" no cabeçalho).
  IF p_grande_area IS NOT NULL AND btrim(p_grande_area) = '' THEN
    p_grande_area := NULL;
  END IF;

  -- gap 115: escopo por grande área deixou de ser opcional na prática.
  -- Sem ele, a mesma especialidade cadastrada em duas grandes áreas somaria
  -- temas das duas -- o bug que 20260804132000 corrigiu no SQL mas que
  -- continuava se manifestando porque nenhum chamador enviava o parâmetro.
  IF p_grande_area IS NULL THEN
    RAISE EXCEPTION 'grande_area_obrigatoria' USING ERRCODE = '22023';
  END IF;

  -- resolucao de v_ies (ainda NAO autoriza -- ver "GAP 2 -- CARD 119" no
  -- cabecalho)
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

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

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
  temas AS (
    SELECT q.tema AS nome,
           count(*) AS total,
           count(*) FILTER (WHERE ap.correct) AS acertos,
           count(DISTINCT t.user_id) AS amostra
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
      AND q.especialidade = p_especialidade
      -- gap 115: p_grande_area agora é sempre NOT NULL neste ponto (a
      -- exceção acima já teria interrompido a função). Filtro direto, sem
      -- o "OR" permissivo que existia em 20260804132000.
      AND q.grande_area = p_grande_area
      AND q.tema IS NOT NULL
    GROUP BY q.tema
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',        t.nome,
               'nome',      t.nome,
               'acertoPct', round(100.0 * t.acertos / NULLIF(t.total,0), 0),
               'amostra',   t.amostra,
               'lowSample', (t.amostra < 10)
             ) ORDER BY round(100.0 * t.acertos / NULLIF(t.total,0), 0) NULLS LAST, t.nome)
      FROM temas t), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      'todos os simulados com desempenho liberado para a IES',
      'fonte',        'answer_progress · questoes_simulado · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Tema em %% de acerto sobre a última tentativa de cada aluno, questão anulada ignorada. Proficiência não se aplica a tema. Especialidade: %s. Grande área de origem: %s. Recorte: %s.', p_especialidade, p_grande_area, v_recorte),
      'partial',      false,
      'lowSample',    COALESCE((SELECT max(t.amostra) FROM temas t), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_gestor_alunos(p_ies_id uuid, p_semestre text, p_page integer, p_page_size integer, p_sort text, p_order text, p_q text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_ies     uuid;
  v_sems    int[];
  v_recorte text;
  v_sort    text;
  v_order   text;
  v_page    int;
  v_size    int;
  v_q       text;
  v_result  jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- resolucao de v_ies (ainda NAO autoriza -- guard vem logo abaixo)
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

  -- autorizacao da IES RESOLVIDA, por papel (achado 15/card 119, substitui
  -- public.user_can_access_ies -- gestor puro so acessa users.id_ies, nunca
  -- get_accessible_ies, mesmo com user_groups orfao). Intocado nesta migration.
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
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

  v_sort  := lower(COALESCE(NULLIF(btrim(p_sort),''),  'nome'));
  v_order := lower(COALESCE(NULLIF(btrim(p_order),''), 'asc'));
  IF v_sort  NOT IN ('nome','semestre','proficiencia','tendencia') THEN
    RAISE EXCEPTION 'sort_invalido' USING ERRCODE = '22023';
  END IF;
  IF v_order NOT IN ('asc','desc') THEN
    RAISE EXCEPTION 'order_invalido' USING ERRCODE = '22023';
  END IF;
  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_size := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  v_q    := NULLIF(btrim(COALESCE(p_q,'')), '');

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
  ),
  sims_ord AS (
    SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord
    FROM sims s
  ),
  alunos AS (
    SELECT u.id, u.nome, u.semestre
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
      AND (v_q IS NULL OR u.nome ILIKE '%' || v_q || '%')
  ),
  tri_raw AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, r.score_proprio
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
      AND r.score_proprio IS NOT NULL
  ),
  tri AS (
    SELECT DISTINCT ON (tr.student_id, tr.pai_id)
           tr.pai_id, tr.student_id, tr.score_proprio
    FROM tri_raw tr
    ORDER BY tr.student_id, tr.pai_id, tr.score_proprio DESC
  ),
  sims_com_tri AS (
    SELECT s.* FROM sims_ord s WHERE EXISTS (SELECT 1 FROM tri t WHERE t.pai_id = s.id)
  ),
  aluno_sim AS (
    SELECT a.id, s.id AS sim_id, s.ord,
           (SELECT avg(t.score_proprio) FROM tri t WHERE t.student_id = a.id AND t.pai_id = s.id) AS score
    FROM alunos a
    CROSS JOIN sims_com_tri s
  ),
  diffs AS (
    SELECT d.id, d.diff
    FROM (
      SELECT s.id, s.score - lag(s.score) OVER (PARTITION BY s.id ORDER BY s.ord) AS diff
      FROM aluno_sim s WHERE s.score IS NOT NULL
    ) d
    WHERE d.diff IS NOT NULL
  ),
  tend AS (
    SELECT x.id,
           CASE WHEN x.subiu AND x.desceu THEN 'alternando'
                WHEN x.subiu             THEN 'subindo'
                WHEN x.desceu             THEN 'descendo'
                ELSE 'estavel' END AS tendencia
    FROM (
      SELECT d.id, bool_or(d.diff > 0) AS subiu, bool_or(d.diff < 0) AS desceu
      FROM diffs d GROUP BY d.id
    ) x
  ),
  agg AS (
    SELECT a.id, a.nome, a.semestre,
           COALESCE((
             SELECT jsonb_agg(
                      jsonb_build_object(
                        'simuladoId', s.sim_id,
                        'valor',      CASE WHEN s.score IS NULL THEN NULL ELSE round(s.score::numeric, 1) END
                      ) ORDER BY s.ord)
             FROM aluno_sim s WHERE s.id = a.id), '[]'::jsonb) AS proficiencias,
           (SELECT count(*) FROM aluno_sim s WHERE s.id = a.id AND s.score IS NOT NULL) AS n_com,
           (SELECT count(*) FROM aluno_sim s WHERE s.id = a.id AND s.score >= 60)       AS n_prof,
           (SELECT s.score FROM aluno_sim s WHERE s.id = a.id AND s.score IS NOT NULL
             ORDER BY s.ord DESC LIMIT 1)                                               AS prof_atual,
           COALESCE((SELECT t.tendencia FROM tend t WHERE t.id = a.id), 'estavel')      AS tendencia
    FROM alunos a
  ),
  linhas AS (
    SELECT g.*,
           CASE WHEN g.n_com = 0                 THEN NULL
                WHEN g.n_prof = g.n_com          THEN 'consistentemente_proficiente'
                WHEN g.n_prof = 0                THEN 'consistentemente_nao_proficiente'
                ELSE 'em_variacao' END AS grupo
    FROM agg g
  ),
  ordenado AS (
    SELECT l.*, row_number() OVER (
             ORDER BY
               CASE WHEN v_sort='semestre'     AND v_order='asc'  THEN l.semestre    END ASC  NULLS LAST,
               CASE WHEN v_sort='semestre'     AND v_order='desc' THEN l.semestre    END DESC NULLS LAST,
               CASE WHEN v_sort='proficiencia' AND v_order='asc'  THEN l.prof_atual  END ASC  NULLS LAST,
               CASE WHEN v_sort='proficiencia' AND v_order='desc' THEN l.prof_atual  END DESC NULLS LAST,
               CASE WHEN v_sort='tendencia'    AND v_order='asc'  THEN l.tendencia   END ASC,
               CASE WHEN v_sort='tendencia'    AND v_order='desc' THEN l.tendencia   END DESC,
               CASE WHEN v_sort='nome'         AND v_order='desc' THEN l.nome        END DESC,
               l.nome ASC
           ) AS rn
    FROM linhas l
  ),
  totais AS (SELECT count(*) AS total FROM linhas)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'data', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'id',            o.id,
                 'nome',          o.nome,
                 'semestre',      o.semestre,
                 'grupo',         o.grupo,
                 'proficiencias', o.proficiencias,
                 'tendencia',     o.tendencia
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
      'periodo',      COALESCE((SELECT to_char(min(s.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(s.data_ref),'DD/MM/YYYY')
                                FROM sims_com_tri s), 'sem simulado com resultado'),
      'fonte',        'resultados_alunos_tri · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Uma posição em proficiencias por simulado com TRI na janela, cada posição com o id do simulado (simuladoId) e o valor correspondente (número ou null onde o aluno não participou — nunca 0), em ordem cronológica. Quando o simulado tem 2+ "filhos" (simulados-irmãos) com resultado, considera a MELHOR tentativa do aluno por filho (maior score_proprio), a mesma linha que o detalhamento do aluno mostra. Grupo: sem nenhum resultado de TRI ainda = null (nota chega depois, por pipeline); todas proficientes (>= 60) = consistentemente_proficiente; nenhuma = consistentemente_nao_proficiente; misto = em_variacao. Tendência sobre a janela toda: existe alguma variação consecutiva positiva E alguma negativa = alternando; só positiva = subindo; só negativa = descendo; nenhuma variação diferente de zero (ou menos de dois pontos com resultado) = estável — sem banda morta, qualquer diferença de sinal conta. Ordenação: %s %s. Recorte: %s.', v_sort, v_order, v_recorte),
      'partial',      (SELECT count(*) FROM sims_ord) > (SELECT count(*) FROM sims_com_tri),
      'lowSample',    (SELECT total FROM totais) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_gestor_aluno(p_ies_id uuid, p_aluno_id uuid, p_simulados uuid[])
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

  -- resolucao de v_ies (ainda NAO autoriza -- ver "(A) ACHADO 15" no cabecalho)
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

  -- autorizacao da IES RESOLVIDA, por papel (achado 15/card 119, substitui
  -- public.user_can_access_ies -- gestor puro so acessa users.id_ies, nunca
  -- get_accessible_ies, mesmo com user_groups orfao).
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
  alunos AS (
    SELECT u.id, u.nome, u.semestre
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
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
  tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb),
  tri_raw AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, r.score_proprio, r.num_correct
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  -- gap 112: UMA linha por (student_id, pai_id) ANTES de qualquer max/contagem.
  -- Critério de desempate CANÔNICO (igual ao de get_gestor_visao_geral,
  -- 20260804170000, e ao de get_gestor_alunos, 20260804172000): MAIOR
  -- score_proprio por (student_id, pai_id). NULLS LAST é OBRIGATÓRIO aqui
  -- (diferente das outras duas consumidoras do critério): esta função NÃO
  -- filtra score_proprio IS NOT NULL em tri_raw -- precisa preservar a linha
  -- pendente quando é a ÚNICA para aquele (aluno, pai), para não regredir o
  -- achado 4 (aguardando_resultado). Sem NULLS LAST, o padrão do Postgres
  -- para ORDER BY ... DESC é NULLS FIRST, e uma linha NULL "venceria" um
  -- score real do MESMO aluno no MESMO pai_id quando há 2+ linhas -- exatamente
  -- o cenário que este gap precisa fechar sem regredir. Ver bloco "(B) GAP
  -- 112" no cabeçalho para a prova completa.
  tri AS (
    SELECT DISTINCT ON (tr.student_id, tr.pai_id)
           tr.pai_id, tr.student_id, tr.score_proprio, tr.num_correct
    FROM tri_raw tr
    ORDER BY tr.student_id, tr.pai_id, tr.score_proprio DESC NULLS LAST
  ),
  areas_ies AS (
    SELECT q.grande_area AS area,
           count(*) AS total, count(*) FILTER (WHERE ap.correct) AS acertos
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false AND q.grande_area IS NOT NULL
    GROUP BY q.grande_area
  ),
  linha AS (
    SELECT s.id AS pai_id, s.nome, s.data_ref, s.ord,
           EXISTS (SELECT 1 FROM tentativas t WHERE t.user_id = p_aluno_id AND t.pai_id = s.id) AS participou,
           (SELECT count(*) FILTER (WHERE ap.correct)
              FROM tentativas t
              JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
              JOIN public.questoes_simulado q ON q.id = ap.question_id
             WHERE t.user_id = p_aluno_id AND t.pai_id = s.id AND COALESCE(q.anulada,false) = false) AS acertos_calc,
           (SELECT max(tr.score_proprio) FROM tri tr WHERE tr.student_id = p_aluno_id AND tr.pai_id = s.id) AS proficiencia,
           (SELECT count(*) FROM tri tr WHERE tr.pai_id = s.id AND tr.score_proprio IS NOT NULL) AS n_total,
           (SELECT count(*) FROM tri tr WHERE tr.pai_id = s.id AND tr.score_proprio >
                   COALESCE((SELECT max(t2.score_proprio) FROM tri t2 WHERE t2.student_id = p_aluno_id AND t2.pai_id = s.id), -1)) AS n_acima
    FROM sims_ord s
  ),
  linha_var AS (
    SELECT l.*,
           l.proficiencia - lag(l.proficiencia) OVER (ORDER BY l.ord) AS variacao
    FROM linha l
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',           p_aluno_id,
               'nome',         (SELECT a.nome FROM alunos a WHERE a.id = p_aluno_id),
               'semestre',     (SELECT a.semestre FROM alunos a WHERE a.id = p_aluno_id),
               'simuladoId',   lv.pai_id,
               'simuladoNome', lv.nome,
               'simuladoData', to_char(lv.data_ref AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
               'participou',   lv.participou,
               'acertos',      CASE WHEN lv.participou THEN lv.acertos_calc END,
               'proficiencia', CASE WHEN lv.proficiencia IS NULL THEN NULL
                                    ELSE round(lv.proficiencia::numeric, 1) END,
               'situacao',     CASE WHEN NOT lv.participou           THEN 'nao_participou'
                                    WHEN lv.proficiencia IS NULL     THEN 'aguardando_resultado'
                                    WHEN lv.proficiencia >= 60       THEN 'proficiente'
                                    ELSE 'abaixo_do_limiar' END,
               'posicao',      CASE WHEN lv.proficiencia IS NOT NULL AND lv.n_total > 0
                                    THEN jsonb_build_object(
                                           'lugar',     lv.n_acima + 1,
                                           'total',     lv.n_total,
                                           'percentil', round(100.0 * (lv.n_total - lv.n_acima) / lv.n_total, 0))
                               END,
               'acertoPorArea', CASE WHEN lv.participou THEN COALESCE((
                                  SELECT jsonb_agg(jsonb_build_object(
                                           'area',      x.area,
                                           'acertoPct', round(100.0 * x.acertos / NULLIF(x.total,0), 0),
                                           'critica',   COALESCE((SELECT (100.0 * ai.acertos / NULLIF(ai.total,0)) < 30
                                                                  FROM areas_ies ai WHERE ai.area = x.area), false)
                                         ) ORDER BY x.area)
                                  FROM (
                                    SELECT q.grande_area AS area,
                                           count(*) AS total,
                                           count(*) FILTER (WHERE ap.correct) AS acertos
                                    FROM tentativas t
                                    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
                                    JOIN public.questoes_simulado q ON q.id = ap.question_id
                                    WHERE t.user_id = p_aluno_id AND t.pai_id = lv.pai_id
                                      AND COALESCE(q.anulada,false) = false AND q.grande_area IS NOT NULL
                                    GROUP BY q.grande_area
                                  ) x), '[]'::jsonb) END,
               'variacao',     CASE WHEN lv.variacao IS NULL THEN NULL ELSE round(lv.variacao::numeric, 1) END
             ) ORDER BY lv.ord)
      FROM linha_var lv), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(min(s.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(s.data_ref),'DD/MM/YYYY')
                                FROM sims_ord s), 'sem simulado na seleção'),
      'fonte',        'resultados_alunos_tri · answer_progress · questoes_simulado · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',    'Proficiência = score_proprio (0–100); proficiente >= 60. Quando o simulado tem 2+ "filhos" (simulados-irmãos) com resultado, considera a MELHOR tentativa do aluno por filho (maior score_proprio), a mesma linha que a tabela de alunos mostra. Aluno que não participou: participou=false e todas as métricas null, nunca 0. Aluno que participou e ainda não tem nota TRI processada: situacao=aguardando_resultado e proficiencia null (não é abaixo do limiar). Posição calculada só entre alunos com proficiência no mesmo simulado. Variação = diferença de proficiência em relação ao simulado imediatamente anterior da seleção; null quando falta um dos dois valores. acertoPorArea em % de acerto, questão anulada ignorada.',
      'partial',     (SELECT count(*) FROM linha_var WHERE participou AND proficiencia IS NULL) > 0,
      'lowSample',   COALESCE((SELECT max(lv.n_total) FROM linha_var lv), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_gestor_detalhamento(p_ies_id uuid, p_semestre text, p_simulados uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_ies     uuid;
  v_sems    int[];
  v_evid    int[];
  v_recorte text;
  v_n       int;
  v_aberta  boolean;
  v_result  jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_simulados IS NULL OR array_length(p_simulados,1) IS NULL THEN
    RAISE EXCEPTION 'selecao_de_simulados_obrigatoria' USING ERRCODE = '22023';
  END IF;
  v_n := array_length(p_simulados,1);

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

  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_evid := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_evid := ARRAY[11,12]; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_evid := v_sems;
    v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_simulados) AS pedido(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.simulados_admin sa
      WHERE sa.id = pedido.id
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
    )
  ) THEN
    RAISE EXCEPTION 'simulado_fora_do_escopo' USING ERRCODE = '42501';
  END IF;

  IF v_n = 1 THEN
    SELECT (
      sa.status = 'ativo'
      AND (sa.data_liberacao IS NULL OR sa.data_liberacao <= now())
      AND (sa.data_encerramento IS NULL OR sa.data_encerramento >= now())
    )
    INTO v_aberta
    FROM public.simulados_admin sa
    WHERE sa.id = p_simulados[1];
  ELSE
    v_aberta := false;
  END IF;

  WITH sims AS (
    SELECT sa.id, sa.nome,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
    FROM public.simulados_admin sa
    WHERE sa.id = ANY (p_simulados)
  ),
  sims_ord AS (
    SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord FROM sims s
  ),
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  alunos AS (
    SELECT u.id, u.nome, u.semestre
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
  tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb),
  respostas AS (
    SELECT t.pai_id, t.user_id, a.semestre, ap.correct, ap.question_id,
           q.grande_area, q.tema
    FROM tentativas t
    JOIN alunos a ON a.id = t.user_id
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
  ),
  tri_raw AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, a.semestre, r.score_proprio,
           sa.id AS simulado_id,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    JOIN alunos a ON a.id = r.student_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
      AND r.score_proprio IS NOT NULL
  ),
  tri AS (
    SELECT DISTINCT ON (t.student_id, t.pai_id)
           t.pai_id, t.student_id, t.semestre, t.score_proprio
    FROM tri_raw t
    ORDER BY t.student_id, t.pai_id, t.score_proprio DESC
  ),
  metricas AS (
    SELECT s.id, s.nome, s.data_ref, s.ord,
           (SELECT count(DISTINCT r.user_id) FROM respostas r WHERE r.pai_id = s.id) AS n_resp,
           (SELECT count(*) FILTER (WHERE r.correct) FROM respostas r WHERE r.pai_id = s.id) AS acertos,
           (SELECT count(*) FROM respostas r WHERE r.pai_id = s.id) AS total,
           (SELECT count(DISTINCT t.student_id) FROM tri t WHERE t.pai_id = s.id) AS n_tri,
           (SELECT count(DISTINCT t.student_id) FILTER (WHERE t.score_proprio >= 60) FROM tri t WHERE t.pai_id = s.id) AS n_prof,
           (SELECT avg(t.score_proprio) FROM tri t WHERE t.pai_id = s.id) AS prof_media
    FROM sims_ord s
  ),
  areas AS (
    SELECT r.grande_area AS area,
           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos
    FROM respostas r WHERE r.grande_area IS NOT NULL GROUP BY r.grande_area
  ),
  areas_nivel AS (
    SELECT a.area, round(100.0 * a.acertos / NULLIF(a.total,0), 0) AS acerto_pct
    FROM areas a
  ),
  semestres AS (
    SELECT r.semestre,
           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos
    FROM respostas r WHERE r.semestre IS NOT NULL GROUP BY r.semestre
  ),
  dispersao AS (
    SELECT DISTINCT ON (t.student_id) t.student_id, t.semestre, t.score_proprio
    FROM tri t JOIN metricas m ON m.id = t.pai_id
    ORDER BY t.student_id, m.ord DESC
  ),
  -- Simulado que a lista descreve: o MAIS RECENTE do recorte, a mesma
  -- convenção da CTE dispersao (ORDER BY ord DESC).
  alvo AS (
    SELECT s.id, s.ord FROM sims_ord s ORDER BY s.ord DESC LIMIT 1
  ),
  anterior AS (
    SELECT s.id FROM sims_ord s, alvo a WHERE s.ord = a.ord - 1
  ),
  aluno_linha AS (
    SELECT a.id, a.nome, a.semestre,
           EXISTS (SELECT 1 FROM tentativas t, alvo v
                    WHERE t.user_id = a.id AND t.pai_id = v.id) AS participou,
           -- Contagem absoluta de acertos, não percentual: é o mesmo contrato
           -- de acertos_calc em get_gestor_aluno, e o front formata igual.
           (SELECT count(*) FILTER (WHERE r.correct)
              FROM respostas r, alvo v
             WHERE r.user_id = a.id AND r.pai_id = v.id) AS acertos_calc,
           (SELECT t.score_proprio FROM tri t, alvo v
             WHERE t.student_id = a.id AND t.pai_id = v.id) AS prof_atual,
           (SELECT t.score_proprio FROM tri t, anterior p
             WHERE t.student_id = a.id AND t.pai_id = p.id) AS prof_anterior
    FROM alunos a
  ),
  q_base AS (
    SELECT q.id, COALESCE(q.numero_questao, q.ordem) AS numero,
           q.grande_area, q.especialidade, q.tema, q.enunciado, upper(q.correta) AS correta,
           q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d, q.alternativa_e
    FROM public.questoes_simulado q
    WHERE v_n = 1
      AND q.simulado_id IN (SELECT g.simulado_id FROM grupo g)
      AND COALESCE(q.anulada,false) = false
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
             'correta',    CASE WHEN v_aberta THEN NULL ELSE (a.letra = f.correta) END,
             'marcadaPct', CASE WHEN f.marcadas > 0 THEN round(100.0 * a.n / f.marcadas, 0) END
           ) ORDER BY a.letra) AS alternativas,
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
  q_page AS (
    SELECT f.*, al.alternativas, al.distrator,
           row_number() OVER (ORDER BY f.numero) AS rn
    FROM q_full f JOIN q_alts al ON al.id = f.id
  ),
  temas_cmp AS (
    SELECT r.tema, r.pai_id,
           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos
    FROM respostas r
    WHERE v_n >= 2 AND r.tema IS NOT NULL
    GROUP BY r.tema, r.pai_id
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'metricas', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'simuladoId',        m.id,
                 'nome',              m.nome,
                 'data',              to_char(m.data_ref AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 'participantes',     GREATEST(m.n_resp, m.n_tri),
                 'acertoMedioPct',    CASE WHEN m.total > 0 THEN round(100.0 * m.acertos / m.total, 0) END,
                 'enamedProjetado',   CASE WHEN m.n_tri = 0 THEN NULL
                                           WHEN 100.0 * m.n_prof / m.n_tri >= 90 THEN 5
                                           WHEN 100.0 * m.n_prof / m.n_tri >= 75 THEN 4
                                           WHEN 100.0 * m.n_prof / m.n_tri >= 60 THEN 3
                                           WHEN 100.0 * m.n_prof / m.n_tri >= 40 THEN 2
                                           ELSE 1 END,
                 'proficienciaMedia', CASE WHEN m.prof_media IS NULL THEN NULL
                                           ELSE round(m.prof_media::numeric, 1) END
               ) ORDER BY m.ord)
        FROM metricas m), '[]'::jsonb),
      'alunos', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'id',           l.id,
                 'nome',         l.nome,
                 'semestre',     l.semestre,
                 'participou',   l.participou,
                 'acertos',      CASE WHEN l.participou THEN l.acertos_calc END,
                 'proficiencia', CASE WHEN l.prof_atual IS NULL THEN NULL
                                      ELSE round(l.prof_atual::numeric, 1) END,
                 'situacao',     CASE WHEN NOT l.participou     THEN 'nao_participou'
                                      WHEN l.prof_atual IS NULL THEN 'aguardando_resultado'
                                      WHEN l.prof_atual >= 60   THEN 'proficiente'
                                      ELSE 'abaixo_do_limiar' END,
                 'variacao',     CASE WHEN l.prof_atual IS NOT NULL AND l.prof_anterior IS NOT NULL
                                      THEN round((l.prof_atual - l.prof_anterior)::numeric, 1) END
               ) ORDER BY l.nome)
        FROM aluno_linha l
      ), '[]'::jsonb),
      'acertoPorAreaESemestre', jsonb_build_object(
        'areas', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'id',        a.area,
                   'nome',      a.area,
                   'acertoPct', a.acerto_pct,
                   'critica',   COALESCE(a.acerto_pct < 30, false)
                 ) ORDER BY a.area)
          FROM areas_nivel a), '[]'::jsonb),
        'semestres', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'semestre',    s.semestre,
                   'acertoPct',   round(100.0 * s.acertos / NULLIF(s.total,0), 0),
                   'emEvidencia', COALESCE(s.semestre = ANY (v_evid), false)
                 ) ORDER BY s.semestre)
          FROM semestres s), '[]'::jsonb),
        'matriz', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'areaId',    m.grande_area,
                   'semestre',  m.semestre,
                   'acertoPct', round(100.0 * m.acertos / NULLIF(m.total,0), 0),
                   'amostra',   m.total
                 ) ORDER BY m.grande_area, m.semestre)
          FROM (
            SELECT r.grande_area, r.semestre,
                   count(*) AS total,
                   count(*) FILTER (WHERE r.correct) AS acertos
            FROM respostas r
            WHERE r.grande_area IS NOT NULL AND r.semestre IS NOT NULL
            GROUP BY r.grande_area, r.semestre
          ) m), '[]'::jsonb)
      ),
      'dispersao', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'alunoId',  d.student_id,
                 'semestre', d.semestre,
                 'nota',     round(d.score_proprio::numeric, 1)))
        FROM dispersao d WHERE d.semestre IS NOT NULL), '[]'::jsonb),
      'questoes', CASE WHEN v_n = 1 THEN jsonb_build_object(
        'data', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'numero',       p.numero,
                   'grandeArea',   p.grande_area,
                   'especialidade',p.especialidade,
                   'tema',         p.tema,
                   'acertoPct',    p.acerto_pct,
                   'enunciado',    p.enunciado,
                   'alternativas', p.alternativas,
                   'distratorDominante', p.distrator
                 ) ORDER BY p.rn)
          FROM q_page p WHERE p.rn <= 20), '[]'::jsonb),
        'page',       1,
        'pageSize',   20,
        'total',      (SELECT count(*) FROM q_page),
        'totalPages', CASE WHEN (SELECT count(*) FROM q_page) = 0 THEN 0
                           ELSE ceil((SELECT count(*) FROM q_page)::numeric / 20)::int END
      ) END,
      'comparativoTemas', CASE WHEN v_n >= 2 THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'tema', t.tema,
                 'porSimulado', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object(
                            'simuladoId', m.id,
                            'acertoPct',  round(100.0 * c.acertos / NULLIF(c.total,0), 0)
                          ) ORDER BY m.ord)
                   FROM temas_cmp c JOIN metricas m ON m.id = c.pai_id
                   WHERE c.tema = t.tema), '[]'::jsonb)
               ) ORDER BY t.tema)
        FROM (SELECT DISTINCT tema FROM temas_cmp) t), '[]'::jsonb) END
    ),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(min(m.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(m.data_ref),'DD/MM/YYYY')
                                FROM metricas m), 'seleção sem data'),
      'fonte',        'resultados_alunos_tri · answer_progress · questoes_simulado · simulados_admin · simulados_finalizados · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Uma entrada em metricas por simulado selecionado; nenhuma média entre simulados. Conceito ENAMED por simulado, derivado do %% de proficientes (>= 60, alunos distintos, uma linha de TRI por aluno por simulado-pai, desempate pela tentativa mais recente). %% de acerto sobre a última tentativa de cada aluno, questão anulada ignorada. Questões só com 1 simulado selecionado; comparativo por tema só com 2 ou mais. Prova ainda aberta ao aluno (status ativo, dentro da janela de liberação/encerramento): %s — enquanto aberta, correta e distratorDominante vêm null, gabarito não é exposto. Simulados selecionados: %s. Recorte: %s.', v_aberta, v_n, v_recorte),
      'partial',      (SELECT count(*) FROM metricas WHERE n_tri = 0) > 0,
      'lowSample',    COALESCE((SELECT min(GREATEST(m.n_resp, m.n_tri)) FROM metricas m), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_gestor_questoes(p_ies_id uuid, p_simulado_id uuid, p_page integer, p_page_size integer, p_sort text, p_area text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
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

  SELECT (
    sa.status = 'ativo'
    AND (sa.data_liberacao IS NULL OR sa.data_liberacao <= now())
    AND (sa.data_encerramento IS NULL OR sa.data_encerramento >= now())
  )
  INTO v_aberta
  FROM public.simulados_admin sa
  WHERE sa.id = p_simulado_id;

  v_sort := lower(COALESCE(NULLIF(btrim(p_sort),''), 'numero'));
  IF v_sort NOT IN ('numero','acerto','acerto_desc') THEN
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
             'correta',    CASE WHEN v_aberta THEN NULL ELSE (a.letra = f.correta) END,
             'marcadaPct', CASE WHEN f.marcadas > 0 THEN round(100.0 * a.n / f.marcadas, 0) END
           ) ORDER BY a.letra) AS alternativas,
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
               CASE WHEN v_sort = 'acerto_desc' THEN f.acerto_pct END DESC NULLS LAST,
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
$function$;