-- Engajamento por IES: a aba só aparece (e as RPCs só respondem) para IES com a feature gestao.engajamento
-- ligada; admin sempre passa. Hoje a chave nasce DESLIGADA em todas as IES, então só admin acessa — é a fase de
-- testes do time interno. Para liberar: ligar a chave no painel /admin/ies (seção "Portal do Gestor") ou, para
-- todas de uma vez, uma migration que insere a linha em ies_features.
--
-- Três partes:
--   1. a chave no catálogo (feature_catalog), sem linha em ies_features (ausência = desligada);
--   2. public.eng_acesso_liberado(uuid): admin OU feature ligada para a IES resolvida;
--   3. as 10 RPCs get_gestor_engajamento_* chamam o helper logo depois de gestor_pode_acessar_ies e antes de
--      validar o período. Os corpos são os vigentes, sem outra mudança além desse bloco (as RPCs checam a IES
--      RESOLVIDA, a mesma que v_ies usa para os dados).
-- get_effective_features já devolve a chave nova sem alteração: admin tem todas as chaves ativas do catálogo;
-- gestor tem a chave só se a IES a ligou (e o master gestao.enabled da IES estiver ligado).

INSERT INTO public.feature_catalog (key, experience, label, description, sort_order, is_master, active) VALUES
  ('gestao.engajamento', 'gestao', 'Engajamento SanarFlix', 'Aba Engajamento do portal do gestor (uso da plataforma: questões, vídeos e documentos). Desligada = só admin acessa.', 190, false, true)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.eng_acesso_liberado(p_ies uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
           SELECT 1 FROM public.ies_features f
           WHERE f.ies_id = p_ies AND f.feature_key = 'gestao.engajamento' AND f.enabled
         );
$function$;

