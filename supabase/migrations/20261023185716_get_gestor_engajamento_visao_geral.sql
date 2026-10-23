-- get_gestor_engajamento_visao_geral: RPC da aba Visão geral do Engajamento SanarFlix
-- Spec: docs/superpowers/specs/2026-10-22-engajamento-sanarflix-design.md (§7.1, §8.1)

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_visao_geral(
  p_ies_id   uuid,
  p_inicio   date,
  p_fim      date,
  p_semestre smallint DEFAULT NULL,
  p_aluno    text     DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_ies       uuid;
  v_hoje      date := public.eng_hoje();
  v_n         integer;
  v_ini_ant   date;
  v_mes_ref   date;
  v_sem_aluno smallint;
  v_ies_json  jsonb;
  v_criterio  text := 'Base ativa: alunos com perfil de aluno e acesso ativo hoje, do 1º ao 12º semestre. Engajado: ao menos um dia com questão respondida ou conteúdo aberto no período. Questões contam só quando a questão tem classificação principal; acerto = corretas ÷ (corretas + erradas). Conteúdo consumido = aluno × conteúdo × dia. Tempo sem atividade é contado até hoje.';
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
  IF p_aluno IS NOT NULL THEN
    SELECT b.semestre INTO v_sem_aluno FROM public.eng_base_ativa(v_ies) b WHERE b.sanarflix_user_id = p_aluno;
    IF NOT FOUND THEN RAISE EXCEPTION 'aluno_fora_do_recorte' USING ERRCODE = '22023'; END IF;
  END IF;

  v_n       := p_fim - p_inicio + 1;
  v_ini_ant := p_inicio - v_n;
  v_mes_ref := CASE WHEN p_fim = (date_trunc('month', p_fim) + interval '1 month - 1 day')::date
                    THEN date_trunc('month', p_fim)::date
                    ELSE (date_trunc('month', p_fim) - interval '1 month')::date END;
  SELECT jsonb_build_object('id', i.id, 'nome', i.nome) INTO v_ies_json FROM public.ies i WHERE i.id = v_ies;

  WITH
  ies_r AS MATERIALIZED (SELECT * FROM public.eng_alunos_recorte(v_ies, p_inicio, p_fim)),
  r AS MATERIALIZED (
    SELECT * FROM ies_r x
    WHERE (p_semestre IS NULL OR x.semestre = p_semestre)
      AND (p_aluno IS NULL OR x.sanarflix_user_id = p_aluno)
  ),
  k AS (
    SELECT count(*)                                                  AS base,
      count(*) FILTER (WHERE dias_ativos_periodo > 0)                AS eng,
      count(*) FILTER (WHERE dias_ativos_ant > 0)                    AS eng_ant,
      count(*) FILTER (WHERE faixa_recencia = 'ativos30')            AS ativos30,
      count(*) FILTER (WHERE faixa_recencia = 'sumidos30a59')        AS s3059,
      count(*) FILTER (WHERE faixa_recencia = 'sumidos60')           AS s60,
      count(*) FILTER (WHERE faixa_recencia = 'nunca_acessou')       AS nunca,
      coalesce(sum(questoes), 0) AS q,  coalesce(sum(acertos), 0) AS ac, coalesce(sum(erros), 0) AS er,
      coalesce(sum(videos), 0)   AS vi, coalesce(sum(documentos), 0) AS dc,
      coalesce(sum(questoes_ant), 0) AS q_ant, coalesce(sum(acertos_ant), 0) AS ac_ant, coalesce(sum(erros_ant), 0) AS er_ant,
      coalesce(sum(videos_ant), 0)   AS vi_ant, coalesce(sum(documentos_ant), 0) AS dc_ant,
      count(*) FILTER (WHERE questoes > 0)   AS al_q,
      count(*) FILTER (WHERE videos > 0)     AS al_v,
      count(*) FILTER (WHERE documentos > 0) AS al_d,
      count(*) FILTER (WHERE dias_ativos_mes_ref > 0)              AS h_ativos,
      count(*) FILTER (WHERE dias_ativos_mes_ref BETWEEN 1 AND 3)  AS h1,
      count(*) FILTER (WHERE dias_ativos_mes_ref BETWEEN 4 AND 7)  AS h2,
      count(*) FILTER (WHERE dias_ativos_mes_ref BETWEEN 8 AND 14) AS h3,
      count(*) FILTER (WHERE dias_ativos_mes_ref >= 15)            AS h4
    FROM r
  ),
  ki AS (   -- IES inteira: notas "média da IES" / "IES inteira"
    SELECT count(*) AS base, count(*) FILTER (WHERE dias_ativos_periodo > 0) AS eng,
      coalesce(sum(questoes), 0) AS q, coalesce(sum(acertos), 0) AS ac, coalesce(sum(erros), 0) AS er,
      coalesce(sum(videos), 0) AS vi, coalesce(sum(documentos), 0) AS dc
    FROM ies_r
  ),
  ks AS (   -- semestre do aluno filtrado: notas "média do semestre"
    SELECT count(*) AS base, count(*) FILTER (WHERE dias_ativos_periodo > 0) AS eng,
      coalesce(sum(questoes), 0) AS q, coalesce(sum(acertos), 0) AS ac, coalesce(sum(erros), 0) AS er,
      coalesce(sum(videos), 0) AS vi, coalesce(sum(documentos), 0) AS dc
    FROM ies_r WHERE semestre = v_sem_aluno
  ),
  meses AS (
    SELECT m.mes::date AS mes,
      (m.mes::date < p_inicio OR (m.mes + interval '1 month - 1 day')::date > p_fim) AS parcial,
      coalesce(x.alunos, 0) AS alunos, coalesce(x.dias, 0) AS dias,
      coalesce(x.q, 0) AS q, coalesce(x.ac, 0) AS ac, coalesce(x.er, 0) AS er,
      coalesce(x.vi, 0) AS vi, coalesce(x.dc, 0) AS dc
    FROM generate_series(date_trunc('month', p_inicio), date_trunc('month', p_fim), interval '1 month') AS m(mes)
    LEFT JOIN (
      SELECT date_trunc('month', a.dia)::date AS mes,
             count(DISTINCT a.sanarflix_user_id) AS alunos, count(*) AS dias,
             sum(a.questoes) AS q, sum(a.acertos) AS ac, sum(a.erros) AS er,
             sum(a.videos) AS vi, sum(a.documentos) AS dc
      FROM public.eng_atividade_aluno_dia a
      JOIN r ON r.sanarflix_user_id = a.sanarflix_user_id
      WHERE a.dia BETWEEN p_inicio AND p_fim
      GROUP BY 1
    ) x ON x.mes = m.mes::date
  ),
  esp AS (
    SELECT n.no_id, n.nome, n.ciclo, sum(x.questoes) AS q, sum(x.acertos) AS ac, sum(x.erros) AS er
    FROM public.eng_questoes_aluno_dia_no x
    JOIN r ON r.sanarflix_user_id = x.sanarflix_user_id
    JOIN public.eng_no_taxonomia n ON n.no_id = x.esp_id
    WHERE x.dia BETWEEN p_inicio AND p_fim
    GROUP BY n.no_id, n.nome, n.ciclo
    ORDER BY sum(x.questoes) DESC, n.nome
    LIMIT 6
  ),
  niv AS (
    SELECT nv.nivel, nv.ordem,
      (SELECT count(*) FROM r WHERE r.nivel = nv.nivel) AS total,
      coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', s.sanarflix_user_id, 'nome', s.nome) ORDER BY s.o, s.nome)
        FROM (
          SELECT r.sanarflix_user_id, r.nome, coalesce(r.dias_sem_atividade, 2147483647) AS o
          FROM r WHERE r.nivel = nv.nivel
          ORDER BY coalesce(r.dias_sem_atividade, 2147483647), r.nome
          LIMIT 3
        ) s
      ), '[]'::jsonb) AS amostra
    FROM (VALUES ('frequente', 1), ('esporadico', 2), ('parou', 3), ('nunca', 4)) AS nv(nivel, ordem)
  ),
  prev AS (
    SELECT r.sanarflix_user_id, r.nome, r.semestre, r.ultima_atividade, r.dias_sem_atividade
    FROM r WHERE r.faixa_recencia IN ('sumidos30a59', 'sumidos60')
    ORDER BY r.dias_sem_atividade DESC, r.nome
    LIMIT 5
  ),
  sem AS (  -- comparativo: ignora p_semestre/p_aluno (P8)
    SELECT s.n AS semestre,
      count(x.sanarflix_user_id) AS base,
      count(x.sanarflix_user_id) FILTER (WHERE x.dias_ativos_periodo > 0) AS eng,
      coalesce(sum(x.questoes), 0) AS q, coalesce(sum(x.acertos), 0) AS ac, coalesce(sum(x.erros), 0) AS er,
      coalesce(sum(x.videos), 0) AS vi, coalesce(sum(x.documentos), 0) AS dc
    FROM generate_series(1, 12) AS s(n)
    LEFT JOIN ies_r x ON x.semestre = s.n
    GROUP BY s.n
  ),
  top_cont AS (   -- só com aluno filtrado
    SELECT c.content_type, c.especialidade, count(*) AS n,
           row_number() OVER (PARTITION BY c.content_type ORDER BY count(*) DESC, c.especialidade) AS rn
    FROM public.eng_consumo_aluno_dia_conteudo c
    WHERE p_aluno IS NOT NULL AND c.sanarflix_user_id = p_aluno AND c.dia BETWEEN p_inicio AND p_fim
    GROUP BY c.content_type, c.especialidade
  ),
  dq AS (
    SELECT count(*) AS n FROM public.eng_atividade_aluno_dia a
    WHERE p_aluno IS NOT NULL AND a.sanarflix_user_id = p_aluno
      AND a.dia BETWEEN p_inicio AND p_fim AND a.respostas_todas > 0
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'ies', v_ies_json,
      'temDados', ki.base > 0,
      'periodo', jsonb_build_object(
        'inicio', p_inicio, 'fim', p_fim, 'dias', v_n, 'hoje', v_hoje,
        'mesReferenciaHabito', to_char(v_mes_ref, 'YYYY-MM'),
        'anterior', jsonb_build_object(
          'inicio', v_ini_ant, 'fim', p_inicio - 1,
          'comparavelQuestoes',  v_ini_ant >= DATE '2025-01-01',
          'comparavelConteudos', v_ini_ant >= DATE '2026-01-01')),
      'recorte', jsonb_build_object(
        'semestre', p_semestre,
        'aluno', (SELECT jsonb_build_object('id', x.sanarflix_user_id, 'nome', x.nome, 'semestre', x.semestre)
                  FROM r x WHERE p_aluno IS NOT NULL)),
      'kpis', jsonb_build_object(
        'baseAtiva', k.base,
        'engajados', k.eng,
        'engajadosPct', public.eng_pct(k.eng, k.base),
        'engajadosPctAnterior', CASE WHEN v_ini_ant >= DATE '2026-01-01' THEN public.eng_pct(k.eng_ant, k.base) END,
        'engajadosPctIes', CASE WHEN p_semestre IS NOT NULL THEN public.eng_pct(ki.eng, ki.base) END,
        'semRetorno30', k.s3059 + k.s60,
        'semRetorno30Pct', public.eng_pct(k.s3059 + k.s60, k.base),
        'questoes', k.q,
        'questoesPorEngajado', CASE WHEN k.eng > 0 THEN round(k.q::numeric / k.eng) END,
        'acertoPct', public.eng_pct(k.ac, k.ac + k.er),
        'acertoPctAnterior', CASE WHEN v_ini_ant >= DATE '2025-01-01' THEN public.eng_pct(k.ac_ant, k.ac_ant + k.er_ant) END,
        'acertoPctIes', CASE WHEN p_semestre IS NOT NULL THEN public.eng_pct(ki.ac, ki.ac + ki.er) END),
      'aluno', CASE WHEN p_aluno IS NULL THEN NULL ELSE (
        SELECT jsonb_build_object(
          'situacao', CASE x.faixa_recencia WHEN 'ativos30' THEN 'ativo' WHEN 'nunca_acessou' THEN 'sem_atividade' ELSE 'sumido' END,
          'ultimaAtividade', x.ultima_atividade,
          'diasSemAtividade', x.dias_sem_atividade,
          'diasAtivos', x.dias_ativos_periodo,
          'diasNoPeriodo', v_n,
          'diasComQuestoes', (SELECT n FROM dq),
          'baseSemestre', ks.base,
          'mediaSemestreQuestoes', CASE WHEN ks.eng > 0 THEN round(ks.q::numeric / ks.eng) END,
          'mediaSemestreAcertoPct', public.eng_pct(ks.ac, ks.ac + ks.er),
          'mediaSemestreVideos', public.eng_razao(ks.vi, ks.eng),
          'mediaSemestreDocumentos', public.eng_razao(ks.dc, ks.eng),
          'especialidadeMaisAssistida', (SELECT jsonb_build_object('nome', t.especialidade, 'total', t.n) FROM top_cont t WHERE t.content_type = 'video' AND t.rn = 1),
          'especialidadeMaisLida',      (SELECT jsonb_build_object('nome', t.especialidade, 'total', t.n) FROM top_cont t WHERE t.content_type = 'document' AND t.rn = 1))
        FROM r x CROSS JOIN ks) END,
      'meses', (SELECT jsonb_agg(jsonb_build_object(
          'mes', to_char(m.mes, 'YYYY-MM'), 'parcial', m.parcial,
          'alunosAtivos', m.alunos, 'pctBase', public.eng_pct(m.alunos, k.base),
          'diasAtivos', CASE WHEN p_aluno IS NOT NULL THEN m.dias END,
          'questoes', m.q, 'acertoPct', public.eng_pct(m.ac, m.ac + m.er),
          'videos', m.vi, 'documentos', m.dc) ORDER BY m.mes) FROM meses m),
      'habito', jsonb_build_object(
        'mes', to_char(v_mes_ref, 'YYYY-MM'),
        'ativosNoMes', k.h_ativos, 'baixo', k.h1, 'medio', k.h2, 'alto', k.h3, 'altissimo', k.h4,
        'diasAtivosAluno', CASE WHEN p_aluno IS NOT NULL THEN (SELECT x.dias_ativos_mes_ref FROM r x) END),
      'niveis', (SELECT jsonb_agg(jsonb_build_object('nivel', nv.nivel, 'total', nv.total, 'amostra', nv.amostra) ORDER BY nv.ordem) FROM niv nv),
      'recencia', jsonb_build_object(
        'ativos30', k.ativos30, 'sumidos30a59', k.s3059, 'sumidos60', k.s60, 'nuncaAcessou', k.nunca,
        'previaSumidos30mais', coalesce((SELECT jsonb_agg(jsonb_build_object(
            'id', p.sanarflix_user_id, 'nome', p.nome, 'semestre', p.semestre,
            'ultimaAtividade', p.ultima_atividade, 'diasSemAtividade', p.dias_sem_atividade,
            'detalhe', public.eng_detalhe_atividade(p.sanarflix_user_id, p.ultima_atividade))
          ORDER BY p.dias_sem_atividade DESC, p.nome) FROM prev p), '[]'::jsonb)),
      'consumo', jsonb_build_object(
        'questoes', jsonb_build_object(
          'total', k.q,
          'totalAnterior', CASE WHEN v_ini_ant >= DATE '2025-01-01' THEN k.q_ant END,
          'totalIes', CASE WHEN p_semestre IS NOT NULL THEN ki.q END,
          'acertoPct', public.eng_pct(k.ac, k.ac + k.er),
          'acertoPctAnterior', CASE WHEN v_ini_ant >= DATE '2025-01-01' THEN public.eng_pct(k.ac_ant, k.ac_ant + k.er_ant) END,
          'acertoPctIes', CASE WHEN p_semestre IS NOT NULL THEN public.eng_pct(ki.ac, ki.ac + ki.er) END,
          'alunos', k.al_q),
        'videos', jsonb_build_object(
          'total', k.vi,
          'totalAnterior', CASE WHEN v_ini_ant >= DATE '2026-01-01' THEN k.vi_ant END,
          'totalIes', CASE WHEN p_semestre IS NOT NULL THEN ki.vi END,
          'alunos', k.al_v),
        'documentos', jsonb_build_object(
          'total', k.dc,
          'totalAnterior', CASE WHEN v_ini_ant >= DATE '2026-01-01' THEN k.dc_ant END,
          'totalIes', CASE WHEN p_semestre IS NOT NULL THEN ki.dc END,
          'alunos', k.al_d)),
      'especialidades', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', e.no_id, 'nome', e.nome, 'ciclo', e.ciclo, 'questoes', e.q,
          'acertoPct', public.eng_pct(e.ac, e.ac + e.er)) ORDER BY e.q DESC, e.nome) FROM esp e), '[]'::jsonb),
      'semestres', (SELECT jsonb_agg(jsonb_build_object(
          'semestre', s.semestre,
          'ciclo', CASE WHEN s.semestre <= 4 THEN 'basico' WHEN s.semestre <= 8 THEN 'clinico' ELSE 'internato' END,
          'base', s.base, 'engajados', s.eng, 'engajadosPct', public.eng_pct(s.eng, s.base),
          'videosPorEngajado', public.eng_razao(s.vi, s.eng),
          'documentosPorEngajado', public.eng_razao(s.dc, s.eng),
          'questoesPorEngajado', CASE WHEN s.eng > 0 THEN round(s.q::numeric / s.eng) END,
          'acertoPct', public.eng_pct(s.ac, s.ac + s.er)) ORDER BY s.semestre) FROM sem s)
    ),
    'meta', public.eng_meta(p_inicio, p_fim, k.base < 10, v_criterio)
  )
  INTO v_r
  FROM k CROSS JOIN ki;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_visao_geral(uuid, date, date, smallint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_visao_geral(uuid, date, date, smallint, text) TO authenticated;
