-- get_gestor_engajamento_questoes / _conteudos: série diária ('dias') para a Evolução
-- Regra da tela: período de até 31 dias mostra a evolução dia a dia; acima disso, o consolidado por mês
-- ('meses', como antes). 'dias' só vem preenchido quando o período tem até 31 dias; senão vem [].
-- Mesmas assinaturas das funções anteriores (CREATE OR REPLACE basta).

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_questoes(
  p_ies_id    uuid,
  p_inicio    date,
  p_fim       date,
  p_semestre  smallint DEFAULT NULL
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

  WITH b AS MATERIALIZED (SELECT * FROM public.eng_base_ativa(v_ies)),
  bs AS (SELECT * FROM b WHERE p_semestre IS NULL OR semestre = p_semestre),
  x AS MATERIALIZED (
    SELECT q.* FROM public.eng_questoes_aluno_dia_no q
    JOIN bs ON bs.sanarflix_user_id = q.sanarflix_user_id
    WHERE q.dia BETWEEN p_inicio AND p_fim
  ),
  kp AS (SELECT coalesce(sum(questoes), 0) AS q, coalesce(sum(acertos), 0) AS ac, coalesce(sum(erros), 0) AS er,
                count(DISTINCT sanarflix_user_id) AS al FROM x),
  meses AS (
    SELECT m.mes::date AS mes,
           (m.mes::date < p_inicio OR (m.mes + interval '1 month - 1 day')::date > p_fim) AS parcial,
           coalesce(sum(x.questoes), 0) AS q, coalesce(sum(x.acertos), 0) AS ac, coalesce(sum(x.erros), 0) AS er
    FROM generate_series(date_trunc('month', p_inicio), date_trunc('month', p_fim), interval '1 month') AS m(mes)
    LEFT JOIN x ON date_trunc('month', x.dia) = m.mes
    GROUP BY m.mes
  ),
  -- Série diária: só para períodos de até 31 dias (acima disso a tela mostra o consolidado por mês)
  dias AS (
    SELECT d.dia::date AS dia, coalesce(sum(x.questoes), 0) AS q, coalesce(sum(x.acertos), 0) AS ac, coalesce(sum(x.erros), 0) AS er
    FROM generate_series(p_inicio::timestamp, p_fim::timestamp, interval '1 day') AS d(dia)
    LEFT JOIN x ON x.dia = d.dia::date
    WHERE p_fim - p_inicio + 1 <= 31
    GROUP BY d.dia
  ),
  sem AS (   -- ignora p_semestre (P8)
    SELECT s.n AS semestre, coalesce(sum(q.questoes), 0) AS q, coalesce(sum(q.acertos), 0) AS ac, coalesce(sum(q.erros), 0) AS er
    FROM generate_series(1, 12) AS s(n)
    LEFT JOIN b ON b.semestre = s.n
    LEFT JOIN public.eng_questoes_aluno_dia_no q
      ON q.sanarflix_user_id = b.sanarflix_user_id AND q.dia BETWEEN p_inicio AND p_fim
    GROUP BY s.n
  ),
  -- agregados por nível; "alunos" é contagem distinta em CADA nível (não soma)
  f  AS (SELECT ciclo, n1_id, n2_id, folha_id, sum(questoes) q, sum(acertos) ac, sum(erros) er, count(DISTINCT sanarflix_user_id) al
         FROM x GROUP BY 1, 2, 3, 4),
  e2 AS (SELECT ciclo, n1_id, n2_id, sum(questoes) q, sum(acertos) ac, sum(erros) er, count(DISTINCT sanarflix_user_id) al
         FROM x GROUP BY 1, 2, 3),
  e1 AS (SELECT ciclo, n1_id, sum(questoes) q, sum(acertos) ac, sum(erros) er, count(DISTINCT sanarflix_user_id) al
         FROM x GROUP BY 1, 2),
  c  AS (SELECT ciclo, sum(questoes) q, sum(acertos) ac, sum(erros) er FROM x GROUP BY 1)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'kpis', jsonb_build_object('questoes', kp.q, 'acertoPct', public.eng_pct(kp.ac, kp.ac + kp.er), 'alunos', kp.al,
                                 'porAluno', CASE WHEN kp.al > 0 THEN round(kp.q::numeric / kp.al) END),
      'meses', (SELECT jsonb_agg(jsonb_build_object('mes', to_char(m.mes, 'YYYY-MM'), 'parcial', m.parcial,
                 'questoes', m.q, 'acertoPct', public.eng_pct(m.ac, m.ac + m.er)) ORDER BY m.mes) FROM meses m),
      'dias', coalesce((SELECT jsonb_agg(jsonb_build_object('dia', to_char(d.dia, 'YYYY-MM-DD'), 'questoes', d.q,
                 'acertoPct', public.eng_pct(d.ac, d.ac + d.er)) ORDER BY d.dia) FROM dias d), '[]'::jsonb),
      'semestres', (SELECT jsonb_agg(jsonb_build_object('semestre', s.semestre, 'questoes', s.q,
                 'acertoPct', public.eng_pct(s.ac, s.ac + s.er)) ORDER BY s.semestre) FROM sem s),
      'arvore', jsonb_build_object(
        'clinico', jsonb_build_object(
          'questoes', coalesce((SELECT q FROM c WHERE ciclo = 'clinico'), 0),
          'acertoPct', (SELECT public.eng_pct(ac, ac + er) FROM c WHERE ciclo = 'clinico'),
          'grandesAreas', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
              'id', g.n1_id, 'nome', n1.nome, 'questoes', g.q, 'alunos', g.al, 'acertoPct', public.eng_pct(g.ac, g.ac + g.er),
              'especialidades', (
                SELECT jsonb_agg(jsonb_build_object(
                  'id', s2.n2_id, 'nome', n2.nome, 'questoes', s2.q, 'alunos', s2.al, 'acertoPct', public.eng_pct(s2.ac, s2.ac + s2.er),
                  'temas', (
                    SELECT jsonb_agg(jsonb_build_object(
                      'id', t.folha_id, 'nome', n3.nome, 'questoes', t.q, 'alunos', t.al, 'acertoPct', public.eng_pct(t.ac, t.ac + t.er))
                      ORDER BY t.q DESC, n3.nome)
                    FROM f t JOIN public.eng_no_taxonomia n3 ON n3.no_id = t.folha_id
                    WHERE t.ciclo = 'clinico' AND t.n2_id = s2.n2_id))
                  ORDER BY s2.q DESC, n2.nome)
                FROM e2 s2 JOIN public.eng_no_taxonomia n2 ON n2.no_id = s2.n2_id
                WHERE s2.ciclo = 'clinico' AND s2.n1_id = g.n1_id))
              ORDER BY g.q DESC, n1.nome)
            FROM e1 g JOIN public.eng_no_taxonomia n1 ON n1.no_id = g.n1_id
            WHERE g.ciclo = 'clinico'), '[]'::jsonb)),
        'basico', jsonb_build_object(
          'questoes', coalesce((SELECT q FROM c WHERE ciclo = 'basico'), 0),
          'acertoPct', (SELECT public.eng_pct(ac, ac + er) FROM c WHERE ciclo = 'basico'),
          'disciplinas', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
              'id', g.n1_id, 'nome', n1.nome, 'questoes', g.q, 'alunos', g.al, 'acertoPct', public.eng_pct(g.ac, g.ac + g.er),
              'assuntos', (
                SELECT jsonb_agg(jsonb_build_object(
                  'id', t.folha_id, 'nome', n2.nome, 'questoes', t.q, 'alunos', t.al, 'acertoPct', public.eng_pct(t.ac, t.ac + t.er))
                  ORDER BY t.q DESC, n2.nome)
                FROM f t JOIN public.eng_no_taxonomia n2 ON n2.no_id = t.folha_id
                WHERE t.ciclo = 'basico' AND t.n1_id = g.n1_id))
              ORDER BY g.q DESC, n1.nome)
            FROM e1 g JOIN public.eng_no_taxonomia n1 ON n1.no_id = g.n1_id
            WHERE g.ciclo = 'basico'), '[]'::jsonb)),
        'total', jsonb_build_object('questoes', kp.q, 'alunos', kp.al, 'acertoPct', public.eng_pct(kp.ac, kp.ac + kp.er)))
    ),
    'meta', public.eng_meta(p_inicio, p_fim, kp.al < 10, v_criterio)
  ) INTO v_r FROM kp;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_questoes(uuid, date, date, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_questoes(uuid, date, date, smallint) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_conteudos(
  p_ies_id    uuid,
  p_inicio    date,
  p_fim       date,
  p_semestre  smallint DEFAULT NULL,
  p_tipo      text     DEFAULT 'todos'
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

  IF p_tipo NOT IN ('todos', 'video', 'document') THEN RAISE EXCEPTION 'tipo_invalido' USING ERRCODE = '22023'; END IF;

  WITH b AS MATERIALIZED (SELECT * FROM public.eng_base_ativa(v_ies)),
  bs AS (SELECT * FROM b WHERE p_semestre IS NULL OR semestre = p_semestre),
  x AS MATERIALIZED (
    SELECT c.* FROM public.eng_consumo_aluno_dia_conteudo c
    JOIN bs ON bs.sanarflix_user_id = c.sanarflix_user_id
    WHERE c.dia BETWEEN p_inicio AND p_fim AND (p_tipo = 'todos' OR c.content_type = p_tipo)
  ),
  kp AS (SELECT count(*) AS n, count(*) FILTER (WHERE content_type = 'video') AS vi,
                count(*) FILTER (WHERE content_type = 'document') AS dc,
                count(DISTINCT sanarflix_user_id) AS al FROM x),
  meses AS (
    SELECT m.mes::date AS mes,
           (m.mes::date < p_inicio OR (m.mes + interval '1 month - 1 day')::date > p_fim) AS parcial,
           count(x.content_id) AS n
    FROM generate_series(date_trunc('month', p_inicio), date_trunc('month', p_fim), interval '1 month') AS m(mes)
    LEFT JOIN x ON date_trunc('month', x.dia) = m.mes
    GROUP BY m.mes
  ),
  -- Série diária: só para períodos de até 31 dias (acima disso a tela mostra o consolidado por mês)
  dias AS (
    SELECT d.dia::date AS dia, count(x.content_id) AS n
    FROM generate_series(p_inicio::timestamp, p_fim::timestamp, interval '1 day') AS d(dia)
    LEFT JOIN x ON x.dia = d.dia::date
    WHERE p_fim - p_inicio + 1 <= 31
    GROUP BY d.dia
  ),
  sem AS (   -- ignora p_semestre (P8)
    SELECT s.n AS semestre, count(c.content_id) AS n
    FROM generate_series(1, 12) AS s(n)
    LEFT JOIN b ON b.semestre = s.n
    LEFT JOIN public.eng_consumo_aluno_dia_conteudo c
      ON c.sanarflix_user_id = b.sanarflix_user_id AND c.dia BETWEEN p_inicio AND p_fim
     AND (p_tipo = 'todos' OR c.content_type = p_tipo)
    GROUP BY s.n
  ),
  e  AS (SELECT especialidade, count(*) n, count(DISTINCT sanarflix_user_id) al FROM x GROUP BY 1),
  mo AS (SELECT especialidade, modulo, count(*) n, count(DISTINCT sanarflix_user_id) al FROM x GROUP BY 1, 2),
  co AS (SELECT especialidade, modulo, content_id, max(content_name) nome, max(content_type) tipo,
                count(*) n, count(DISTINCT sanarflix_user_id) al FROM x GROUP BY 1, 2, 3)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'kpis', jsonb_build_object('consumos', kp.n, 'videos', kp.vi, 'documentos', kp.dc, 'alunos', kp.al,
                                 'porAluno', CASE WHEN kp.al > 0 THEN round(kp.n::numeric / kp.al) END),
      'meses', (SELECT jsonb_agg(jsonb_build_object('mes', to_char(m.mes, 'YYYY-MM'), 'parcial', m.parcial, 'consumos', m.n) ORDER BY m.mes) FROM meses m),
      'dias', coalesce((SELECT jsonb_agg(jsonb_build_object('dia', to_char(d.dia, 'YYYY-MM-DD'), 'consumos', d.n) ORDER BY d.dia) FROM dias d), '[]'::jsonb),
      'semestres', (SELECT jsonb_agg(jsonb_build_object('semestre', s.semestre, 'consumos', s.n) ORDER BY s.semestre) FROM sem s),
      'arvore', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'especialidade', e.especialidade, 'consumos', e.n, 'alunos', e.al,
          'modulos', (
            SELECT jsonb_agg(jsonb_build_object(
              'modulo', mo.modulo, 'consumos', mo.n, 'alunos', mo.al,
              'conteudos', (
                SELECT jsonb_agg(jsonb_build_object('id', co.content_id, 'nome', co.nome, 'tipo', co.tipo,
                                                    'consumos', co.n, 'alunos', co.al)
                       ORDER BY co.n DESC, co.nome)
                FROM co WHERE co.especialidade = mo.especialidade AND co.modulo = mo.modulo))
              ORDER BY (mo.modulo = 'Materiais gerais'), mo.n DESC, mo.modulo)
            FROM mo WHERE mo.especialidade = e.especialidade))
          ORDER BY (e.especialidade = 'Outros conteúdos'), e.n DESC, e.especialidade)
        FROM e), '[]'::jsonb)
    ),
    'meta', public.eng_meta(p_inicio, p_fim, kp.al < 10, v_criterio)
  ) INTO v_r FROM kp;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_conteudos(uuid, date, date, smallint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_conteudos(uuid, date, date, smallint, text) TO authenticated;
