-- get_gestor_engajamento_questoes / _questoes_alunos: RPCs da aba Questões
-- Spec: docs/superpowers/specs/2026-10-22-engajamento-sanarflix-design.md (§7.1, §8.5, §8.6)
-- Cabeçalho, DECLARE e guardas 1–3 iguais aos da §8.1; corpo = SQL de referência de cada seção.

-- ============================================================
-- §8.5 get_gestor_engajamento_questoes
-- ============================================================

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

-- ============================================================
-- §8.6 get_gestor_engajamento_questoes_alunos
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_questoes_alunos(
  p_ies_id    uuid,
  p_inicio    date,
  p_fim       date,
  p_semestre  smallint DEFAULT NULL,
  p_folha_id  text     DEFAULT NULL
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

  IF p_folha_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.eng_no_taxonomia n WHERE n.no_id = p_folha_id
      AND ((n.ciclo = 'clinico' AND n.nivel = 3) OR (n.ciclo = 'basico' AND n.nivel = 2))) THEN
    RAISE EXCEPTION 'no_invalido' USING ERRCODE = '22023';
  END IF;

  WITH bs AS (SELECT * FROM public.eng_base_ativa(v_ies) WHERE p_semestre IS NULL OR semestre = p_semestre),
  x AS (
    SELECT q.sanarflix_user_id, sum(q.questoes) AS q, sum(q.acertos) AS ac, sum(q.erros) AS er, max(q.dia) AS ultima
    FROM public.eng_questoes_aluno_dia_no q
    JOIN bs ON bs.sanarflix_user_id = q.sanarflix_user_id
    WHERE q.folha_id = p_folha_id AND q.dia BETWEEN p_inicio AND p_fim
    GROUP BY q.sanarflix_user_id
  ),
  tot AS (SELECT count(*) AS al, coalesce(sum(q), 0) AS q, coalesce(sum(ac), 0) AS ac, coalesce(sum(er), 0) AS er FROM x),
  top AS (
    SELECT x.*, bs.nome, bs.semestre FROM x JOIN bs USING (sanarflix_user_id)
    ORDER BY x.q DESC, bs.nome LIMIT 12
  ),
  caminho AS (
    SELECT f.nome AS folha, f.ciclo, p.nome AS pai, g.nome AS avo
    FROM public.eng_no_taxonomia f
    JOIN public.eng_no_taxonomia p ON p.no_id = f.pai_id
    LEFT JOIN public.eng_no_taxonomia g ON g.no_id = p.pai_id
    WHERE f.no_id = p_folha_id
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'no', jsonb_build_object('id', p_folha_id, 'nome', cm.folha, 'ciclo', cm.ciclo,
              'caminho', CASE WHEN cm.ciclo = 'clinico' THEN jsonb_build_array(cm.avo, cm.pai)
                              ELSE jsonb_build_array('Ciclo básico', cm.pai) END),
      'resumo', jsonb_build_object('alunos', tot.al, 'questoes', tot.q, 'acertoPct', public.eng_pct(tot.ac, tot.ac + tot.er)),
      'alunos', coalesce((SELECT jsonb_agg(jsonb_build_object(
                  'id', t.sanarflix_user_id, 'nome', t.nome, 'semestre', t.semestre, 'questoes', t.q,
                  'acertoPct', public.eng_pct(t.ac, t.ac + t.er), 'ultimaAtividade', t.ultima)
                ORDER BY t.q DESC, t.nome) FROM top t), '[]'::jsonb)),
    'meta', public.eng_meta(p_inicio, p_fim, tot.al < 10, v_criterio)
  ) INTO v_r FROM tot CROSS JOIN caminho cm;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_questoes_alunos(uuid, date, date, smallint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_questoes_alunos(uuid, date, date, smallint, text) TO authenticated;
