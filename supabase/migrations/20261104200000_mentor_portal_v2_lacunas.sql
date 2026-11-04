-- Lacunas do contrato Academy/Flix. Corpos vigentes: contexto, convites e sessoes
-- 20261104181315; turma 20261104181551; intervencao 20261014171927.
begin;

-- Preserva 'auto' para os produtores existentes e permite as origens do Portal.
alter table public.mentoria_intervencoes
  drop constraint mentoria_intervencoes_origem_check,
  add constraint mentoria_intervencoes_origem_check
    check (origem in ('auto', 'manual', 'agenda_liberada', 'tema_critico', 'questao', 'mural', 'sessao_criada'));

create or replace function public.get_mentor_contexto()
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_id uuid := public.mentor_ativo_id();
  v_mentor jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  SELECT jsonb_build_object(
    'user_id', m.user_id, 'nome', u.nome, 'email', u.email,
    'link_agendamento', m.link_agendamento, 'foto_url', m.foto_url,
    'tipo', m.tipo, 'turma_nome', m.turma_nome,
    'ies_id', m.ies_id, 'ies_nome', i.nome, 'ativo', m.ativo,
    'portal_mentor', m.portal_mentor, 'modalidade', m.tipo,
    'tribo_slug', trim(both '-' from regexp_replace(
      translate(lower(m.turma_nome), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
      '[^a-z0-9]+', '-', 'g')))
  INTO v_mentor
  FROM public.mentores m
  JOIN public.users u ON u.id = m.user_id
  LEFT JOIN public.ies i ON i.id = m.ies_id
  WHERE m.user_id = v_id;
  RETURN jsonb_build_object('mentor', v_mentor,
    'alunos_ativos', (SELECT count(*) FROM public.mentoria_vinculos v WHERE v.mentor_id = v_id AND v.fim IS NULL));
END;
$function$;

-- Retira a assinatura antiga para chamadas de cinco argumentos usarem os defaults.
drop function public.mentor_intervencao_criar(text, text, text, text, text[]);
create or replace function public.mentor_intervencao_criar(
  p_tipo text,
  p_titulo text,
  p_nota text,
  p_alvo text,
  p_alunos text[],
  p_perfil text default null,
  p_origem text default 'manual',
  p_origem_ref jsonb default null
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_emails text[];
  v_interv_id uuid;
BEGIN
  IF p_tipo IS NULL OR p_tipo NOT IN ('reuniao_individual', 'reuniao_coletiva', 'mensagem_mural', 'whatsapp', 'outro') THEN
    RAISE EXCEPTION 'tipo de intervenção inválido: %', p_tipo;
  END IF;
  IF p_alvo IS NULL OR p_alvo NOT IN ('aluno', 'grupo', 'turma') THEN
    RAISE EXCEPTION 'alvo inválido: % (use aluno, grupo ou turma)', p_alvo;
  END IF;
  IF coalesce(btrim(p_titulo), '') = '' THEN RAISE EXCEPTION 'título obrigatório'; END IF;
  IF p_perfil IS NOT NULL AND p_perfil NOT IN ('virada', 'baixo', 'bom') THEN
    RAISE EXCEPTION 'perfil invalido: % (use virada, baixo ou bom)', p_perfil;
  END IF;
  IF p_origem IS NULL OR p_origem NOT IN ('manual', 'agenda_liberada', 'tema_critico', 'questao', 'mural', 'sessao_criada') THEN
    RAISE EXCEPTION 'origem invalida: %', p_origem;
  END IF;

  IF p_alvo = 'turma' THEN
    SELECT coalesce(array_agg(v.email_normalizado ORDER BY v.email_normalizado), '{}') INTO v_emails
    FROM public.mentoria_vinculos v
    WHERE v.mentor_id = v_mentor AND v.fim IS NULL;
  ELSE
    v_emails := public.mentor_exige_alunos(v_mentor, p_alunos);
    IF p_alvo = 'aluno' AND cardinality(v_emails) <> 1 THEN
      RAISE EXCEPTION 'alvo aluno exige exatamente um aluno';
    END IF;
    IF p_alvo = 'grupo' AND cardinality(v_emails) = 0 THEN
      RAISE EXCEPTION 'selecione ao menos um aluno';
    END IF;
  END IF;

  INSERT INTO public.mentoria_intervencoes (mentor_id, tipo, titulo, nota, status, alvo, origem, perfil, origem_ref)
  VALUES (v_mentor, p_tipo, btrim(p_titulo), nullif(btrim(p_nota), ''), 'a_fazer', p_alvo, p_origem, p_perfil, p_origem_ref)
  RETURNING id INTO v_interv_id;

  INSERT INTO public.mentoria_intervencao_alunos (intervencao_id, aluno_email)
  SELECT v_interv_id, e FROM unnest(v_emails) e;

  INSERT INTO public.mentoria_eventos (mentor_id, aluno_email, tipo, intervencao_id, payload)
  SELECT v_mentor, e, 'intervencao_criada', v_interv_id, jsonb_build_object('tipo', p_tipo, 'alvo', p_alvo)
  FROM unnest(v_emails) e;

  RETURN jsonb_build_object('intervencao_id', v_interv_id);
END;
$function$;

create or replace function public.mentor_convites_listar()
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE v_mentor uuid := public.mentor_ativo_id();
BEGIN
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', l.id, 'alunoEmail', l.aluno_email,
    'alunoNome', coalesce(v.nome, u.nome), 'mensagem', l.mensagem, 'desde', l.desde,
    'publicacao_id', post.id) ORDER BY l.desde DESC, l.id)
    FROM public.mentoria_agenda_liberacoes l
    JOIN public.mentoria_vinculos v ON v.mentor_id = l.mentor_id AND v.email_normalizado = l.aluno_email AND v.fim IS NULL
    LEFT JOIN public.users u ON u.id = v.academy_user_id
    LEFT JOIN LATERAL (
      SELECT p.id
      FROM public.mentoria_eventos e
      JOIN public.mural_posts p ON p.id::text = e.payload->>'post_id' AND p.mentor_id = l.mentor_id
      WHERE e.mentor_id = l.mentor_id AND e.aluno_email = l.aluno_email
        AND e.tipo = 'agenda_liberada' AND e.payload->>'liberacao_id' = l.id::text
      ORDER BY e.criado_em DESC, e.id DESC
      LIMIT 1
    ) post ON true
    WHERE l.mentor_id = v_mentor AND l.ligado), '[]'::jsonb);
