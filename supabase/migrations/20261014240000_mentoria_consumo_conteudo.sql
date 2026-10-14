-- Página do Mentor · consumo de conteúdo (Flix) por aluno.
-- 1) mentor_turma() ganha conteudos_7d, conteudos_30d e tem_dado_consumo por aluno.
--    Todo o resto (chaves, ordenação, corte de 10 dias para sumido) segue idêntico à Onda 2.
-- 2) mentor_aluno_conteudos(p_email): consumo semanal, últimos eventos e top cursos de um aluno.
--
-- FUSO (verificado em prod, não é suposição): fato_consumo_conteudo_b2b.event_date é o dia civil
-- de America/Sao_Paulo; event_timestamp é UTC. Em amostra de eventos no fim do dia UTC, 4377/4377
-- batem com a data de SP e 0 com a data UTC. Por isso a janela "7 dias incluindo hoje" é
-- event_date >= hoje_SP - 6 (30 dias: - 29), com hoje_SP = (now() AT TIME ZONE 'America/Sao_Paulo')::date.
-- A conversão de event_timestamp para timestamptz usa AT TIME ZONE 'UTC'.
-- tem_dado_consumo distingue "sem fonte de dados" (exibir "–") de "tem fonte, consumiu 0" (exibir 0).

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
                 WHERE a.academy_user_id IS NOT NULL AND s.user_id = a.academy_user_id)
             ) AS ultima_atividade,
             (a.sanarflix_user_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.fato_consumo_conteudo_b2b fx
                 WHERE fx.sanarflix_user_id = a.sanarflix_user_id)) AS tem_dado_consumo,
             cons.v7, cons.d7, cons.v30, cons.d30
      FROM alunos a
      LEFT JOIN LATERAL (
        SELECT
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) FILTER (WHERE f.content_type = 'video' AND f.event_date >= v_hoje - 6) END AS v7,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) FILTER (WHERE f.content_type = 'document' AND f.event_date >= v_hoje - 6) END AS d7,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) FILTER (WHERE f.content_type = 'video') END AS v30,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) FILTER (WHERE f.content_type = 'document') END AS d30
        FROM public.fato_consumo_conteudo_b2b f
        WHERE a.sanarflix_user_id IS NOT NULL
          AND f.sanarflix_user_id = a.sanarflix_user_id
          AND f.event_date >= v_hoje - 29
      ) cons ON true
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
      'tem_dado_consumo', c.tem_dado_consumo
    ) ORDER BY c.dias DESC NULLS LAST, c.nome)
    FROM calculado c
  ), '[]'::jsonb);
END;
$function$;

create or replace function public.mentor_aluno_conteudos(p_email text)
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

  -- mesma resolução do mentor_turma: vínculo, senão dim por e-mail preferindo status ativo
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
    RETURN jsonb_build_object('email', v_email, 'tem_dado_consumo', false,
      'por_semana', '[]'::jsonb, 'recentes', '[]'::jsonb, 'top_cursos', '[]'::jsonb);
  END IF;

  v_tem := EXISTS (
    SELECT 1 FROM public.fato_consumo_conteudo_b2b fx WHERE fx.sanarflix_user_id = v_sfx);

  RETURN jsonb_build_object(
    'email', v_email,
    'tem_dado_consumo', v_tem,
    'por_semana', coalesce((
      SELECT jsonb_agg(jsonb_build_object('semana', w.semana, 'videos', coalesce(s.videos, 0), 'documentos', coalesce(s.documentos, 0))
                       ORDER BY w.semana)
      FROM (SELECT v_segunda - 49 + 7 * g AS semana FROM generate_series(0, 7) AS g) AS w
      LEFT JOIN (
        SELECT date_trunc('week', f.event_date::timestamp)::date AS semana,
               count(*) FILTER (WHERE f.content_type = 'video') AS videos,
               count(*) FILTER (WHERE f.content_type = 'document') AS documentos
        FROM public.fato_consumo_conteudo_b2b f
        WHERE f.sanarflix_user_id = v_sfx AND f.event_date >= v_segunda - 49
        GROUP BY 1
      ) s ON s.semana = w.semana
    ), '[]'::jsonb),
    'recentes', coalesce((
      SELECT jsonb_agg(jsonb_build_object('quando', r.quando, 'tipo', r.tipo, 'conteudo', r.conteudo, 'curso', r.curso, 'modulo', r.modulo)
                       ORDER BY r.quando DESC, r.event_key)
      FROM (
        SELECT f.event_key,
               (f.event_timestamp AT TIME ZONE 'UTC') AS quando,
               f.content_type AS tipo, f.content_name AS conteudo,
               f.course_name AS curso, f.module_name AS modulo
        FROM public.fato_consumo_conteudo_b2b f
        WHERE f.sanarflix_user_id = v_sfx
        ORDER BY f.event_timestamp DESC, f.event_key
        LIMIT 20
      ) r
    ), '[]'::jsonb),
    'top_cursos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('curso', t.curso, 'total', t.total) ORDER BY t.total DESC, t.curso)
      FROM (
        SELECT f.course_name AS curso, count(*) AS total
        FROM public.fato_consumo_conteudo_b2b f
        WHERE f.sanarflix_user_id = v_sfx AND f.event_date >= v_hoje - 29
        GROUP BY f.course_name
        ORDER BY count(*) DESC, f.course_name
        LIMIT 5
      ) t
    ), '[]'::jsonb)
  );
END;
$function$;

revoke all on function public.mentor_turma() from public;
revoke execute on function public.mentor_turma() from anon;
grant execute on function public.mentor_turma() to authenticated;
revoke all on function public.mentor_aluno_conteudos(text) from public;
revoke execute on function public.mentor_aluno_conteudos(text) from anon;
grant execute on function public.mentor_aluno_conteudos(text) to authenticated;
