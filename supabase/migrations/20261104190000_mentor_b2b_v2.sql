-- Mentor B2B V2: copias independentes do Gestor, nunca alteracoes nas RPCs de producao.
-- A copia ocorre UMA vez, nesta transacao, nao a cada chamada do mentor.
-- pg_get_functiondef preserva os patches posteriores aos CREATE FUNCTION do checkout
-- (inclusive semestres.alunos de 20260911170704). Qualquer ancora divergente aborta.
-- O DDL executado tem destino fixo na whitelist abaixo; nenhuma funcao auxiliar e criada.
begin;

-- mentor_visao_geral_b2b: deriva de get_gestor_visao_geral
-- Base 20260809230000 + patches de conceito e diagnostico de 10/11 de agosto.
-- mentor_alunos_b2b: deriva de get_gestor_alunos
-- Base 20260808205250 + ordenacao por severidade 20260809220000.
-- mentor_detalhamento_b2b: deriva de get_gestor_detalhamento
-- Base 20260807061927 + patches de recorte/nivel + semestres.alunos 20260911170704.
-- mentor_questoes_b2b: deriva de get_gestor_questoes
-- Base vigente 20260811165212; a assinatura publica agrupa todos os simulados pedidos.
-- mentor_cronograma_b2b: deriva de get_gestor_cronograma
-- Base 20260807055809; mantem processing/reagendado, os valores reais do SeletorSimulados.
-- mentor_aluno_b2b: deriva de get_gestor_aluno
-- Base 20260807061927; posicao e comparativos passam a usar apenas a turma.
do $copias$
declare
  r record;
  v_oid oid;
  v_novo_oid oid;
  v_original text;
  v_src text;
  v_declaracoes text;
  v_sql text;
  v_corpo text;
  v_ddl text;
  v_antes text;
  v_contagem integer;
  v_pre text;
  v_pos text;
  v_extras text;
  v_trecho text;
  v_padrao text;
  v_troca text;
  v_patches jsonb;
  v_patch jsonb;
  v_populacao text := $populacao$FROM (
    SELECT DISTINCT ON (u.id) u.id, coalesce(m.nome, u.nome) AS nome,
      coalesce(m.semestre, u.semestre) AS semestre
    FROM jsonb_to_recordset(v_membros) m(id uuid, nome text, semestre int, email text)
    JOIN public.users u ON u.id = m.id WHERE u.id = ANY(v_alunos)
    ORDER BY u.id, m.email
  ) u$populacao$;
  v_padrao_populacao text := $rx$FROM public\.users u WHERE u\.id_ies = v_ies AND NOT EXISTS \(SELECT 1 FROM public\.user_roles ur WHERE ur\.user_id = u\.id\)(?: AND \(v_sems IS NULL OR u\.semestre = ANY \(v_sems\)\))?(?: AND \(v_q IS NULL OR u\.nome ILIKE '%' \|\| v_q \|\| '%'\))?$rx$;
  v_comum text := $comum$
    v_mentor uuid := public.mentor_ativo_id();
    v_alunos uuid[];
    v_membros jsonb;
    v_atividade jsonb;
  BEGIN
    SELECT m.ies_id INTO v_ies FROM public.mentores m
    WHERE m.user_id = v_mentor AND m.tipo = 'b2b';
    IF NOT FOUND OR v_ies IS NULL THEN
      RAISE EXCEPTION 'mentor_b2b_obrigatorio' USING ERRCODE = '42501';
    END IF;
    SELECT coalesce(array_agg(DISTINCT a.id) FILTER (WHERE a.id IS NOT NULL), '{}'::uuid[]),
           coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.email), '[]'::jsonb)
    INTO v_alunos, v_membros
    FROM (
      SELECT v.id AS ciclo_id, v.email_normalizado AS email,
             coalesce(v.academy_user_id, d.academy_user_id, ue.id) AS id,
             coalesce(v.nome, u.nome, d.nome, ue.nome) AS nome,
             coalesce(u.semestre, d.semestre_atual, ue.semestre) AS semestre
      FROM public.mentoria_vinculos v
      LEFT JOIN public.users u ON u.id = v.academy_user_id
      LEFT JOIN LATERAL (
        SELECT d0.* FROM public.dim_aluno_b2b d0
        WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST, d0.sanarflix_user_id
        LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT u0.* FROM public.users u0
        WHERE lower(btrim(u0.email)) = v.email_normalizado
        ORDER BY u0.id LIMIT 1
      ) ue ON true
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ) a;
  $comum$;
  v_periodo text := $periodo$
    IF p_inicio > p_fim THEN
      RAISE EXCEPTION 'periodo_invalido' USING ERRCODE = '22023';
    END IF;
  $periodo$;
  v_filtro_periodo text := $periodo$
    AND (p_inicio IS NULL OR
      (COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at)
        AT TIME ZONE 'America/Sao_Paulo')::date >= p_inicio)
    AND (p_fim IS NULL OR
      (COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at)
        AT TIME ZONE 'America/Sao_Paulo')::date <= p_fim)
  $periodo$;
  v_valida_simulados text := $validacao$
    IF p_simulados IS NULL OR cardinality(p_simulados) = 0 THEN
      RAISE EXCEPTION 'selecao_de_simulados_obrigatoria' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(p_simulados) pedido(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.simulados_admin sa
        WHERE sa.id = pedido.id AND v_ies = ANY(sa.ies_ids)
          AND sa.simulado_pai_id IS NULL AND sa.status IN ('ativo','encerrado')
          AND (sa.liberacao_desempenho = 'imediato'
            OR (sa.liberacao_desempenho = 'agendado'
              AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= now())
            OR (sa.liberacao_desempenho = 'ao_encerrar'
              AND (sa.status = 'encerrado' OR sa.data_encerramento <= now())))
      )
    ) THEN
      RAISE EXCEPTION 'simulado_fora_do_escopo' USING ERRCODE = '42501';
    END IF;
  $validacao$;
