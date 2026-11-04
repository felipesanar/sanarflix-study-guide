-- Página do Mentor: questões da fonte public.fato_resolucao_questoes_b2b.
-- response_timestamp é timestamp sem fuso em UTC; response_date é o dia civil de
-- America/Sao_Paulo. Janelas usam response_date e hoje em SP; timestamps usam AT TIME ZONE 'UTC'.
-- Contagem = respostas (count(*)), não questões distintas. Acertos/erros ignoram acertou nulo.
-- tem_dado_questoes indica que a fonte existe para o aluno, em qualquer data, não só na janela.
-- ultima_atividade passa a incluir questões, além do consumo de conteúdo e sessões Academy.
-- Leitura somente pelas RPCs SECURITY DEFINER: a fonte tem RLS sem acesso authenticated direto.

create or replace function public.mentor_turma()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  RETURN coalesce((
    WITH alunos AS (
      SELECT v.email_normalizado AS email,
             coalesce(v.nome, u.nome, d.nome) AS nome,
             u.telefone,
             coalesce(u.semestre, d.semestre_atual) AS semestre,
             d.vigencia_fim AS acesso_ate,
             (d.sanarflix_user_id IS NOT NULL) AS b2b,
             coalesce(v.academy_user_id, d.academy_user_id) AS academy_user_id,
             coalesce(v.sanarflix_user_id, d.sanarflix_user_id) AS sanarflix_user_id
      FROM public.mentoria_vinculos v
      LEFT JOIN public.users u ON u.id = v.academy_user_id
      LEFT JOIN LATERAL (
        SELECT * FROM public.dim_aluno_b2b d0
        WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST
        LIMIT 1
      ) d ON true
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ),
    atividade AS (
      SELECT a.*,
             greatest(
               (SELECT max(f.event_timestamp) AT TIME ZONE 'UTC' FROM public.fato_consumo_conteudo_b2b f
                 WHERE a.sanarflix_user_id IS NOT NULL AND f.sanarflix_user_id = a.sanarflix_user_id),
               (SELECT max(s.started_at) FROM public.user_sessions s
                 WHERE a.academy_user_id IS NOT NULL AND s.user_id = a.academy_user_id),
               -- última data pelo índice (aluno, data) e só então o maior horário dela: evita ler
               -- todas as respostas do aluno (20x menos blocos em prod; mesmo resultado em 10/10)
               (SELECT max(fq.response_timestamp) AT TIME ZONE 'UTC' FROM public.fato_resolucao_questoes_b2b fq
                 WHERE a.sanarflix_user_id IS NOT NULL AND fq.sanarflix_user_id = a.sanarflix_user_id
                   AND fq.response_date = (SELECT max(fd.response_date) FROM public.fato_resolucao_questoes_b2b fd
                                            WHERE fd.sanarflix_user_id = a.sanarflix_user_id))
             ) AS ultima_atividade,
             (a.sanarflix_user_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.fato_consumo_conteudo_b2b fx
                 WHERE fx.sanarflix_user_id = a.sanarflix_user_id)) AS tem_dado_consumo,
             cons.v7, cons.d7, cons.v30, cons.d30,
             (a.sanarflix_user_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.fato_resolucao_questoes_b2b fx
                 WHERE fx.sanarflix_user_id = a.sanarflix_user_id)) AS tem_dado_questoes,
             quest.q7, quest.a7, quest.e7, quest.q30, quest.a30, quest.e30
      FROM alunos a
      LEFT JOIN LATERAL (
        SELECT
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(DISTINCT f.content_id) FILTER (WHERE f.content_type = 'video' AND f.event_date >= v_hoje - 6) END AS v7,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(DISTINCT f.content_id) FILTER (WHERE f.content_type = 'document' AND f.event_date >= v_hoje - 6) END AS d7,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(DISTINCT f.content_id) FILTER (WHERE f.content_type = 'video') END AS v30,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(DISTINCT f.content_id) FILTER (WHERE f.content_type = 'document') END AS d30
        FROM public.fato_consumo_conteudo_b2b f
        WHERE a.sanarflix_user_id IS NOT NULL
          AND f.sanarflix_user_id = a.sanarflix_user_id
          AND f.event_date >= v_hoje - 29
      ) cons ON true
      LEFT JOIN LATERAL (
        SELECT
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) FILTER (WHERE f.response_date >= v_hoje - 6) END AS q7,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) FILTER (WHERE f.response_date >= v_hoje - 6 AND f.acertou IS TRUE) END AS a7,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) FILTER (WHERE f.response_date >= v_hoje - 6 AND f.acertou IS FALSE) END AS e7,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) END AS q30,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) FILTER (WHERE f.acertou IS TRUE) END AS a30,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) FILTER (WHERE f.acertou IS FALSE) END AS e30
        FROM public.fato_resolucao_questoes_b2b f
        WHERE a.sanarflix_user_id IS NOT NULL
          AND f.sanarflix_user_id = a.sanarflix_user_id
          AND f.response_date >= v_hoje - 29
      ) quest ON true
    ),
    calculado AS (
      SELECT x.*, ((now() AT TIME ZONE 'America/Sao_Paulo')::date - (x.ultima_atividade AT TIME ZONE 'America/Sao_Paulo')::date) AS dias
      FROM atividade x
    )
    SELECT jsonb_agg(jsonb_build_object(
      'email', c.email, 'nome', c.nome, 'telefone', c.telefone, 'semestre', c.semestre,
      'acesso_ate', c.acesso_ate, 'b2b', c.b2b, 'academy_user_id', c.academy_user_id,
      'sanarflix_user_id', c.sanarflix_user_id, 'ultima_atividade', c.ultima_atividade,
      'dias_sem_atividade', c.dias,
      'segmento', CASE WHEN dias IS NULL THEN 'sem_dado'
                       WHEN dias >= 10 THEN 'sumido'
                       WHEN dias >= 8 THEN 'esfriando'
                       ELSE 'ativo' END,
      'conteudos_7d', jsonb_build_object('videos', c.v7, 'documentos', c.d7, 'total', c.v7 + c.d7),
      'conteudos_30d', jsonb_build_object('videos', c.v30, 'documentos', c.d30, 'total', c.v30 + c.d30),
      'tem_dado_consumo', c.tem_dado_consumo,
      'questoes_7d', jsonb_build_object('respondidas', c.q7, 'acertos', c.a7, 'erros', c.e7,
        'pct_acerto', round(100.0 * c.a7 / nullif(c.a7 + c.e7, 0), 1)),
      'questoes_30d', jsonb_build_object('respondidas', c.q30, 'acertos', c.a30, 'erros', c.e30,
        'pct_acerto', round(100.0 * c.a30 / nullif(c.a30 + c.e30, 0), 1)),
      'tem_dado_questoes', c.tem_dado_questoes
    ) ORDER BY c.dias DESC NULLS LAST, c.nome)
    FROM calculado c
  ), '[]'::jsonb);
