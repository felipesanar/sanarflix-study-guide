-- Página do Mentor · Onda 2 (Agir): RPCs de ação do mentor.
-- Mural, sessões, liberação de agenda e intervenções. Toda função começa por
-- mentor_ativo_id() (papel + cadastro ativo) e passa e-mails por
-- mentor_exige_alunos() (vínculo ativo). O histórico (mentoria_*) nunca é apagado.

-- 1. Mural: salvar (rascunho ou publicado), com card de intervenção opcional.
create or replace function public.mentor_mural_salvar(
  p_id uuid,
  p_tag text,
  p_titulo text,
  p_mensagem text,
  p_link_titulo text,
  p_link_url text,
  p_anexo_path text,
  p_anexo_nome text,
  p_publico text,
  p_destinatarios text[],
  p_publicar boolean,
  p_registrar_intervencao boolean
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_dest text[] := '{}';
  v_emails text[];
  v_post_id uuid;
  v_status text;
  v_status_antes text;
  v_interv_id uuid;
  v_alvo text;
  v_novo_publicado boolean;
BEGIN
  IF coalesce(btrim(p_tag), '') = '' THEN RAISE EXCEPTION 'tag obrigatória'; END IF;
  IF coalesce(btrim(p_titulo), '') = '' THEN RAISE EXCEPTION 'título obrigatório'; END IF;
  IF coalesce(btrim(p_mensagem), '') = '' THEN RAISE EXCEPTION 'mensagem obrigatória'; END IF;
  IF p_publico IS NULL OR p_publico NOT IN ('turma', 'selecionados') THEN
    RAISE EXCEPTION 'público inválido: % (use turma ou selecionados)', p_publico;
  END IF;
  IF p_link_url IS NOT NULL AND coalesce(btrim(p_link_titulo), '') = '' THEN
    RAISE EXCEPTION 'o link precisa de um título';
  END IF;
  IF p_anexo_path IS NOT NULL AND p_anexo_path NOT LIKE v_mentor::text || '/%' THEN
    RAISE EXCEPTION 'anexo fora da pasta do mentor';
  END IF;

  IF p_publico = 'selecionados' THEN
    v_dest := public.mentor_exige_alunos(v_mentor, p_destinatarios);
    IF cardinality(v_dest) = 0 THEN
      RAISE EXCEPTION 'selecione ao menos um destinatário';
    END IF;
  END IF;

  IF p_id IS NULL THEN
    v_status_antes := NULL;
    INSERT INTO public.mural_posts (mentor_id, tag, titulo, mensagem, link_titulo, link_url,
                                    anexo_path, anexo_nome, publico, status, publicado_em, origem)
    VALUES (v_mentor, btrim(p_tag), btrim(p_titulo), btrim(p_mensagem), nullif(btrim(p_link_titulo), ''),
            nullif(btrim(p_link_url), ''), p_anexo_path, p_anexo_nome, p_publico,
            CASE WHEN p_publicar THEN 'publicado' ELSE 'rascunho' END,
            CASE WHEN p_publicar THEN now() END, 'mentor')
    RETURNING id, status INTO v_post_id, v_status;
  ELSE
    SELECT status INTO v_status_antes
    FROM public.mural_posts
    WHERE id = p_id AND mentor_id = v_mentor
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'post não encontrado'; END IF;

    UPDATE public.mural_posts
    SET tag = btrim(p_tag),
        titulo = btrim(p_titulo),
        mensagem = btrim(p_mensagem),
        link_titulo = nullif(btrim(p_link_titulo), ''),
        link_url = nullif(btrim(p_link_url), ''),
        anexo_path = p_anexo_path,
        anexo_nome = p_anexo_nome,
        publico = p_publico,
        status = CASE WHEN p_publicar THEN 'publicado' ELSE status END,
        publicado_em = CASE WHEN p_publicar THEN coalesce(publicado_em, now()) ELSE publicado_em END,
        updated_at = now()
    WHERE id = p_id AND mentor_id = v_mentor
    RETURNING id, status INTO v_post_id, v_status;
  END IF;

  -- Destinatários: a lista é substituída a cada salvamento (única exclusão permitida).
  DELETE FROM public.mural_destinatarios WHERE post_id = v_post_id;
  IF p_publico = 'selecionados' THEN
    INSERT INTO public.mural_destinatarios (post_id, aluno_email)
    SELECT v_post_id, e FROM unnest(v_dest) e;
  END IF;

  -- Só a primeira publicação gera card e eventos (re-salvar um post já publicado não duplica).
  v_novo_publicado := p_publicar AND v_status_antes IS DISTINCT FROM 'publicado';

  IF v_novo_publicado THEN
    IF p_publico = 'turma' THEN
      SELECT coalesce(array_agg(v.email_normalizado ORDER BY v.email_normalizado), '{}') INTO v_emails
      FROM public.mentoria_vinculos v
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL;
    ELSE
      v_emails := v_dest;
    END IF;

    IF p_registrar_intervencao THEN
      v_alvo := CASE
        WHEN p_publico = 'turma' THEN 'turma'
        WHEN cardinality(v_dest) = 1 THEN 'aluno'
        ELSE 'grupo'
      END;

      INSERT INTO public.mentoria_intervencoes (mentor_id, tipo, titulo, status, alvo, origem, origem_ref, concluido_em)
      VALUES (v_mentor, 'mensagem_mural', btrim(p_titulo), 'feito', v_alvo, 'auto',
              jsonb_build_object('kind', 'mural_post', 'id', v_post_id), now())
      RETURNING id INTO v_interv_id;

      INSERT INTO public.mentoria_intervencao_alunos (intervencao_id, aluno_email)
      SELECT v_interv_id, e FROM unnest(v_emails) e;
    END IF;

    INSERT INTO public.mentoria_eventos (mentor_id, aluno_email, tipo, intervencao_id, payload)
    SELECT v_mentor, e, 'mural_publicado', v_interv_id, jsonb_build_object('post_id', v_post_id, 'tag', btrim(p_tag))
    FROM unnest(v_emails) e;
  END IF;

  RETURN jsonb_build_object('post_id', v_post_id, 'publicado', v_status = 'publicado', 'intervencao_id', v_interv_id);
END;
$function$;

-- 2. Mural: listar os posts do mentor (filtros opcionais por aluno e tag).
create or replace function public.mentor_mural_listar(p_aluno_email text default null, p_tag text default null)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_aluno text;
BEGIN
  IF p_aluno_email IS NOT NULL AND btrim(p_aluno_email) <> '' THEN
    v_aluno := (public.mentor_exige_alunos(v_mentor, ARRAY[p_aluno_email]))[1];
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'tag', p.tag,
      'titulo', p.titulo,
      'mensagem', p.mensagem,
      'link_titulo', p.link_titulo,
      'link_url', p.link_url,
      'anexo_nome', p.anexo_nome,
      'anexo_path', p.anexo_path,
      'publico', p.publico,
      'status', p.status,
      'publicado_em', p.publicado_em,
      'origem', p.origem,
      'destinatarios', coalesce((
        SELECT jsonb_agg(d.aluno_email ORDER BY d.aluno_email)
        FROM public.mural_destinatarios d WHERE d.post_id = p.id), '[]'::jsonb)
    ) ORDER BY coalesce(p.publicado_em, p.created_at) DESC, p.id)
    FROM public.mural_posts p
    WHERE p.mentor_id = v_mentor
      AND (p_tag IS NULL OR p.tag = p_tag)
      AND (v_aluno IS NULL
           OR p.publico = 'turma'
           OR EXISTS (SELECT 1 FROM public.mural_destinatarios d
                      WHERE d.post_id = p.id AND d.aluno_email = v_aluno))
  ), '[]'::jsonb);