begin
  for r in select * from (values
    ('mentor_visao_geral_b2b', 'p_inicio date default null, p_fim date default null', 'date,date',
      'public.get_gestor_visao_geral(uuid,text)', 3),
    ('mentor_alunos_b2b', 'p_inicio date default null, p_fim date default null', 'date,date',
      'public.get_gestor_alunos(uuid,text,integer,integer,text,text,text,text)', 1),
    ('mentor_detalhamento_b2b', 'p_simulados uuid[]', 'uuid[]',
      'public.get_gestor_detalhamento(uuid,text,uuid[])', 1),
    ('mentor_questoes_b2b', 'p_simulados uuid[]', 'uuid[]',
      'public.get_gestor_questoes(uuid,uuid,integer,integer,text,text,text)', 1),
    ('mentor_cronograma_b2b', '', '', 'public.get_gestor_cronograma(uuid)', 1),
    ('mentor_aluno_b2b', 'p_email text', 'text', 'public.get_gestor_aluno(uuid,uuid,uuid[])', 1)
  ) f(destino, argumentos, tipos, origem, populacoes)
  loop
    IF r.destino !~ '^mentor_[a-z_]+_b2b$' THEN
      RAISE EXCEPTION 'mentor_b2b_destino_invalido';
    END IF;
    v_oid := to_regprocedure(r.origem);
    IF v_oid IS NULL THEN RAISE EXCEPTION 'mentor_b2b_origem_ausente: %', r.origem; END IF;
    v_original := pg_get_functiondef(v_oid);
    SELECT p.prosrc INTO v_src FROM pg_proc p WHERE p.oid = v_oid;
    -- As ancoras abaixo trabalham sobre tokens normalizados, nao sobre indentacao.
    v_src := regexp_replace(regexp_replace(v_src, '--[^\n]*', '', 'g'), '\s+', ' ', 'g');
    v_declaracoes := split_part(v_src, 'BEGIN', 1);
    v_sql := substring(v_src from '(?i)\mWITH (?:sims|alunos|grupo) AS \(.*');
    IF v_sql IS NULL OR v_declaracoes !~ '(?i)^\s*DECLARE\s' THEN
      RAISE EXCEPTION 'mentor_b2b_estrutura_inesperada: %', r.origem;
    END IF;
    SELECT count(*) INTO v_contagem FROM regexp_matches(v_sql, v_padrao_populacao, 'g');
    IF v_contagem <> r.populacoes THEN
      RAISE EXCEPTION 'mentor_b2b_populacao_inesperada: %, esperado %, encontrado %',
        r.origem, r.populacoes, v_contagem;
    END IF;
    v_sql := regexp_replace(v_sql, v_padrao_populacao, v_populacao, 'g');
    v_antes := v_sql;
    v_sql := regexp_replace(v_sql, '\s+RETURN v_result;\s+END;?\s*$', '', 'i');
    IF v_sql = v_antes THEN RAISE EXCEPTION 'mentor_b2b_retorno_inesperado: %', r.origem; END IF;
    v_pre := ''; v_pos := ''; v_extras := ''; v_patches := '[]'::jsonb;

    IF r.destino IN ('mentor_visao_geral_b2b', 'mentor_alunos_b2b') THEN
      v_pre := v_periodo || $pre$ v_sems := NULL; v_recorte := 'turma do mentor'; $pre$;
      v_trecho := 'WHERE v_ies = ANY (sa.ies_ids)';
      IF (length(v_sql) - length(replace(v_sql, v_trecho, ''))) / length(v_trecho) <> 1 THEN
        RAISE EXCEPTION 'mentor_b2b_periodo_inesperado: %', r.origem;
      END IF;
      v_sql := replace(v_sql, v_trecho, v_trecho || v_filtro_periodo);
    END IF;

    IF r.destino = 'mentor_visao_geral_b2b' THEN
      v_pre := v_pre || $pre$
        v_evid := NULL; v_geral := false;
        v_criterio := 'Turma ativa; melhor TRI por aluno e simulado-pai; proficiente >= 60. Conceito projetado pelas faixas 90/75/60/40% de proficientes, nunca o conceito institucional.';
      $pre$;
      -- Substitui todo o CASE da fonte do conceito, inclusive o gate do patch de 10/08.
      v_patches := jsonb_build_array(
        jsonb_build_array(
          $rx$CASE WHEN (?:v_geral AND )?EXISTS \(SELECT 1 FROM ies_tri it WHERE it\.pai_id = p\.id\).*?END AS concept,$rx$,
          $novo$CASE WHEN p.n_tri = 0 THEN NULL
            WHEN 100.0 * p.n_prof / p.n_tri >= 90 THEN 5
            WHEN 100.0 * p.n_prof / p.n_tri >= 75 THEN 4
            WHEN 100.0 * p.n_prof / p.n_tri >= 60 THEN 3
            WHEN 100.0 * p.n_prof / p.n_tri >= 40 THEN 2
            ELSE 1 END AS concept,$novo$),
        jsonb_build_array(
          $rx$(?:\(v_geral AND )?EXISTS \(SELECT 1 FROM ies_tri it WHERE it\.pai_id = p\.id\)\)? AS concept_oficial$rx$,
          'false AS concept_oficial'),
        jsonb_build_array(
          $rx$'participantes', GREATEST\(m\.n_tri, m\.n_resp\)$rx$,
          $novo$'participantes', GREATEST(m.n_tri, m.n_resp),
            'n_tri', m.n_tri, 'n_prof', m.n_prof, 'proficientesPct', m.prof_pct,
            'conceito', m.concept$novo$));
      v_pos := $pos$
        WITH pontos AS (
          SELECT e.*, e.ord AS i FROM jsonb_array_elements(v_result->'data'->'evolucao')
            WITH ORDINALITY e(valor, ord)
        ), ultimo AS (
          SELECT p.valor, (p.valor->>'n_tri')::numeric AS n_tri,
            (p.valor->>'n_prof')::numeric AS n_prof,
            CASE (p.valor->>'conceito')::int
              WHEN 1 THEN 40 WHEN 2 THEN 60 WHEN 3 THEN 75 WHEN 4 THEN 90 END AS proximo_pct
          FROM pontos p ORDER BY p.i DESC LIMIT 1
        )
        SELECT jsonb_set(v_result, '{data}', (v_result->'data') || jsonb_build_object(
          'alunosMatriculadosNoRecorte', jsonb_array_length(v_membros),
          'n_tri', (SELECT p.n_tri FROM ultimo p),
          'n_prof', (SELECT p.n_prof FROM ultimo p),
          'faltam_para_proximo_conceito', (SELECT CASE WHEN p.n_tri = 0 OR p.proximo_pct IS NULL THEN NULL
            ELSE greatest(0, ceil(p.proximo_pct * p.n_tri / 100.0) - p.n_prof) END FROM ultimo p)
        )) INTO v_result;
        v_result := jsonb_set(v_result, '{data,kpis}', (v_result->'data'->'kpis') || jsonb_build_object(
          'triProjetado', jsonb_build_object(
            'valor', v_result #> '{data,evolucao,-1,valor}',
            'delta', (v_result #>> '{data,evolucao,-1,valor}')::numeric -
                     (v_result #>> '{data,evolucao,-2,valor}')::numeric,
            'serie', coalesce((SELECT jsonb_agg(jsonb_build_object(
              'simuladoId', e->'simuladoId', 'valor', e->'valor') ORDER BY ord)
              FROM jsonb_array_elements(v_result->'data'->'evolucao') WITH ORDINALITY p(e,ord)), '[]'::jsonb)
          )));
      $pos$;
    ELSIF r.destino = 'mentor_alunos_b2b' THEN
      v_pre := v_pre || $pre$
        v_sort := 'nome'; v_order := 'asc'; v_page := 1; v_size := 2147483647;
        v_q := NULL; v_grupo := NULL;
        v_atividade := public.mentor_turma();
      $pre$;
      -- Impede ate a existencia de TRI de outra turma de mudar a serie de simulados.
      v_patches := jsonb_build_array(
        jsonb_build_array('WHERE r.college_id = v_ies',
          'WHERE r.college_id = v_ies AND r.student_id = ANY(v_alunos)'),
        jsonb_build_array($rx$'tendencia', o\.tendencia$rx$, $novo$
          'tendencia', o.tendencia,
          'perfil', (SELECT array_remove(ARRAY[
            CASE WHEN atual BETWEEN 52 AND 59 THEN 'virada' END,
            CASE WHEN atual < 45 OR anterior - atual >= 5 THEN 'baixo' END,
            CASE WHEN atual >= 70 AND anterior >= 70 THEN 'bom' END
          ], NULL) FROM (
            SELECT
              (SELECT t.score_proprio FROM tri t WHERE t.student_id = o.id AND t.pai_id =
                (SELECT id FROM sims_ord ORDER BY ord DESC LIMIT 1)) AS atual,
              (SELECT t.score_proprio FROM tri t WHERE t.student_id = o.id AND t.pai_id =
                (SELECT id FROM sims_ord ORDER BY ord DESC LIMIT 1 OFFSET 1)) AS anterior
          ) notas)
        $novo$));
      v_pos := $pos$
        WITH membros AS (
          SELECT m.*, o.valor AS original, a.valor AS atividade
          FROM jsonb_to_recordset(v_membros) m(id uuid, email text, nome text, semestre int, ciclo_id uuid)
          LEFT JOIN LATERAL (
            SELECT e AS valor FROM jsonb_array_elements(v_result->'data'->'data') e
            WHERE (e->>'id')::uuid = m.id LIMIT 1
          ) o ON true
          LEFT JOIN LATERAL (
            SELECT e AS valor FROM jsonb_array_elements(v_atividade) e WHERE e->>'email' = m.email LIMIT 1
          ) a ON true
        )
        SELECT jsonb_set(v_result, '{data}', jsonb_build_object(
          'data', coalesce(jsonb_agg(
            coalesce(n.original, jsonb_build_object('id', n.id, 'nome', n.nome, 'semestre', n.semestre,
              'grupo', null, 'proficiencias', '[]'::jsonb, 'tendencia', 'estavel', 'perfil', '[]'::jsonb)) || jsonb_build_object(
              'email', n.email,
              'ultima_atividade', n.atividade->'ultima_atividade',
              'sinalizado_em', (SELECT max(s.criado_em) FROM public.mentoria_sinalizacoes s
                JOIN public.mentoria_vinculos v ON s.ciclo_id = v.id
                WHERE v.id = n.ciclo_id AND v.mentor_id = v_mentor AND v.fim IS NULL
                  AND s.mentor_id = v_mentor AND s.aluno_email = n.email)
            ) ORDER BY n.nome, n.email), '[]'::jsonb),
          'page', 1, 'pageSize', count(*), 'total', count(*),
          'totalPages', CASE WHEN count(*) = 0 THEN 0 ELSE 1 END
        )) INTO v_result FROM membros n;
      $pos$;
    ELSIF r.destino IN ('mentor_detalhamento_b2b', 'mentor_questoes_b2b') THEN
      v_pre := v_valida_simulados || $pre$ v_sems := NULL; $pre$;
      IF r.destino = 'mentor_detalhamento_b2b' THEN
        v_pre := v_pre || $pre$
          v_evid := NULL; v_recorte := 'turma do mentor'; v_n := cardinality(p_simulados);
          SELECT cardinality(p_simulados) = 1 AND sa.status = 'ativo'
            AND (sa.data_liberacao IS NULL OR sa.data_liberacao <= now())
            AND (sa.data_encerramento IS NULL OR sa.data_encerramento >= now())
          INTO v_aberta FROM public.simulados_admin sa WHERE sa.id = p_simulados[1];
        $pre$;
      ELSE
        v_extras := $extras$
          p_simulado_id uuid; p_area text := NULL;
          v_itens jsonb := '[]'::jsonb; v_metas jsonb := '[]'::jsonb;
        $extras$;
        v_pre := v_pre || $pre$
          v_sort := 'numero'; v_page := 1; v_size := 2147483647;
          FOR p_simulado_id IN SELECT DISTINCT unnest(p_simulados) LOOP
            SELECT sa.status = 'ativo'
              AND (sa.data_liberacao IS NULL OR sa.data_liberacao <= now())
              AND (sa.data_encerramento IS NULL OR sa.data_encerramento >= now())
            INTO v_aberta FROM public.simulados_admin sa WHERE sa.id = p_simulado_id;
        $pre$;
        v_pos := $pos$
            v_itens := v_itens || coalesce((SELECT jsonb_agg(e || jsonb_build_object('simuladoId', p_simulado_id))
              FROM jsonb_array_elements(v_result->'data'->'data') e), '[]'::jsonb);
            v_metas := v_metas || jsonb_build_array(v_result->'meta');
          END LOOP;
          v_result := jsonb_build_object('data', jsonb_build_object('data', v_itens,
            'page', 1, 'pageSize', jsonb_array_length(v_itens), 'total', jsonb_array_length(v_itens),
            'totalPages', CASE WHEN jsonb_array_length(v_itens) = 0 THEN 0 ELSE 1 END),
            'meta', (v_result->'meta') || jsonb_build_object('simulados', p_simulados,
              'periodo', 'simulados selecionados',
              'partial', (SELECT bool_or((e->>'partial')::boolean) FROM jsonb_array_elements(v_metas) e),
              'lowSample', (SELECT bool_and((e->>'lowSample')::boolean) FROM jsonb_array_elements(v_metas) e)));
        $pos$;
      END IF;
      IF position('CASE WHEN v_aberta THEN NULL' IN v_sql) = 0 THEN
        RAISE EXCEPTION 'mentor_b2b_guard_gabarito_ausente: %', r.origem;
      END IF;
    ELSIF r.destino = 'mentor_aluno_b2b' THEN
      v_extras := 'p_aluno_id uuid; p_simulados uuid[] := NULL;';
      v_pre := $pre$
        IF coalesce(btrim(p_email), '') = '' THEN
          RAISE EXCEPTION 'aluno_obrigatorio' USING ERRCODE = '22023';
        END IF;
        PERFORM public.mentor_exige_alunos(v_mentor, ARRAY[lower(btrim(p_email))]);
        SELECT (e->>'id')::uuid INTO p_aluno_id FROM jsonb_array_elements(v_membros) e
        WHERE e->>'email' = lower(btrim(p_email));
        IF p_aluno_id IS NULL THEN
          RETURN jsonb_build_object('data', '[]'::jsonb, 'meta', jsonb_build_object(
            'partial', true, 'motivo', 'academy_nao_resolvido',
            'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')));
        END IF;
      $pre$;
      -- O drawer tambem possui TRI fora do CTE alunos: ranking nao pode revelar a IES.
      v_patches := jsonb_build_array(jsonb_build_array(
        'WHERE r.college_id = v_ies', 'WHERE r.college_id = v_ies AND r.student_id = ANY(v_alunos)'));
    END IF;

    for v_patch in select value from jsonb_array_elements(v_patches) loop
      v_padrao := v_patch->>0; v_troca := v_patch->>1;
      SELECT count(*) INTO v_contagem FROM regexp_matches(v_sql, v_padrao, 'g');
      IF v_contagem <> 1 THEN
        RAISE EXCEPTION 'mentor_b2b_substituicao_inesperada: %, % (% ocorrencias)', r.origem, v_padrao, v_contagem;
      END IF;
      v_sql := regexp_replace(v_sql, v_padrao, v_troca);
    end loop;
    v_declaracoes := v_declaracoes || v_extras;
    v_corpo := format('-- Deriva de %s; copia independente do Gestor.%s', r.origem, E'\n') ||
      v_declaracoes || v_comum || v_pre || v_sql || v_pos || $final$
      v_result := jsonb_set(v_result, '{meta}', (v_result->'meta') || jsonb_build_object(
        'partial', coalesce((v_result->'meta'->>'partial')::boolean, false)
          OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_membros) e WHERE e->>'id' IS NULL),
        'alunosSemAcademy', (SELECT count(*) FROM jsonb_array_elements(v_membros) e WHERE e->>'id' IS NULL)
      ));
      RETURN v_result;
    END;
    $final$;
    IF v_corpo ~ '\m(has_role|gestor_pode_acessar_ies|get_accessible_ies|p_ies_id|p_semestre)\M' THEN
      RAISE EXCEPTION 'mentor_b2b_autorizacao_legada_residual: %', r.origem;
    END IF;
    v_ddl := format('create or replace function public.%I(%s) returns jsonb language plpgsql '
      'stable security definer set search_path to ''public'', ''pg_temp'' as %L',
      r.destino, r.argumentos, v_corpo);
    execute v_ddl;
    v_novo_oid := to_regprocedure(format('public.%I(%s)', r.destino, r.tipos));
    IF position('public.mentor_ativo_id()' IN pg_get_functiondef(v_novo_oid)) = 0
      OR position('public.mentoria_vinculos' IN pg_get_functiondef(v_novo_oid)) = 0
      OR pg_get_functiondef(v_oid) IS DISTINCT FROM v_original THEN
      RAISE EXCEPTION 'mentor_b2b_copia_invalida: %', r.destino;
    END IF;
    execute format('comment on function public.%I(%s) is %L', r.destino, r.tipos,
      format('Deriva de %s; copia independente, populacao = vinculos ativos do mentor B2B.', r.origem));
  end loop;