END;
$function$;

-- A dim B2B e o espelho B2C locais nao possuem coluna de campus ou produto.
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
             v.inicio AS entrou_em,
             coalesce(v.academy_user_id, d.academy_user_id) AS academy_user_id,
             coalesce(v.sanarflix_user_id, d.sanarflix_user_id) AS sanarflix_user_id,
             CASE WHEN alvo.valor IS NULL THEN NULL
                  ELSE jsonb_build_object('especialidade', b.especialidade_nome,
                    'instituicao', alvo.valor->>'nome', 'cortePct', b.corte_mais_dificil) END AS meta
      FROM public.mentoria_vinculos v
      LEFT JOIN public.users u ON u.id = v.academy_user_id
      LEFT JOIN LATERAL (
        SELECT * FROM public.dim_aluno_b2b d0
        WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST
        LIMIT 1
      ) d ON true
      LEFT JOIN public.b2c_alunos b ON b.email = v.email_normalizado
      LEFT JOIN LATERAL (
        SELECT alvo AS valor FROM jsonb_array_elements(b.alvos) alvo
        ORDER BY (alvo->>'corte_geral')::numeric DESC NULLS LAST,
                 alvo->>'nome', alvo->>'institution_id'
        LIMIT 1
      ) alvo ON true
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ),
    atividade AS (
      SELECT a.*,
             greatest(
               (SELECT max(f.event_timestamp) AT TIME ZONE 'UTC' FROM public.fato_consumo_conteudo_b2b f
                 WHERE a.sanarflix_user_id IS NOT NULL AND f.sanarflix_user_id = a.sanarflix_user_id),
               (SELECT max(s.started_at) FROM public.user_sessions s
                 WHERE a.academy_user_id IS NOT NULL AND s.user_id = a.academy_user_id),
               -- Mantem a busca da ultima data pelo indice (aluno, data).
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
      'entrou_em', c.entrou_em, 'produto', CASE WHEN c.b2b THEN 'padrao' ELSE 'pro' END, 'campus', null,
      'acesso_ate', c.acesso_ate, 'b2b', c.b2b, 'academy_user_id', c.academy_user_id,
      'sanarflix_user_id', c.sanarflix_user_id, 'ultima_atividade', c.ultima_atividade,
      'dias_sem_atividade', c.dias,
      'segmento', CASE WHEN dias IS NULL THEN 'sem_dado'
                       WHEN dias >= 15 THEN 'sumido'
                       WHEN dias >= 8 THEN 'esfriando'
                       ELSE 'ativo' END,
      'meta', c.meta,
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

create or replace function public.mentor_sessoes_listar(p_quando text)
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE v_mentor uuid := public.mentor_ativo_id();
BEGIN
  IF p_quando IS NULL OR p_quando NOT IN ('proximas', 'realizadas', 'todas', 'todas_sem_acervo') THEN
    RAISE EXCEPTION 'filtro inválido: % (use proximas, realizadas, todas ou todas_sem_acervo)', p_quando;
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', s.id, 'tipo', s.tipo, 'titulo', s.titulo, 'tema', s.tema, 'inicio', s.inicio,
    'duracao_min', s.duracao_min, 'meet_link', s.meet_link, 'gravacao_url', s.gravacao_url,
    'aluno_email', s.aluno_email, 'status', s.status, 'realizada_em', s.realizada_em, 'origem', s.origem,
    'pauta', s.pauta, 'descricao', s.descricao
    ) ORDER BY CASE WHEN p_quando = 'proximas' THEN s.inicio END ASC, s.inicio DESC, s.id)
    FROM public.mentoria_sessoes s WHERE CASE p_quando
      WHEN 'proximas' THEN s.mentor_id = v_mentor AND s.status = 'agendada' AND s.inicio + make_interval(mins => s.duracao_min) >= now()
      WHEN 'realizadas' THEN s.status = 'realizada' AND (s.mentor_id = v_mentor OR s.origem = 'arquivo_2025')
      WHEN 'todas_sem_acervo' THEN s.mentor_id = v_mentor AND s.origem <> 'arquivo_2025'
      ELSE s.mentor_id = v_mentor OR s.origem = 'arquivo_2025' END), '[]'::jsonb);
END;
$function$;

revoke all on function public.get_mentor_contexto() from public;
revoke execute on function public.get_mentor_contexto() from anon;
grant execute on function public.get_mentor_contexto() to authenticated;
revoke all on function public.mentor_intervencao_criar(text, text, text, text, text[], text, text, jsonb) from public;
revoke execute on function public.mentor_intervencao_criar(text, text, text, text, text[], text, text, jsonb) from anon;
grant execute on function public.mentor_intervencao_criar(text, text, text, text, text[], text, text, jsonb) to authenticated;
revoke all on function public.mentor_convites_listar() from public;
revoke execute on function public.mentor_convites_listar() from anon;
grant execute on function public.mentor_convites_listar() to authenticated;
revoke all on function public.mentor_turma() from public;
revoke execute on function public.mentor_turma() from anon;
grant execute on function public.mentor_turma() to authenticated;
revoke all on function public.mentor_sessoes_listar(text) from public;
revoke execute on function public.mentor_sessoes_listar(text) from anon;
grant execute on function public.mentor_sessoes_listar(text) to authenticated;

commit;
