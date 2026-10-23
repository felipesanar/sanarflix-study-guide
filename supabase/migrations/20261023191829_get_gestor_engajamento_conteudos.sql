-- get_gestor_engajamento_conteudos / _conteudo_alunos: RPCs da aba Conteúdos
-- Spec: docs/superpowers/specs/2026-10-22-engajamento-sanarflix-design.md (§7.1, §8.7, §8.8)
-- Cabeçalho, DECLARE e guardas 1–3 iguais aos da §8.1; corpo = SQL de referência de cada seção.

-- ============================================================
-- §8.7 get_gestor_engajamento_conteudos
-- ============================================================

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

-- ============================================================
-- §8.8 get_gestor_engajamento_conteudo_alunos
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_conteudo_alunos(
  p_ies_id         uuid,
  p_inicio         date,
  p_fim            date,
  p_semestre       smallint DEFAULT NULL,
  p_content_id     text     DEFAULT NULL,
  p_especialidade  text     DEFAULT NULL,
  p_modulo         text     DEFAULT NULL
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

  WITH bs AS (SELECT * FROM public.eng_base_ativa(v_ies) WHERE p_semestre IS NULL OR semestre = p_semestre),
  x AS (
    SELECT c.sanarflix_user_id, count(*) AS consumos, sum(c.aberturas) AS aberturas, max(c.ultima_abertura) AS ultima,
           max(c.content_name) AS nome, max(c.content_type) AS tipo
    FROM public.eng_consumo_aluno_dia_conteudo c
    JOIN bs ON bs.sanarflix_user_id = c.sanarflix_user_id
    WHERE c.content_id = p_content_id AND c.especialidade = p_especialidade AND c.modulo = p_modulo
      AND c.dia BETWEEN p_inicio AND p_fim
    GROUP BY c.sanarflix_user_id
  ),
  tot AS (SELECT count(*) AS al, coalesce(sum(consumos), 0) AS consumos, coalesce(sum(aberturas), 0) AS aberturas,
                 max(nome) AS nome, max(tipo) AS tipo FROM x),
  top AS (SELECT x.*, bs.nome AS aluno, bs.semestre FROM x JOIN bs USING (sanarflix_user_id)
          ORDER BY x.aberturas DESC, bs.nome LIMIT 12)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'conteudo', jsonb_build_object('id', p_content_id, 'nome', tot.nome, 'tipo', tot.tipo,
                                     'especialidade', p_especialidade, 'modulo', p_modulo),
      'resumo', jsonb_build_object('alunos', tot.al, 'consumos', tot.consumos, 'aberturas', tot.aberturas),
      'alunos', coalesce((SELECT jsonb_agg(jsonb_build_object(
                  'id', t.sanarflix_user_id, 'nome', t.aluno, 'semestre', t.semestre,
                  'aberturas', t.aberturas, 'consumos', t.consumos,
                  'ultimaAbertura', to_char(t.ultima, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                ORDER BY t.aberturas DESC, t.aluno) FROM top t), '[]'::jsonb)),
    'meta', public.eng_meta(p_inicio, p_fim, tot.al < 10, v_criterio)
  ) INTO v_r FROM tot;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_conteudo_alunos(uuid, date, date, smallint, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_conteudo_alunos(uuid, date, date, smallint, text, text, text) TO authenticated;