end
$copias$;

-- mentor_temas_turma_b2b: deriva de get_gestor_diagnostico_temas
-- Mesma selecao de pais liberados, ultima tentativa finalizada e fallback de respostas.
-- Agrega todas as areas/especialidades, sem misturar seus temas homonimos.
create or replace function public.mentor_temas_turma_b2b(p_inicio date default null, p_fim date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_ies uuid;
BEGIN
  SELECT m.ies_id INTO v_ies FROM public.mentores m WHERE m.user_id = v_mentor AND m.tipo = 'b2b';
  IF NOT FOUND OR v_ies IS NULL THEN RAISE EXCEPTION 'mentor_b2b_obrigatorio' USING ERRCODE = '42501'; END IF;
  IF p_inicio > p_fim THEN RAISE EXCEPTION 'periodo_invalido' USING ERRCODE = '22023'; END IF;
  RETURN (
    WITH sims AS (
      SELECT sa.id FROM public.simulados_admin sa
      WHERE v_ies = ANY(sa.ies_ids) AND sa.simulado_pai_id IS NULL AND sa.status IN ('ativo','encerrado')
        AND (sa.liberacao_desempenho = 'imediato'
          OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL
            AND sa.data_liberacao_desempenho <= now())
          OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR sa.data_encerramento <= now())))
        AND (p_inicio IS NULL OR (COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at)
          AT TIME ZONE 'America/Sao_Paulo')::date >= p_inicio)
        AND (p_fim IS NULL OR (COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at)
          AT TIME ZONE 'America/Sao_Paulo')::date <= p_fim)
    ), grupo AS (
      SELECT sa.id AS simulado_id, coalesce(sa.simulado_pai_id, sa.id) AS pai_id
      FROM public.simulados_admin sa WHERE coalesce(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
    ), alunos AS (
      SELECT DISTINCT u.id, u.nome, u.semestre
      FROM public.mentoria_vinculos v
      LEFT JOIN LATERAL (
        SELECT d0.academy_user_id FROM public.dim_aluno_b2b d0 WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST, d0.sanarflix_user_id LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT u0.id FROM public.users u0 WHERE lower(btrim(u0.email)) = v.email_normalizado ORDER BY u0.id LIMIT 1
      ) ue ON true
      JOIN public.users u ON u.id = coalesce(v.academy_user_id, d.academy_user_id, ue.id)
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ), ultima AS (
      SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id
      FROM public.simulados_finalizados sf JOIN grupo g ON g.simulado_id = sf.simulado_id
      WHERE sf.user_id IN (SELECT id FROM alunos)
      ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST
    ), ultima_fb AS (
      SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id
      FROM public.answer_progress ap JOIN grupo g ON g.simulado_id = ap.simulado
      JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
      WHERE ap.user_id IN (SELECT id FROM alunos)
        AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id)
      ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST
    ), tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb),
    temas AS (
      SELECT q.grande_area, q.especialidade, q.tema, count(*) AS respostas,
        count(DISTINCT t.user_id) AS amostra,
        round(100.0 * count(*) FILTER (WHERE ap.correct) / nullif(count(*), 0), 0) AS acerto_pct
      FROM tentativas t JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
      JOIN public.questoes_simulado q ON q.id = ap.question_id
      WHERE COALESCE(q.anulada,false) = false AND q.tema IS NOT NULL
      GROUP BY q.grande_area, q.especialidade, q.tema
    ), referencia AS (
      SELECT t.*, t.respostas >= 30 AND t.acerto_pct < 50 AS critico, p.prevalencia,
        CASE p.prevalencia WHEN 'Alta' THEN 3 WHEN 'Média' THEN 2 WHEN 'Baixa' THEN 1 END AS peso
      FROM temas t LEFT JOIN public.enamed_prevalencia_tema p
        ON p.tema_norm = lower(btrim(regexp_replace(t.tema, '\s+', ' ', 'g')))
        AND (p.grande_area IS NULL OR p.grande_area = t.grande_area)
        AND (p.especialidade IS NULL OR p.especialidade = t.especialidade)
    )
    SELECT jsonb_build_object('data', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'grande_area', grande_area, 'especialidade', especialidade, 'tema', tema,
      'respostas', respostas, 'acerto_pct', acerto_pct, 'critico', critico,
      'prevalencia', prevalencia, 'impacto', peso * (100 - acerto_pct),
      'amostra', amostra, 'lowSample', amostra < 10
    ) ORDER BY peso * (100 - acerto_pct) DESC NULLS LAST, acerto_pct, grande_area, especialidade, tema)
      FROM referencia), '[]'::jsonb),
      'meta', jsonb_build_object('periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
        'fonte', 'answer_progress / questoes_simulado / enamed_prevalencia_tema / mentoria_vinculos',
        'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'criterio', 'Ultima tentativa; anuladas excluidas. Critico: 30+ respostas e acerto < 50. Impacto desconhecido sem prevalencia.',
        'partial', EXISTS (SELECT 1 FROM referencia WHERE prevalencia IS NULL),
        'lowSample', coalesce((SELECT max(amostra) FROM referencia), 0) < 10))
  );
