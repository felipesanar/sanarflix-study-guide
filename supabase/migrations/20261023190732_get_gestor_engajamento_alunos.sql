-- get_gestor_engajamento_alunos / _lista / _aluno / _export_alunos: RPCs de alunos da aba Visão geral
-- Spec: docs/superpowers/specs/2026-10-22-engajamento-sanarflix-design.md (§7.1, §7.3, §8.2, §8.3, §8.4, §8.9)
-- Cabeçalho, DECLARE e guardas 1–3 iguais aos da §8.1; corpo = SQL de referência de cada seção.

-- ============================================================
-- §8.2 get_gestor_engajamento_alunos
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_alunos(
  p_ies_id             uuid,
  p_inicio             date,
  p_fim                date,
  p_semestre           smallint DEFAULT NULL,
  p_ordem              text     DEFAULT 'questoes',
  p_busca              text     DEFAULT NULL,
  p_sem_atividade_14d  boolean  DEFAULT false,
  p_page               integer  DEFAULT 1,
  p_page_size          integer  DEFAULT 20
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_ies       uuid;
  v_criterio  text := 'Base ativa: alunos com perfil de aluno e acesso ativo hoje, do 1º ao 12º semestre. Engajado: ao menos um dia com questão respondida ou conteúdo aberto no período. Questões contam só quando a questão tem classificação principal; acerto = corretas ÷ (corretas + erradas). Conteúdo consumido = aluno × conteúdo × dia. Tempo sem atividade é contado até hoje.';
  v_busca     text;
  v_r         jsonb;
BEGIN
  IF NOT ( has_role(v_uid,'admin'::app_role) OR has_role(v_uid,'gestor'::app_role) OR has_role(v_uid,'gestor_grupo'::app_role) ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_ies_id IS NOT NULL THEN
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN v_ies := (public.get_accessible_ies(v_uid))[1]; END IF;
  END IF;
  IF v_ies IS NULL THEN RAISE EXCEPTION 'IES not resolved'; END IF;
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  PERFORM public.eng_validar_periodo(p_inicio, p_fim);
  IF p_semestre IS NOT NULL AND p_semestre NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_ordem NOT IN ('questoes', 'videos', 'documentos') THEN RAISE EXCEPTION 'ordem_invalida' USING ERRCODE = '22023'; END IF;
  IF p_page IS NULL OR p_page < 1 OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'paginacao_invalida' USING ERRCODE = '22023';
  END IF;
  v_busca := nullif(public.eng_norm_busca(btrim(coalesce(p_busca, ''))), '');

  WITH r AS MATERIALIZED (
    SELECT x.*,
           CASE p_ordem WHEN 'questoes' THEN x.questoes WHEN 'videos' THEN x.videos ELSE x.documentos END AS chave
    FROM public.eng_alunos_recorte(v_ies, p_inicio, p_fim) x
    WHERE (p_semestre IS NULL OR x.semestre = p_semestre)
      AND (v_busca IS NULL OR strpos(public.eng_norm_busca(x.nome), v_busca) > 0)
      AND (NOT p_sem_atividade_14d OR x.dias_sem_atividade IS NULL OR x.dias_sem_atividade >= 14)
  ),
  t AS (SELECT count(*) AS total FROM r),
  pg AS (
    SELECT r.* FROM r ORDER BY r.chave DESC, r.nome, r.sanarflix_user_id
    OFFSET (p_page - 1) * p_page_size LIMIT p_page_size
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'data', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', pg.sanarflix_user_id, 'nome', pg.nome, 'semestre', pg.semestre,
          'questoes', pg.questoes, 'acertoPct', public.eng_pct(pg.acertos, pg.acertos + pg.erros),
          'videos', pg.videos, 'documentos', pg.documentos,
          'ultimaAtividade', pg.ultima_atividade, 'diasSemAtividade', pg.dias_sem_atividade)
        ORDER BY pg.chave DESC, pg.nome, pg.sanarflix_user_id) FROM pg), '[]'::jsonb),
      'page', p_page,
      'pageSize', p_page_size,
      'total', t.total,
      'totalPages', greatest(1, ceil(t.total::numeric / p_page_size))::int),
    'meta', public.eng_meta(p_inicio, p_fim, t.total < 10, v_criterio)
  ) INTO v_r FROM t;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_alunos(uuid, date, date, smallint, text, text, boolean, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_alunos(uuid, date, date, smallint, text, text, boolean, integer, integer) TO authenticated;

-- ============================================================
-- §8.3 get_gestor_engajamento_lista
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_lista(
  p_ies_id     uuid,
  p_inicio     date,
  p_fim        date,
  p_semestre   smallint DEFAULT NULL,
  p_aluno      text     DEFAULT NULL,
  p_categoria  text     DEFAULT 'sumidos30mais',
  p_busca      text     DEFAULT NULL,
  p_page       integer  DEFAULT 1,
  p_page_size  integer  DEFAULT 20
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_ies       uuid;
  v_criterio  text := 'Base ativa: alunos com perfil de aluno e acesso ativo hoje, do 1º ao 12º semestre. Engajado: ao menos um dia com questão respondida ou conteúdo aberto no período. Questões contam só quando a questão tem classificação principal; acerto = corretas ÷ (corretas + erradas). Conteúdo consumido = aluno × conteúdo × dia. Tempo sem atividade é contado até hoje.';
  v_busca     text;
  v_desc      boolean;
  v_r         jsonb;
BEGIN
  IF NOT ( has_role(v_uid,'admin'::app_role) OR has_role(v_uid,'gestor'::app_role) OR has_role(v_uid,'gestor_grupo'::app_role) ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_ies_id IS NOT NULL THEN
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN v_ies := (public.get_accessible_ies(v_uid))[1]; END IF;
  END IF;
  IF v_ies IS NULL THEN RAISE EXCEPTION 'IES not resolved'; END IF;
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  PERFORM public.eng_validar_periodo(p_inicio, p_fim);
  IF p_semestre IS NOT NULL AND p_semestre NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;
  IF p_semestre IS NOT NULL AND p_aluno IS NOT NULL THEN
    RAISE EXCEPTION 'filtro_conflitante' USING ERRCODE = '22023';
  END IF;
  IF p_aluno IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.eng_base_ativa(v_ies) b WHERE b.sanarflix_user_id = p_aluno) THEN
    RAISE EXCEPTION 'aluno_fora_do_recorte' USING ERRCODE = '22023';
  END IF;

  IF p_categoria NOT IN ('frequente','esporadico','parou','nunca','ativos30','sumidos30a59','sumidos60','nunca_acessou','sumidos30mais') THEN
    RAISE EXCEPTION 'categoria_invalida' USING ERRCODE = '22023';
  END IF;
  IF p_page IS NULL OR p_page < 1 OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'paginacao_invalida' USING ERRCODE = '22023';
  END IF;
  v_busca := nullif(public.eng_norm_busca(btrim(coalesce(p_busca, ''))), '');
  v_desc  := p_categoria IN ('ativos30', 'sumidos30a59', 'sumidos60', 'sumidos30mais');

  WITH r AS MATERIALIZED (
    SELECT x.*,
           CASE WHEN v_desc THEN -coalesce(x.dias_sem_atividade, -1)          -- desc, nulos por último
                ELSE coalesce(x.dias_sem_atividade, 2147483647) END AS chave  -- asc, nulos por último
    FROM public.eng_alunos_recorte(v_ies, p_inicio, p_fim) x
    WHERE (p_semestre IS NULL OR x.semestre = p_semestre)
      AND (p_aluno IS NULL OR x.sanarflix_user_id = p_aluno)
      AND (v_busca IS NULL OR strpos(public.eng_norm_busca(x.nome), v_busca) > 0)
      AND CASE p_categoria
            WHEN 'sumidos30mais' THEN x.faixa_recencia IN ('sumidos30a59', 'sumidos60')
            WHEN 'ativos30'      THEN x.faixa_recencia = 'ativos30'
            WHEN 'sumidos30a59'  THEN x.faixa_recencia = 'sumidos30a59'
            WHEN 'sumidos60'     THEN x.faixa_recencia = 'sumidos60'
            WHEN 'nunca_acessou' THEN x.faixa_recencia = 'nunca_acessou'
            ELSE x.nivel = p_categoria
          END
  ),
  t AS (SELECT count(*) AS total FROM r),
  pg AS (SELECT r.* FROM r ORDER BY r.chave, r.nome, r.sanarflix_user_id OFFSET (p_page - 1) * p_page_size LIMIT p_page_size)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'categoria', p_categoria,
      'data', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', pg.sanarflix_user_id, 'nome', pg.nome, 'semestre', pg.semestre,
          'ultimaAtividade', pg.ultima_atividade, 'diasSemAtividade', pg.dias_sem_atividade,
          'diasAtivos30', pg.dias_ativos_30,
          'melhorMes', to_char(pg.melhor_mes, 'YYYY-MM'), 'melhorMesDias', pg.melhor_mes_dias,
          'detalhe', public.eng_detalhe_atividade(pg.sanarflix_user_id, pg.ultima_atividade))
        ORDER BY pg.chave, pg.nome, pg.sanarflix_user_id) FROM pg), '[]'::jsonb),
      'page', p_page, 'pageSize', p_page_size, 'total', t.total,
      'totalPages', greatest(1, ceil(t.total::numeric / p_page_size))::int),
    'meta', public.eng_meta(p_inicio, p_fim, t.total < 10, v_criterio)
  ) INTO v_r FROM t;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_lista(uuid, date, date, smallint, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_lista(uuid, date, date, smallint, text, text, text, integer, integer) TO authenticated;

-- ============================================================
-- §8.4 get_gestor_engajamento_aluno (drawer)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_aluno(
  p_ies_id  uuid,
  p_inicio  date,
  p_fim     date,
  p_aluno   text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_ies       uuid;
  v_criterio  text := 'Base ativa: alunos com perfil de aluno e acesso ativo hoje, do 1º ao 12º semestre. Engajado: ao menos um dia com questão respondida ou conteúdo aberto no período. Questões contam só quando a questão tem classificação principal; acerto = corretas ÷ (corretas + erradas). Conteúdo consumido = aluno × conteúdo × dia. Tempo sem atividade é contado até hoje.';
  v_sem       smallint;
  v_r         jsonb;
BEGIN
  IF NOT ( has_role(v_uid,'admin'::app_role) OR has_role(v_uid,'gestor'::app_role) OR has_role(v_uid,'gestor_grupo'::app_role) ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_ies_id IS NOT NULL THEN
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN v_ies := (public.get_accessible_ies(v_uid))[1]; END IF;
  END IF;
  IF v_ies IS NULL THEN RAISE EXCEPTION 'IES not resolved'; END IF;
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  PERFORM public.eng_validar_periodo(p_inicio, p_fim);

  SELECT b.semestre INTO v_sem FROM public.eng_base_ativa(v_ies) b WHERE b.sanarflix_user_id = p_aluno;
  IF NOT FOUND THEN RAISE EXCEPTION 'aluno_fora_do_recorte' USING ERRCODE = '22023'; END IF;

  WITH ies_r AS MATERIALIZED (SELECT * FROM public.eng_alunos_recorte(v_ies, p_inicio, p_fim)),
  a AS (SELECT * FROM ies_r WHERE sanarflix_user_id = p_aluno),
  ks AS (SELECT count(*) FILTER (WHERE dias_ativos_periodo > 0) AS eng, sum(questoes) AS q, sum(acertos) AS ac, sum(erros) AS er
         FROM ies_r WHERE semestre = v_sem),
  meses AS (
    SELECT m.mes::date AS mes,
           (m.mes::date < p_inicio OR (m.mes + interval '1 month - 1 day')::date > p_fim) AS parcial,
           coalesce(sum(d.questoes), 0) AS q, coalesce(sum(d.videos), 0) AS vi, coalesce(sum(d.documentos), 0) AS dc
    FROM generate_series(date_trunc('month', p_inicio), date_trunc('month', p_fim), interval '1 month') AS m(mes)
    LEFT JOIN public.eng_atividade_aluno_dia d
      ON d.sanarflix_user_id = p_aluno AND d.dia BETWEEN p_inicio AND p_fim
     AND date_trunc('month', d.dia) = m.mes
    GROUP BY m.mes
  ),
  esp_aluno AS (
    SELECT x.esp_id, sum(x.questoes) AS q, sum(x.acertos) AS ac, sum(x.erros) AS er
    FROM public.eng_questoes_aluno_dia_no x
    WHERE x.sanarflix_user_id = p_aluno AND x.dia BETWEEN p_inicio AND p_fim
    GROUP BY x.esp_id
    ORDER BY sum(x.questoes) DESC
    LIMIT 5
  ),
  esp_sem AS (   -- média do mesmo semestre, mesmas especialidades
    SELECT x.esp_id, sum(x.acertos) AS ac, sum(x.erros) AS er
    FROM public.eng_questoes_aluno_dia_no x
    JOIN ies_r s ON s.sanarflix_user_id = x.sanarflix_user_id AND s.semestre = v_sem
    WHERE x.dia BETWEEN p_inicio AND p_fim AND x.esp_id IN (SELECT esp_id FROM esp_aluno)
    GROUP BY x.esp_id
  ),
  tl AS (   -- últimas atividades: todo o histórico até hoje (D7), 4 itens
    SELECT * FROM (
      SELECT x.dia, 0 AS prio, NULL::timestamp AS ts, 'questoes' AS tipo, n.nome AS especialidade,
             sum(x.questoes) AS questoes, public.eng_pct(sum(x.acertos), sum(x.acertos + x.erros)) AS acerto_pct, NULL::text AS conteudo
      FROM public.eng_questoes_aluno_dia_no x
      JOIN public.eng_no_taxonomia n ON n.no_id = x.esp_id
      WHERE x.sanarflix_user_id = p_aluno
      GROUP BY x.dia, n.nome
      UNION ALL
      SELECT c.dia, 1, c.ultima_abertura, CASE c.content_type WHEN 'video' THEN 'video' ELSE 'documento' END,
             c.especialidade, NULL, NULL, c.content_name
      FROM public.eng_consumo_aluno_dia_conteudo c
      WHERE c.sanarflix_user_id = p_aluno
    ) u
    ORDER BY u.dia DESC, u.prio, u.ts DESC NULLS LAST, u.questoes DESC NULLS LAST, u.especialidade, u.conteudo
    LIMIT 4
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'aluno', jsonb_build_object('id', a.sanarflix_user_id, 'nome', a.nome, 'semestre', a.semestre,
        'situacao', CASE a.faixa_recencia WHEN 'ativos30' THEN 'ativo' WHEN 'nunca_acessou' THEN 'sem_atividade' ELSE 'sumido' END,
        'ultimaAtividade', a.ultima_atividade, 'diasSemAtividade', a.dias_sem_atividade),
      'resumo', jsonb_build_object(
        'questoes', a.questoes, 'acertoPct', public.eng_pct(a.acertos, a.acertos + a.erros),
        'videos', a.videos, 'documentos', a.documentos,
        'diasAtivos', a.dias_ativos_periodo, 'diasNoPeriodo', p_fim - p_inicio + 1,
        'mediaSemestreQuestoes', CASE WHEN ks.eng > 0 THEN round(ks.q::numeric / ks.eng) END,
        'mediaSemestreAcertoPct', public.eng_pct(ks.ac, ks.ac + ks.er)),
      'meses', (SELECT jsonb_agg(jsonb_build_object('mes', to_char(m.mes, 'YYYY-MM'), 'parcial', m.parcial,
                  'questoes', m.q, 'videos', m.vi, 'documentos', m.dc) ORDER BY m.mes) FROM meses m),
      'especialidades', coalesce((SELECT jsonb_agg(jsonb_build_object(
                  'id', e.esp_id, 'nome', n.nome, 'questoes', e.q,
                  'acertoPct', public.eng_pct(e.ac, e.ac + e.er),
                  'acertoPctSemestre', public.eng_pct(s.ac, s.ac + s.er)) ORDER BY e.q DESC, n.nome)
                 FROM esp_aluno e JOIN public.eng_no_taxonomia n ON n.no_id = e.esp_id
                 LEFT JOIN esp_sem s ON s.esp_id = e.esp_id), '[]'::jsonb),
      'timeline', coalesce((SELECT jsonb_agg(jsonb_build_object(
                  'dia', t.dia, 'tipo', t.tipo, 'especialidade', t.especialidade,
                  'questoes', t.questoes, 'acertoPct', t.acerto_pct, 'conteudo', t.conteudo)
                 ORDER BY t.dia DESC, t.prio, t.ts DESC NULLS LAST) FROM tl t), '[]'::jsonb)
    ),
    'meta', public.eng_meta(p_inicio, p_fim, false, v_criterio)
  ) INTO v_r FROM a CROSS JOIN ks;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_aluno(uuid, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_aluno(uuid, date, date, text) TO authenticated;

-- ============================================================
-- §8.9 get_gestor_engajamento_export_alunos
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_export_alunos(
  p_ies_id             uuid,
  p_inicio             date,
  p_fim                date,
  p_semestre           smallint DEFAULT NULL,
  p_ordem              text     DEFAULT 'questoes',
  p_busca              text     DEFAULT NULL,
  p_sem_atividade_14d  boolean  DEFAULT false
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_ies       uuid;
  v_criterio  text := 'Base ativa: alunos com perfil de aluno e acesso ativo hoje, do 1º ao 12º semestre. Engajado: ao menos um dia com questão respondida ou conteúdo aberto no período. Questões contam só quando a questão tem classificação principal; acerto = corretas ÷ (corretas + erradas). Conteúdo consumido = aluno × conteúdo × dia. Tempo sem atividade é contado até hoje.';
  v_busca     text;
  v_r         jsonb;
BEGIN
  IF NOT ( has_role(v_uid,'admin'::app_role) OR has_role(v_uid,'gestor'::app_role) OR has_role(v_uid,'gestor_grupo'::app_role) ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_ies_id IS NOT NULL THEN
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN v_ies := (public.get_accessible_ies(v_uid))[1]; END IF;
  END IF;
  IF v_ies IS NULL THEN RAISE EXCEPTION 'IES not resolved'; END IF;
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  PERFORM public.eng_validar_periodo(p_inicio, p_fim);
  IF p_semestre IS NOT NULL AND p_semestre NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_ordem NOT IN ('questoes', 'videos', 'documentos') THEN RAISE EXCEPTION 'ordem_invalida' USING ERRCODE = '22023'; END IF;
  v_busca := nullif(public.eng_norm_busca(btrim(coalesce(p_busca, ''))), '');

  WITH r AS (
    SELECT x.*, CASE p_ordem WHEN 'questoes' THEN x.questoes WHEN 'videos' THEN x.videos ELSE x.documentos END AS chave
    FROM public.eng_alunos_recorte(v_ies, p_inicio, p_fim) x
    WHERE (p_semestre IS NULL OR x.semestre = p_semestre)
      AND (v_busca IS NULL OR strpos(public.eng_norm_busca(x.nome), v_busca) > 0)
      AND (NOT p_sem_atividade_14d OR x.dias_sem_atividade IS NULL OR x.dias_sem_atividade >= 14)
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'alunos', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'nome', r.nome, 'email', r.email, 'semestre', r.semestre,
          'questoes', r.questoes, 'acertoPct', public.eng_pct(r.acertos, r.acertos + r.erros),
          'videos', r.videos, 'documentos', r.documentos,
          'ultimaAtividade', r.ultima_atividade, 'diasSemAtividade', r.dias_sem_atividade)
        ORDER BY r.chave DESC, r.nome, r.sanarflix_user_id) FROM r), '[]'::jsonb)),
    'meta', public.eng_meta(p_inicio, p_fim, false, v_criterio)
  ) INTO v_r;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_export_alunos(uuid, date, date, smallint, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_export_alunos(uuid, date, date, smallint, text, text, boolean) TO authenticated;