REVOKE ALL ON FUNCTION public.eng_acesso_liberado(uuid) FROM PUBLIC, anon, authenticated;

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
  -- Engajamento liberado para esta IES (gestao.engajamento) ou chamador admin (helper abaixo).
  IF NOT public.eng_acesso_liberado(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: engajamento not enabled for this IES';
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

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_alunos(
  p_ies_id             uuid,
  p_inicio             date,
  p_fim                date,
  p_semestre           smallint DEFAULT NULL,
  p_ordem              text     DEFAULT 'questoes',
  p_busca              text     DEFAULT NULL,
  p_sem_atividade_14d  boolean  DEFAULT false,
  p_page               integer  DEFAULT 1,
  p_page_size          integer  DEFAULT 20,
  p_direcao            text     DEFAULT 'desc'
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
  v_desc      boolean := p_direcao = 'desc';
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
  -- Engajamento liberado para esta IES (gestao.engajamento) ou chamador admin (helper abaixo).
  IF NOT public.eng_acesso_liberado(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: engajamento not enabled for this IES';
  END IF;

  PERFORM public.eng_validar_periodo(p_inicio, p_fim);
  IF p_semestre IS NOT NULL AND p_semestre NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_ordem NOT IN ('nome', 'semestre', 'questoes', 'acerto', 'videos', 'documentos', 'ultima_atividade') THEN
    RAISE EXCEPTION 'ordem_invalida' USING ERRCODE = '22023';
  END IF;
  IF p_direcao IS NULL OR p_direcao NOT IN ('asc', 'desc') THEN RAISE EXCEPTION 'direcao_invalida' USING ERRCODE = '22023'; END IF;
  IF p_page IS NULL OR p_page < 1 OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'paginacao_invalida' USING ERRCODE = '22023';
  END IF;
  v_busca := nullif(public.eng_norm_busca(btrim(coalesce(p_busca, ''))), '');

  WITH r AS MATERIALIZED (
    SELECT x.*,
           -- chave numérica já com o sinal da direção (desc = negativo); nome usa as duas colunas de texto
           CASE WHEN p_ordem = 'nome' THEN NULL ELSE
             (CASE WHEN v_desc THEN -1 ELSE 1 END) * CASE p_ordem
               WHEN 'semestre'         THEN x.semestre::numeric
               WHEN 'questoes'         THEN x.questoes::numeric
               WHEN 'acerto'           THEN public.eng_pct(x.acertos, x.acertos + x.erros)::numeric
               WHEN 'videos'           THEN x.videos::numeric
               WHEN 'documentos'       THEN x.documentos::numeric
               ELSE -x.dias_sem_atividade::numeric   -- ultima_atividade: mais recente = menos dias
             END
           END AS chave_num,
           CASE WHEN p_ordem = 'nome' AND NOT v_desc THEN x.nome END AS chave_asc,
           CASE WHEN p_ordem = 'nome' AND v_desc THEN x.nome END AS chave_desc
    FROM public.eng_alunos_recorte(v_ies, p_inicio, p_fim) x
    WHERE (p_semestre IS NULL OR x.semestre = p_semestre)
      AND (v_busca IS NULL OR strpos(public.eng_norm_busca(x.nome), v_busca) > 0)
      AND (NOT p_sem_atividade_14d OR x.dias_sem_atividade IS NULL OR x.dias_sem_atividade >= 14)
  ),
  t AS (SELECT count(*) AS total FROM r),
  pg AS (
    SELECT r.*, row_number() OVER (ORDER BY r.chave_num NULLS LAST, r.chave_asc, r.chave_desc DESC, r.nome, r.sanarflix_user_id) AS rn
    FROM r
    ORDER BY rn
    OFFSET (p_page - 1) * p_page_size LIMIT p_page_size
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'data', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', pg.sanarflix_user_id, 'nome', pg.nome, 'semestre', pg.semestre,
          'questoes', pg.questoes, 'acertoPct', public.eng_pct(pg.acertos, pg.acertos + pg.erros),
          'videos', pg.videos, 'documentos', pg.documentos,
          'ultimaAtividade', pg.ultima_atividade, 'diasSemAtividade', pg.dias_sem_atividade)
        ORDER BY pg.rn) FROM pg), '[]'::jsonb),
      'page', p_page,
      'pageSize', p_page_size,
      'total', t.total,
      'totalPages', greatest(1, ceil(t.total::numeric / p_page_size))::int),
    'meta', public.eng_meta(p_inicio, p_fim, t.total < 10, v_criterio)
  ) INTO v_r FROM t;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_alunos(uuid, date, date, smallint, text, text, boolean, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_alunos(uuid, date, date, smallint, text, text, boolean, integer, integer, text) TO authenticated;

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
  -- Engajamento liberado para esta IES (gestao.engajamento) ou chamador admin (helper abaixo).
  IF NOT public.eng_acesso_liberado(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: engajamento not enabled for this IES';
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
  -- Engajamento liberado para esta IES (gestao.engajamento) ou chamador admin (helper abaixo).
  IF NOT public.eng_acesso_liberado(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: engajamento not enabled for this IES';
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

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_export_alunos(
  p_ies_id             uuid,
  p_inicio             date,
  p_fim                date,
  p_semestre           smallint DEFAULT NULL,
  p_ordem              text     DEFAULT 'questoes',
  p_busca              text     DEFAULT NULL,
  p_sem_atividade_14d  boolean  DEFAULT false,
  p_direcao            text     DEFAULT 'desc'
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
  v_desc      boolean := p_direcao = 'desc';
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
  -- Engajamento liberado para esta IES (gestao.engajamento) ou chamador admin (helper abaixo).
  IF NOT public.eng_acesso_liberado(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: engajamento not enabled for this IES';
  END IF;

  PERFORM public.eng_validar_periodo(p_inicio, p_fim);
  IF p_semestre IS NOT NULL AND p_semestre NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_ordem NOT IN ('nome', 'semestre', 'questoes', 'acerto', 'videos', 'documentos', 'ultima_atividade') THEN
    RAISE EXCEPTION 'ordem_invalida' USING ERRCODE = '22023';
  END IF;
  IF p_direcao IS NULL OR p_direcao NOT IN ('asc', 'desc') THEN RAISE EXCEPTION 'direcao_invalida' USING ERRCODE = '22023'; END IF;
  v_busca := nullif(public.eng_norm_busca(btrim(coalesce(p_busca, ''))), '');

  WITH r AS (
    SELECT x.*,
           CASE WHEN p_ordem = 'nome' THEN NULL ELSE
             (CASE WHEN v_desc THEN -1 ELSE 1 END) * CASE p_ordem
               WHEN 'semestre'         THEN x.semestre::numeric
               WHEN 'questoes'         THEN x.questoes::numeric
               WHEN 'acerto'           THEN public.eng_pct(x.acertos, x.acertos + x.erros)::numeric
               WHEN 'videos'           THEN x.videos::numeric
               WHEN 'documentos'       THEN x.documentos::numeric
               ELSE -x.dias_sem_atividade::numeric
             END
           END AS chave_num,
           CASE WHEN p_ordem = 'nome' AND NOT v_desc THEN x.nome END AS chave_asc,
           CASE WHEN p_ordem = 'nome' AND v_desc THEN x.nome END AS chave_desc
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
        ORDER BY r.chave_num NULLS LAST, r.chave_asc, r.chave_desc DESC, r.nome, r.sanarflix_user_id) FROM r), '[]'::jsonb)),
    'meta', public.eng_meta(p_inicio, p_fim, false, v_criterio)
  ) INTO v_r;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_export_alunos(uuid, date, date, smallint, text, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_export_alunos(uuid, date, date, smallint, text, text, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_lista(
  p_ies_id     uuid,
  p_inicio     date,
  p_fim        date,
  p_semestre   smallint DEFAULT NULL,
  p_aluno      text     DEFAULT NULL,
  p_categoria  text     DEFAULT 'sumidos30mais',
  p_busca      text     DEFAULT NULL,
  p_page       integer  DEFAULT 1,
  p_page_size  integer  DEFAULT 20,
  p_com_email  boolean  DEFAULT false
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
  v_hab       boolean;
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
  -- Engajamento liberado para esta IES (gestao.engajamento) ou chamador admin (helper abaixo).
  IF NOT public.eng_acesso_liberado(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: engajamento not enabled for this IES';
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

  IF p_categoria NOT IN ('frequente','esporadico','parou','nunca','ativos30','sumidos30a59','sumidos60','nunca_acessou','sumidos30mais',
                         'habito_baixo','habito_medio','habito_alto','habito_altissimo') THEN
    RAISE EXCEPTION 'categoria_invalida' USING ERRCODE = '22023';
  END IF;
  IF p_page IS NULL OR p_page < 1 OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'paginacao_invalida' USING ERRCODE = '22023';
  END IF;
  v_busca := nullif(public.eng_norm_busca(btrim(coalesce(p_busca, ''))), '');
  v_desc  := p_categoria IN ('ativos30', 'sumidos30a59', 'sumidos60', 'sumidos30mais');
  v_hab   := p_categoria LIKE 'habito\_%';

  WITH r AS MATERIALIZED (
    SELECT x.*,
           CASE WHEN v_hab  THEN -coalesce(x.dias_ativos_mes_ref, 0)          -- hábito: mais dias ativos no mês primeiro
                WHEN v_desc THEN -coalesce(x.dias_sem_atividade, -1)          -- desc, nulos por último
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
            -- Faixas de "Do acesso ao hábito": mesmos cortes de get_gestor_engajamento_visao_geral (h1..h4)
            WHEN 'habito_baixo'     THEN x.dias_ativos_mes_ref BETWEEN 1 AND 3
            WHEN 'habito_medio'     THEN x.dias_ativos_mes_ref BETWEEN 4 AND 7
            WHEN 'habito_alto'      THEN x.dias_ativos_mes_ref BETWEEN 8 AND 14
            WHEN 'habito_altissimo' THEN x.dias_ativos_mes_ref >= 15
            ELSE x.nivel = p_categoria
          END
  ),
  t AS (SELECT count(*) AS total FROM r),
  pg AS (SELECT r.* FROM r ORDER BY r.chave, r.nome, r.sanarflix_user_id OFFSET (p_page - 1) * p_page_size LIMIT p_page_size)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'categoria', p_categoria,
      'data', coalesce((SELECT jsonb_agg(
          jsonb_build_object(
            'id', pg.sanarflix_user_id, 'nome', pg.nome, 'semestre', pg.semestre,
            'ultimaAtividade', pg.ultima_atividade, 'diasSemAtividade', pg.dias_sem_atividade,
            'diasAtivos30', pg.dias_ativos_30, 'diasAtivosMes', coalesce(pg.dias_ativos_mes_ref, 0),
            'melhorMes', to_char(pg.melhor_mes, 'YYYY-MM'), 'melhorMesDias', pg.melhor_mes_dias,
            'detalhe', public.eng_detalhe_atividade(pg.sanarflix_user_id, pg.ultima_atividade))
          -- E-mail só na exportação: a lista que a tela pagina não o carrega.
          || CASE WHEN p_com_email THEN jsonb_build_object('email', pg.email) ELSE '{}'::jsonb END
        ORDER BY pg.chave, pg.nome, pg.sanarflix_user_id) FROM pg), '[]'::jsonb),
      'page', p_page, 'pageSize', p_page_size, 'total', t.total,
      'totalPages', greatest(1, ceil(t.total::numeric / p_page_size))::int),
    'meta', public.eng_meta(p_inicio, p_fim, t.total < 10, v_criterio)
  ) INTO v_r FROM t;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_lista(uuid, date, date, smallint, text, text, text, integer, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_lista(uuid, date, date, smallint, text, text, text, integer, integer, boolean) TO authenticated;

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
  -- Engajamento liberado para esta IES (gestao.engajamento) ou chamador admin (helper abaixo).
  IF NOT public.eng_acesso_liberado(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: engajamento not enabled for this IES';
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
  -- Engajamento liberado para esta IES (gestao.engajamento) ou chamador admin (helper abaixo).
  IF NOT public.eng_acesso_liberado(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: engajamento not enabled for this IES';
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

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_versao(
  p_ies_id uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ies uuid;
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
  -- Engajamento liberado para esta IES (gestao.engajamento) ou chamador admin (helper abaixo).
  IF NOT public.eng_acesso_liberado(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: engajamento not enabled for this IES';
  END IF;

  RETURN jsonb_build_object(
    'data', jsonb_build_object('atualizadoEm', public.eng_atualizado_em(), 'versao', public.eng_versao_dados()),
    'meta', public.eng_meta(public.eng_hoje(), public.eng_hoje(), false,
                            'Versão dos dados do Engajamento: o horário mais antigo entre o fim do último refresh e as cargas das fontes que ele leu.')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_versao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_versao(uuid) TO authenticated;

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
  -- Engajamento liberado para esta IES (gestao.engajamento) ou chamador admin (helper abaixo).
  IF NOT public.eng_acesso_liberado(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: engajamento not enabled for this IES';
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
