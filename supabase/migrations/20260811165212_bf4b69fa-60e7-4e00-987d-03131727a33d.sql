CREATE OR REPLACE FUNCTION public.get_gestor_questoes(p_ies_id uuid, p_simulado_id uuid, p_page integer, p_page_size integer, p_sort text, p_area text, p_semestre text DEFAULT NULL::text)
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
  v_sems   int[];
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

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL;
  ELSIF p_semestre = '6ano' THEN
    v_sems := ARRAY[11,12];
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int];
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
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
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
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
           q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d, q.alternativa_e,
           q.imagem AS imagem_enunciado, q.imagem_2 AS imagem_enunciado_2, q.imagem_comentario
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
                 'id',                 o.id,
                 'numero',             o.numero,
                 'grandeArea',         o.grande_area,
                 'especialidade',      o.especialidade,
                 'tema',               o.tema,
                 'acertoPct',          o.acerto_pct,
                 'enunciado',          o.enunciado,
                 'imagemEnunciado',    o.imagem_enunciado,
                 'imagemEnunciado2',   o.imagem_enunciado_2,
                 'imagemComentario',   CASE WHEN v_aberta THEN NULL ELSE o.imagem_comentario END,
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

REVOKE ALL ON FUNCTION public.get_gestor_questoes(uuid, uuid, integer, integer, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_gestor_questoes(uuid, uuid, integer, integer, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_questoes(uuid, uuid, integer, integer, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gestor_questoes(uuid, uuid, integer, integer, text, text, text) TO service_role;