END;
$function$;

-- mentor_questao_respondentes_b2b: deriva de get_gestor_questao_respondentes
-- Sem parametro de alternativa: devolve a letra marcada para agrupar "quem marcou X".
-- Acrescenta selecao de simulados e ultima tentativa para coincidir com mentor_questoes_b2b.
create or replace function public.mentor_questao_respondentes_b2b(p_questao_id uuid, p_simulados uuid[])
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_ies uuid;
BEGIN
  SELECT m.ies_id INTO v_ies FROM public.mentores m WHERE m.user_id = v_mentor AND m.tipo = 'b2b';
  IF NOT FOUND OR v_ies IS NULL THEN RAISE EXCEPTION 'mentor_b2b_obrigatorio' USING ERRCODE = '42501'; END IF;
  IF p_questao_id IS NULL THEN RAISE EXCEPTION 'question_id_obrigatorio' USING ERRCODE = '22023'; END IF;
  IF p_simulados IS NULL OR cardinality(p_simulados) = 0 THEN
    RAISE EXCEPTION 'selecao_de_simulados_obrigatoria' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_simulados) pedido(id) WHERE NOT EXISTS (
    SELECT 1 FROM public.simulados_admin sa WHERE sa.id = pedido.id AND v_ies = ANY(sa.ies_ids)
      AND sa.simulado_pai_id IS NULL AND sa.status IN ('ativo','encerrado')
      AND (sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL
          AND sa.data_liberacao_desempenho <= now())
        OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR sa.data_encerramento <= now())))
  )) THEN RAISE EXCEPTION 'simulado_fora_do_escopo' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.questoes_simulado q JOIN public.simulados_admin sa ON sa.id = q.simulado_id
    WHERE q.id = p_questao_id AND coalesce(sa.simulado_pai_id, sa.id) = ANY(p_simulados)
      AND COALESCE(q.anulada,false) = false) THEN
    RAISE EXCEPTION 'questao_fora_do_escopo' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH alunos AS (
      SELECT DISTINCT u.id, u.nome, v.email_normalizado AS email
      FROM public.mentoria_vinculos v
      LEFT JOIN LATERAL (
        SELECT d0.academy_user_id FROM public.dim_aluno_b2b d0 WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST, d0.sanarflix_user_id LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT u0.id FROM public.users u0 WHERE lower(btrim(u0.email)) = v.email_normalizado ORDER BY u0.id LIMIT 1
      ) ue ON true
      JOIN public.users u ON u.id = coalesce(v.academy_user_id, d.academy_user_id, ue.id)
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ), grupo AS (
      SELECT sa.id AS simulado_id, coalesce(sa.simulado_pai_id, sa.id) AS pai_id
      FROM public.simulados_admin sa WHERE coalesce(sa.simulado_pai_id, sa.id) = ANY(p_simulados)
    ), ultima AS (
      SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id
      FROM public.simulados_finalizados sf JOIN grupo g ON g.simulado_id = sf.simulado_id
      WHERE sf.user_id IN (SELECT id FROM alunos)
      ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST
    ), ultima_fb AS (
      SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id
      FROM public.answer_progress ap JOIN grupo g ON g.simulado_id = ap.simulado
      JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
      WHERE ap.user_id IN (SELECT id FROM alunos)
        AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id)
      ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST
    ), tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb),
    respondentes AS (
      SELECT DISTINCT a.id, a.nome, a.email, upper(ap.resposta_usuario) AS alternativa
      FROM tentativas t JOIN alunos a ON a.id = t.user_id
      JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
      WHERE ap.question_id = p_questao_id AND upper(ap.resposta_usuario) IN ('A','B','C','D','E')
    )
    SELECT jsonb_build_object('data', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'alunoId', ap.id, 'nome', ap.nome, 'email', ap.email, 'alternativa', upper(ap.resposta_usuario)
    ) ORDER BY ap.nome, ap.id, ap.resposta_usuario)
      FROM (SELECT r.*, r.alternativa AS resposta_usuario FROM respondentes r) ap), '[]'::jsonb),
      'meta', jsonb_build_object('fonte', 'answer_progress / users / mentoria_vinculos',
        'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')))
  );