END;
$function$;

create or replace function public.mentor_aluno_questoes(p_email text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_email text;
  v_sfx text;
  v_tem boolean;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_segunda date := date_trunc('week', ((now() AT TIME ZONE 'America/Sao_Paulo')::date)::timestamp)::date;
BEGIN
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'e-mail obrigatório';
  END IF;
  v_email := (public.mentor_exige_alunos(v_mentor, array[p_email]))[1];

  -- Mesma resolução do mentor_turma: vínculo, senão dim por e-mail preferindo status ativo.
  SELECT coalesce(v.sanarflix_user_id, d.sanarflix_user_id) INTO v_sfx
  FROM public.mentoria_vinculos v
  LEFT JOIN LATERAL (
    SELECT d0.sanarflix_user_id FROM public.dim_aluno_b2b d0
    WHERE d0.email_normalizado = v.email_normalizado
    ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST
    LIMIT 1
  ) d ON true
  WHERE v.mentor_id = v_mentor AND v.email_normalizado = v_email AND v.fim IS NULL
  LIMIT 1;

  IF v_sfx IS NULL THEN
    RETURN jsonb_build_object('email', v_email, 'tem_dado_questoes', false,
      'ultima_resposta', NULL,
      'por_semana', '[]'::jsonb, 'por_area', '[]'::jsonb);
  END IF;

  v_tem := EXISTS (
    SELECT 1 FROM public.fato_resolucao_questoes_b2b fx WHERE fx.sanarflix_user_id = v_sfx);

  RETURN jsonb_build_object(
    'email', v_email,
    'tem_dado_questoes', v_tem,
    'ultima_resposta', (SELECT max(f.response_timestamp) AT TIME ZONE 'UTC'
      FROM public.fato_resolucao_questoes_b2b f WHERE f.sanarflix_user_id = v_sfx
        AND f.response_date = (SELECT max(fd.response_date) FROM public.fato_resolucao_questoes_b2b fd
                                WHERE fd.sanarflix_user_id = v_sfx)),
    'por_semana', coalesce((
      SELECT jsonb_agg(jsonb_build_object('semana', w.semana,
        'respondidas', coalesce(s.respondidas, 0), 'acertos', coalesce(s.acertos, 0), 'erros', coalesce(s.erros, 0))
        ORDER BY w.semana)
      FROM (SELECT v_segunda - 49 + 7 * g AS semana FROM generate_series(0, 7) AS g) AS w
      LEFT JOIN (
        SELECT date_trunc('week', f.response_date::timestamp)::date AS semana,
               count(*) AS respondidas,
               count(*) FILTER (WHERE f.acertou IS TRUE) AS acertos,
               count(*) FILTER (WHERE f.acertou IS FALSE) AS erros
        FROM public.fato_resolucao_questoes_b2b f
        WHERE f.sanarflix_user_id = v_sfx AND f.response_date >= v_segunda - 49
        GROUP BY 1
      ) s ON s.semana = w.semana
    ), '[]'::jsonb),
    'por_area', coalesce((
      SELECT jsonb_agg(jsonb_build_object('area', r.area, 'respondidas', r.respondidas,
        'acertos', r.acertos, 'erros', r.erros,
        'pct_acerto', round(100.0 * r.acertos / nullif(r.acertos + r.erros, 0), 1))
        ORDER BY (r.area = 'Sem classificação'), r.respondidas DESC, r.area)
      FROM (
        SELECT coalesce(t.nome, 'Sem classificação') AS area,
               count(*) AS respondidas,
               count(*) FILTER (WHERE f.acertou IS TRUE) AS acertos,
               count(*) FILTER (WHERE f.acertou IS FALSE) AS erros
        FROM public.fato_resolucao_questoes_b2b f
        LEFT JOIN public.eng_questao_classificacao c ON c.question_id = f.question_id
        LEFT JOIN public.eng_no_taxonomia t ON t.no_id = c.n1_id
        WHERE f.sanarflix_user_id = v_sfx AND f.response_date >= v_hoje - 29
        GROUP BY 1
        ORDER BY (coalesce(t.nome, 'Sem classificação') = 'Sem classificação'), respondidas DESC, area
        LIMIT 6
      ) r
    ), '[]'::jsonb)
  );
END;
$function$;

revoke all on function public.mentor_turma() from public;
revoke execute on function public.mentor_turma() from anon;
grant execute on function public.mentor_turma() to authenticated;

revoke all on function public.mentor_aluno_questoes(text) from public;
revoke execute on function public.mentor_aluno_questoes(text) from anon;
grant execute on function public.mentor_aluno_questoes(text) to authenticated;
