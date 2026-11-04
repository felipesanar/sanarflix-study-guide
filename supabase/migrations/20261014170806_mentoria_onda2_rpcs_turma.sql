-- Página do Mentor · Onda 2 (Agir): leitura da turma e do aluno.
-- Última atividade = maior entre consumo no Flix (fato_consumo_conteudo_b2b)
-- e sessão no Academy (user_sessions). Sumido = 10+ dias; esfriando = 8 a 9.
create or replace function public.mentor_turma()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
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
             ) AS ultima_atividade
      FROM alunos a
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
                       ELSE 'ativo' END
    ) ORDER BY c.dias DESC NULLS LAST, c.nome)
    FROM calculado c
  ), '[]'::jsonb);
END;
$function$;

create or replace function public.mentor_aluno(p_email text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_email text := (public.mentor_exige_alunos(v_mentor, array[p_email]))[1];
BEGIN
  RETURN jsonb_build_object(
    'aluno', (SELECT t FROM jsonb_array_elements(public.mentor_turma()) t WHERE t->>'email' = v_email),
    'liberacao', (SELECT jsonb_build_object('ligado', l.ligado, 'desde', l.desde, 'mensagem', l.mensagem)
                  FROM public.mentoria_agenda_liberacoes l
                  WHERE l.mentor_id = v_mentor AND l.aluno_email = v_email AND l.ligado),
    'intervencoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', i.id, 'tipo', i.tipo, 'titulo', i.titulo, 'status', i.status, 'criado_em', i.criado_em) ORDER BY i.criado_em DESC)
      FROM (SELECT i0.* FROM public.mentoria_intervencoes i0
            JOIN public.mentoria_intervencao_alunos ia ON ia.intervencao_id = i0.id
            WHERE i0.mentor_id = v_mentor AND ia.aluno_email = v_email
            ORDER BY i0.criado_em DESC LIMIT 50) i), '[]'::jsonb),
    'log', coalesce((
      SELECT jsonb_agg(jsonb_build_object('tipo', e.tipo, 'criado_em', e.criado_em, 'payload', e.payload) ORDER BY e.criado_em DESC)
      FROM (SELECT * FROM public.mentoria_eventos e0
            WHERE e0.mentor_id = v_mentor AND e0.aluno_email = v_email
            ORDER BY e0.criado_em DESC LIMIT 50) e), '[]'::jsonb)
  );
END;
$function$;

revoke all on function public.mentor_turma() from public;
revoke execute on function public.mentor_turma() from anon;
grant execute on function public.mentor_turma() to authenticated;
revoke all on function public.mentor_aluno(text) from public;
revoke execute on function public.mentor_aluno(text) from anon;
grant execute on function public.mentor_aluno(text) to authenticated;