END;
$function$;

-- 3. Tags já usadas pelo mentor + sugestões fixas.
create or replace function public.mentor_tags()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
BEGIN
  RETURN coalesce((
    SELECT jsonb_agg(x.t ORDER BY x.t)
    FROM (
      SELECT p.tag AS t FROM public.mural_posts p WHERE p.mentor_id = v_mentor
      UNION
      SELECT s FROM unnest(ARRAY['Desempenho', 'Aviso', 'Fique por dentro']) s
    ) x
  ), '[]'::jsonb);
END;
$function$;

-- 4. Sessões: criar ou editar. Criar gera card (e post, na coletiva).
create or replace function public.mentor_sessao_salvar(
  p_id uuid,
  p_tipo text,
  p_titulo text,
  p_tema text,
  p_inicio timestamptz,
  p_duracao_min int,
  p_meet_link text,
  p_aluno_email text
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_aluno text;
  v_emails text[];
  v_sessao_id uuid;
  v_interv_id uuid;
  v_post_id uuid;
  v_mensagem text;
BEGIN
  IF p_tipo IS NULL OR p_tipo NOT IN ('coletiva', 'individual') THEN
    RAISE EXCEPTION 'tipo de sessão inválido: % (use coletiva ou individual)', p_tipo;
  END IF;
  IF coalesce(btrim(p_titulo), '') = '' THEN RAISE EXCEPTION 'título obrigatório'; END IF;
  IF p_inicio IS NULL THEN RAISE EXCEPTION 'data e hora obrigatórias'; END IF;

  IF p_tipo = 'individual' THEN
    IF coalesce(btrim(p_aluno_email), '') = '' THEN
      RAISE EXCEPTION 'sessão individual exige um aluno';
    END IF;
    v_aluno := (public.mentor_exige_alunos(v_mentor, ARRAY[p_aluno_email]))[1];
  END IF;

  IF p_id IS NOT NULL THEN
    -- Editar: só os campos da sessão; card e post originais não são recriados.
    UPDATE public.mentoria_sessoes
    SET titulo = btrim(p_titulo),
        tema = nullif(btrim(p_tema), ''),
        inicio = p_inicio,
        duracao_min = coalesce(p_duracao_min, duracao_min),
        meet_link = nullif(btrim(p_meet_link), ''),
        updated_at = now()
    WHERE id = p_id AND mentor_id = v_mentor
    RETURNING id INTO v_sessao_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'sessão não encontrada'; END IF;

    RETURN jsonb_build_object('sessao_id', v_sessao_id, 'intervencao_id', NULL, 'post_id', NULL);
  END IF;

  INSERT INTO public.mentoria_sessoes (mentor_id, tipo, titulo, tema, inicio, duracao_min, meet_link,
                                       aluno_email, status, origem, created_by)
  VALUES (v_mentor, p_tipo, btrim(p_titulo), nullif(btrim(p_tema), ''), p_inicio, coalesce(p_duracao_min, 60),
          nullif(btrim(p_meet_link), ''), v_aluno, 'agendada', 'academy', v_mentor)
  RETURNING id INTO v_sessao_id;

  IF p_tipo = 'coletiva' THEN
    v_mensagem := 'Sessão coletiva em '
      || to_char(p_inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
      || ' às '
      || to_char(p_inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')
      || '.'
      || CASE WHEN nullif(btrim(p_tema), '') IS NOT NULL THEN E'\nTema: ' || btrim(p_tema) ELSE '' END;

    INSERT INTO public.mural_posts (mentor_id, tag, titulo, mensagem, link_titulo, link_url,
                                    publico, status, publicado_em, origem)
    VALUES (v_mentor, 'Aviso', 'Sessão coletiva: ' || btrim(p_titulo), v_mensagem,
            CASE WHEN nullif(btrim(p_meet_link), '') IS NOT NULL THEN 'Entrar na sessão' END,
            nullif(btrim(p_meet_link), ''),
            'turma', 'publicado', now(), 'sessao_coletiva')
    RETURNING id INTO v_post_id;

    SELECT coalesce(array_agg(v.email_normalizado ORDER BY v.email_normalizado), '{}') INTO v_emails
    FROM public.mentoria_vinculos v
    WHERE v.mentor_id = v_mentor AND v.fim IS NULL;

    INSERT INTO public.mentoria_intervencoes (mentor_id, tipo, titulo, status, alvo, origem, origem_ref)
    VALUES (v_mentor, 'reuniao_coletiva', btrim(p_titulo), 'a_fazer', 'turma', 'auto',
            jsonb_build_object('kind', 'sessao', 'id', v_sessao_id))
    RETURNING id INTO v_interv_id;
  ELSE
    v_emails := ARRAY[v_aluno];

    INSERT INTO public.mentoria_intervencoes (mentor_id, tipo, titulo, status, alvo, origem, origem_ref)
    VALUES (v_mentor, 'reuniao_individual', btrim(p_titulo), 'a_fazer', 'aluno', 'auto',
            jsonb_build_object('kind', 'sessao', 'id', v_sessao_id))
    RETURNING id INTO v_interv_id;
  END IF;

  INSERT INTO public.mentoria_intervencao_alunos (intervencao_id, aluno_email)
  SELECT v_interv_id, e FROM unnest(v_emails) e;

  INSERT INTO public.mentoria_eventos (mentor_id, aluno_email, tipo, intervencao_id, payload)
  SELECT v_mentor, e, 'sessao_criada', v_interv_id,
         jsonb_build_object('sessao_id', v_sessao_id, 'tipo', p_tipo, 'inicio', p_inicio)
  FROM unnest(v_emails) e;

  RETURN jsonb_build_object('sessao_id', v_sessao_id, 'intervencao_id', v_interv_id, 'post_id', v_post_id);
END;
$function$;

-- 5. Sessões: marcar como realizada (leva o card ligado para Feito).
create or replace function public.mentor_sessao_marcar_feita(p_id uuid, p_gravacao_url text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_sessao_id uuid;
BEGIN
  UPDATE public.mentoria_sessoes
  SET status = 'realizada',
      realizada_em = now(),
      gravacao_url = coalesce(nullif(btrim(p_gravacao_url), ''), gravacao_url),
      updated_at = now()
  WHERE id = p_id AND mentor_id = v_mentor
  RETURNING id INTO v_sessao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sessão não encontrada'; END IF;

  WITH upd AS (
    UPDATE public.mentoria_intervencoes i
    SET status = 'feito', concluido_em = now(), atualizado_em = now()
    WHERE i.mentor_id = v_mentor
      AND i.origem_ref->>'kind' = 'sessao'
      AND i.origem_ref->>'id' = p_id::text
      AND i.status <> 'feito'
    RETURNING i.id
  )
  INSERT INTO public.mentoria_eventos (mentor_id, aluno_email, tipo, intervencao_id, payload)
  SELECT v_mentor, a.aluno_email, 'sessao_realizada', upd.id, jsonb_build_object('sessao_id', v_sessao_id)
  FROM upd
  JOIN public.mentoria_intervencao_alunos a ON a.intervencao_id = upd.id;

  RETURN jsonb_build_object('sessao_id', v_sessao_id);
END;
$function$;

-- 6. Sessões: listar. O acervo 2025 (mentor nulo) aparece em realizadas/todas.
create or replace function public.mentor_sessoes_listar(p_quando text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
BEGIN
  IF p_quando IS NULL OR p_quando NOT IN ('proximas', 'realizadas', 'todas') THEN
    RAISE EXCEPTION 'filtro inválido: % (use proximas, realizadas ou todas)', p_quando;
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id,
      'tipo', s.tipo,
      'titulo', s.titulo,
      'tema', s.tema,
      'inicio', s.inicio,
      'duracao_min', s.duracao_min,
      'meet_link', s.meet_link,
      'gravacao_url', s.gravacao_url,
      'aluno_email', s.aluno_email,
      'status', s.status,
      'realizada_em', s.realizada_em,
      'origem', s.origem
    ) ORDER BY CASE WHEN p_quando = 'proximas' THEN s.inicio END ASC, s.inicio DESC, s.id)
    FROM public.mentoria_sessoes s
    WHERE CASE p_quando
            WHEN 'proximas' THEN s.mentor_id = v_mentor AND s.status = 'agendada' AND s.inicio >= now()
            WHEN 'realizadas' THEN s.status = 'realizada' AND (s.mentor_id = v_mentor OR s.origem = 'arquivo_2025')
            ELSE s.mentor_id = v_mentor OR s.origem = 'arquivo_2025'
          END
  ), '[]'::jsonb);
END;
$function$;

-- 7. Link do Google Agenda do mentor.
create or replace function public.mentor_definir_link_agendamento(p_url text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_link text;
BEGIN
  IF p_url IS NULL OR btrim(p_url) !~* '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'link de agendamento inválido (use um endereço https)';
  END IF;

  UPDATE public.mentores
  SET link_agendamento = btrim(p_url), updated_at = now()
  WHERE user_id = v_mentor
  RETURNING link_agendamento INTO v_link;

  RETURN jsonb_build_object('link_agendamento', v_link);
END;
$function$;

-- 8. Agenda: liberar o agendamento para alunos (post "Pra você" + card por aluno).
create or replace function public.mentor_agenda_liberar(p_emails text[], p_mensagem text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_link text;
  v_emails text[];
  v_email text;
  v_lib_id uuid;
  v_post_id uuid;
  v_interv_id uuid;
  v_n int := 0;
BEGIN
  IF coalesce(btrim(p_mensagem), '') = '' THEN
    RAISE EXCEPTION 'mensagem obrigatória';
  END IF;

  SELECT m.link_agendamento INTO v_link FROM public.mentores m WHERE m.user_id = v_mentor;
  IF coalesce(btrim(v_link), '') = '' THEN
    RAISE EXCEPTION 'cadastre o link do Google Agenda antes de liberar';
  END IF;

  v_emails := public.mentor_exige_alunos(v_mentor, p_emails);
  IF cardinality(v_emails) = 0 THEN
    RAISE EXCEPTION 'selecione ao menos um aluno';
  END IF;

  FOREACH v_email IN ARRAY v_emails LOOP
    -- Uma liberação ligada por aluno: desliga a anterior antes de criar a nova.
    UPDATE public.mentoria_agenda_liberacoes
    SET ligado = false, desligado_em = now()
    WHERE mentor_id = v_mentor AND aluno_email = v_email AND ligado;

    INSERT INTO public.mentoria_agenda_liberacoes (mentor_id, aluno_email, mensagem, ligado)
    VALUES (v_mentor, v_email, btrim(p_mensagem), true)
    RETURNING id INTO v_lib_id;

    INSERT INTO public.mural_posts (mentor_id, tag, titulo, mensagem, link_titulo, link_url,
                                    publico, status, publicado_em, origem)
    VALUES (v_mentor, 'Agenda', 'Agendamento liberado', btrim(p_mensagem), 'Agendar horário', btrim(v_link),
            'selecionados', 'publicado', now(), 'liberacao_agenda')
    RETURNING id INTO v_post_id;

    INSERT INTO public.mural_destinatarios (post_id, aluno_email) VALUES (v_post_id, v_email);

    INSERT INTO public.mentoria_intervencoes (mentor_id, tipo, titulo, status, alvo, origem, origem_ref)
    VALUES (v_mentor, 'reuniao_individual', 'Agendamento liberado', 'a_fazer', 'aluno', 'auto',
            jsonb_build_object('kind', 'agenda_liberacao', 'id', v_lib_id))
    RETURNING id INTO v_interv_id;

    INSERT INTO public.mentoria_intervencao_alunos (intervencao_id, aluno_email) VALUES (v_interv_id, v_email);

    INSERT INTO public.mentoria_eventos (mentor_id, aluno_email, tipo, intervencao_id, payload)
    VALUES (v_mentor, v_email, 'agenda_liberada', v_interv_id,
            jsonb_build_object('liberacao_id', v_lib_id, 'post_id', v_post_id));

    v_n := v_n + 1;
  END LOOP;

  RETURN jsonb_build_object('liberados', v_n, 'intervencoes', v_n);
END;
$function$;

-- 9. Agenda: desligar (p_emails nulo = todos os alunos com agenda ligada).
create or replace function public.mentor_agenda_desligar(p_emails text[])
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_emails text[];
  v_n int;
BEGIN
  IF p_emails IS NOT NULL THEN
    v_emails := public.mentor_exige_alunos(v_mentor, p_emails);
  END IF;

  WITH d AS (
    UPDATE public.mentoria_agenda_liberacoes l
    SET ligado = false, desligado_em = now()
    WHERE l.mentor_id = v_mentor
      AND l.ligado
      AND (p_emails IS NULL OR l.aluno_email = ANY (v_emails))
    RETURNING l.id, l.aluno_email
  ), ev AS (
    INSERT INTO public.mentoria_eventos (mentor_id, aluno_email, tipo, payload)
    SELECT v_mentor, d.aluno_email, 'agenda_desligada', jsonb_build_object('liberacao_id', d.id)
    FROM d
    RETURNING 1
  )
  SELECT count(*)::int INTO v_n FROM d;

  RETURN jsonb_build_object('desligados', v_n);
END;
$function$;

-- 10. Intervenção manual.
create or replace function public.mentor_intervencao_criar(
  p_tipo text,
  p_titulo text,
  p_nota text,
  p_alvo text,
  p_alunos text[]
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

  INSERT INTO public.mentoria_intervencoes (mentor_id, tipo, titulo, nota, status, alvo, origem)
  VALUES (v_mentor, p_tipo, btrim(p_titulo), nullif(btrim(p_nota), ''), 'a_fazer', p_alvo, 'manual')
  RETURNING id INTO v_interv_id;

  INSERT INTO public.mentoria_intervencao_alunos (intervencao_id, aluno_email)
  SELECT v_interv_id, e FROM unnest(v_emails) e;

  INSERT INTO public.mentoria_eventos (mentor_id, aluno_email, tipo, intervencao_id, payload)
  SELECT v_mentor, e, 'intervencao_criada', v_interv_id, jsonb_build_object('tipo', p_tipo, 'alvo', p_alvo)
  FROM unnest(v_emails) e;

  RETURN jsonb_build_object('intervencao_id', v_interv_id);
END;
$function$;

-- 11. Intervenção: atualizar título, nota e status.
create or replace function public.mentor_intervencao_atualizar(
  p_id uuid,
  p_titulo text,
  p_nota text,
  p_status text
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_status_antes text;
  v_status text;
BEGIN
  IF p_status IS NOT NULL AND p_status NOT IN ('a_fazer', 'em_andamento', 'feito') THEN
    RAISE EXCEPTION 'status inválido: %', p_status;
  END IF;

  SELECT i.status INTO v_status_antes
  FROM public.mentoria_intervencoes i
  WHERE i.id = p_id AND i.mentor_id = v_mentor
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'intervenção não encontrada'; END IF;

  UPDATE public.mentoria_intervencoes i
  SET titulo = coalesce(nullif(btrim(p_titulo), ''), i.titulo),
      nota = CASE WHEN p_nota IS NULL THEN i.nota ELSE nullif(btrim(p_nota), '') END,
      status = coalesce(p_status, i.status),
      concluido_em = CASE
        WHEN coalesce(p_status, i.status) = 'feito' THEN coalesce(i.concluido_em, now())
        ELSE NULL
      END,
      atualizado_em = now()
  WHERE i.id = p_id AND i.mentor_id = v_mentor
  RETURNING i.status INTO v_status;

  IF v_status IS DISTINCT FROM v_status_antes THEN
    INSERT INTO public.mentoria_eventos (mentor_id, aluno_email, tipo, intervencao_id, payload)
    SELECT v_mentor, a.aluno_email, 'intervencao_status', p_id,
           jsonb_build_object('de', v_status_antes, 'para', v_status)
    FROM public.mentoria_intervencao_alunos a
    WHERE a.intervencao_id = p_id;
  END IF;

  RETURN jsonb_build_object('intervencao_id', p_id, 'status', v_status);
END;
$function$;

-- 12. Intervenção: comentar.
create or replace function public.mentor_intervencao_comentar(p_id uuid, p_texto text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_comentario_id uuid;
BEGIN
  IF coalesce(btrim(p_texto), '') = '' THEN RAISE EXCEPTION 'comentário obrigatório'; END IF;

  PERFORM 1 FROM public.mentoria_intervencoes i WHERE i.id = p_id AND i.mentor_id = v_mentor;
  IF NOT FOUND THEN RAISE EXCEPTION 'intervenção não encontrada'; END IF;

  INSERT INTO public.mentoria_intervencao_comentarios (intervencao_id, autor_id, texto)
  VALUES (p_id, v_mentor, btrim(p_texto))
  RETURNING id INTO v_comentario_id;

  INSERT INTO public.mentoria_eventos (mentor_id, aluno_email, tipo, intervencao_id, payload)
  SELECT v_mentor, a.aluno_email, 'intervencao_comentario', p_id, jsonb_build_object('comentario_id', v_comentario_id)
  FROM public.mentoria_intervencao_alunos a
  WHERE a.intervencao_id = p_id;

  RETURN jsonb_build_object('comentario_id', v_comentario_id);
END;
$function$;

-- 13. Intervenções: cards criados no período (datas em America/Sao_Paulo) + medidor.
create or replace function public.mentor_intervencoes_listar(p_de date, p_ate date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_res jsonb;
BEGIN
  WITH base AS (
    SELECT i.id, i.tipo, i.titulo, i.nota, i.status, i.alvo, i.origem, i.origem_ref, i.criado_em,
           coalesce((SELECT array_agg(a.aluno_email ORDER BY a.aluno_email)
                     FROM public.mentoria_intervencao_alunos a WHERE a.intervencao_id = i.id), '{}'::text[]) AS alunos,
           (SELECT count(*) FROM public.mentoria_intervencao_alunos a WHERE a.intervencao_id = i.id)::int AS n_alunos,
           coalesce((SELECT jsonb_agg(jsonb_build_object('texto', c.texto, 'criado_em', c.criado_em) ORDER BY c.criado_em)
                     FROM public.mentoria_intervencao_comentarios c WHERE c.intervencao_id = i.id), '[]'::jsonb) AS comentarios
    FROM public.mentoria_intervencoes i
    WHERE i.mentor_id = v_mentor
      AND (p_de IS NULL OR (i.criado_em AT TIME ZONE 'America/Sao_Paulo')::date >= p_de)
      AND (p_ate IS NULL OR (i.criado_em AT TIME ZONE 'America/Sao_Paulo')::date <= p_ate)
  ), pesado AS (
    SELECT b.*,
           case when alvo = 'turma' or tipo = 'mensagem_mural' then 1 else greatest(n_alunos, 1) end AS peso
    FROM base b
  )
  SELECT jsonb_build_object(
    'cards', coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'tipo', p.tipo,
      'titulo', p.titulo,
      'nota', p.nota,
      'status', p.status,
      'alvo', p.alvo,
      'origem', p.origem,
      'origem_ref', p.origem_ref,
      'criado_em', p.criado_em,
      'alunos', to_jsonb(p.alunos),
      'comentarios', p.comentarios,
      'peso', p.peso
    ) ORDER BY p.criado_em DESC, p.id), '[]'::jsonb),
    'planejadas', coalesce(sum(p.peso), 0),
    'realizadas', coalesce(sum(p.peso) FILTER (WHERE p.status = 'feito'), 0)
  ) INTO v_res
  FROM pesado p;

  RETURN v_res;
END;
$function$;

-- Grants: só usuário autenticado; cada função valida o papel de mentor por dentro.
revoke all on function public.mentor_mural_salvar(uuid, text, text, text, text, text, text, text, text, text[], boolean, boolean) from public;
revoke execute on function public.mentor_mural_salvar(uuid, text, text, text, text, text, text, text, text, text[], boolean, boolean) from anon;
grant execute on function public.mentor_mural_salvar(uuid, text, text, text, text, text, text, text, text, text[], boolean, boolean) to authenticated;

revoke all on function public.mentor_mural_listar(text, text) from public;
revoke execute on function public.mentor_mural_listar(text, text) from anon;
grant execute on function public.mentor_mural_listar(text, text) to authenticated;

revoke all on function public.mentor_tags() from public;
revoke execute on function public.mentor_tags() from anon;
grant execute on function public.mentor_tags() to authenticated;

revoke all on function public.mentor_sessao_salvar(uuid, text, text, text, timestamptz, int, text, text) from public;
revoke execute on function public.mentor_sessao_salvar(uuid, text, text, text, timestamptz, int, text, text) from anon;
grant execute on function public.mentor_sessao_salvar(uuid, text, text, text, timestamptz, int, text, text) to authenticated;

revoke all on function public.mentor_sessao_marcar_feita(uuid, text) from public;
revoke execute on function public.mentor_sessao_marcar_feita(uuid, text) from anon;
grant execute on function public.mentor_sessao_marcar_feita(uuid, text) to authenticated;

revoke all on function public.mentor_sessoes_listar(text) from public;
revoke execute on function public.mentor_sessoes_listar(text) from anon;
grant execute on function public.mentor_sessoes_listar(text) to authenticated;

revoke all on function public.mentor_definir_link_agendamento(text) from public;
revoke execute on function public.mentor_definir_link_agendamento(text) from anon;
grant execute on function public.mentor_definir_link_agendamento(text) to authenticated;

revoke all on function public.mentor_agenda_liberar(text[], text) from public;
revoke execute on function public.mentor_agenda_liberar(text[], text) from anon;
grant execute on function public.mentor_agenda_liberar(text[], text) to authenticated;

revoke all on function public.mentor_agenda_desligar(text[]) from public;
revoke execute on function public.mentor_agenda_desligar(text[]) from anon;
grant execute on function public.mentor_agenda_desligar(text[]) to authenticated;

revoke all on function public.mentor_intervencao_criar(text, text, text, text, text[]) from public;
revoke execute on function public.mentor_intervencao_criar(text, text, text, text, text[]) from anon;
grant execute on function public.mentor_intervencao_criar(text, text, text, text, text[]) to authenticated;

revoke all on function public.mentor_intervencao_atualizar(uuid, text, text, text) from public;
revoke execute on function public.mentor_intervencao_atualizar(uuid, text, text, text) from anon;
grant execute on function public.mentor_intervencao_atualizar(uuid, text, text, text) to authenticated;

revoke all on function public.mentor_intervencao_comentar(uuid, text) from public;
revoke execute on function public.mentor_intervencao_comentar(uuid, text) from anon;
grant execute on function public.mentor_intervencao_comentar(uuid, text) to authenticated;

revoke all on function public.mentor_intervencoes_listar(date, date) from public;
revoke execute on function public.mentor_intervencoes_listar(date, date) from anon;
grant execute on function public.mentor_intervencoes_listar(date, date) to authenticated;