END;
$function$;

revoke all on function public.mentor_visao_geral_b2b(date, date) from public;
revoke execute on function public.mentor_visao_geral_b2b(date, date) from anon;
grant execute on function public.mentor_visao_geral_b2b(date, date) to authenticated;
revoke all on function public.mentor_alunos_b2b(date, date) from public;
revoke execute on function public.mentor_alunos_b2b(date, date) from anon;
grant execute on function public.mentor_alunos_b2b(date, date) to authenticated;
revoke all on function public.mentor_temas_turma_b2b(date, date) from public;
revoke execute on function public.mentor_temas_turma_b2b(date, date) from anon;
grant execute on function public.mentor_temas_turma_b2b(date, date) to authenticated;
revoke all on function public.mentor_detalhamento_b2b(uuid[]) from public;
revoke execute on function public.mentor_detalhamento_b2b(uuid[]) from anon;
grant execute on function public.mentor_detalhamento_b2b(uuid[]) to authenticated;
revoke all on function public.mentor_questoes_b2b(uuid[]) from public;
revoke execute on function public.mentor_questoes_b2b(uuid[]) from anon;
grant execute on function public.mentor_questoes_b2b(uuid[]) to authenticated;
revoke all on function public.mentor_questao_respondentes_b2b(uuid, uuid[]) from public;
revoke execute on function public.mentor_questao_respondentes_b2b(uuid, uuid[]) from anon;
grant execute on function public.mentor_questao_respondentes_b2b(uuid, uuid[]) to authenticated;
revoke all on function public.mentor_cronograma_b2b() from public;
revoke execute on function public.mentor_cronograma_b2b() from anon;
grant execute on function public.mentor_cronograma_b2b() to authenticated;
revoke all on function public.mentor_aluno_b2b(text) from public;
revoke execute on function public.mentor_aluno_b2b(text) from anon;
grant execute on function public.mentor_aluno_b2b(text) to authenticated;
revoke all on table public.enamed_prevalencia_tema from anon, authenticated;
commit;
