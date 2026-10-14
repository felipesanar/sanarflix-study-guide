-- Página do Mentor · Onda 2: funções que só a edge `mentoria-api` usa.
-- A edge autentica o Flix pela chave do Kong e chama estas funções com a
-- service role. Nenhum papel de cliente (anon/authenticated) executa nada aqui.
-- Mentor atual do aluno = vínculo sem `fim` para o e-mail normalizado, com
-- cadastro de mentor ativo.

create or replace function public.api_mentoria_me(p_email text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_email text := lower(btrim(p_email));
  v_mentor uuid;
  v_lib record;
  v_ficha record;
BEGIN
  SELECT m.user_id INTO v_mentor
  FROM public.mentoria_vinculos v
  JOIN public.mentores m ON m.user_id = v.mentor_id
  WHERE v.email_normalizado = v_email AND v.fim IS NULL AND m.ativo
  LIMIT 1;

  IF v_mentor IS NULL THEN
    RETURN jsonb_build_object(
      'tem_mentor', false,
      'mentor', NULL,
      'agendamento_liberado', false,
      'mensagem_liberacao', NULL);
  END IF;

  SELECT l.mensagem INTO v_lib
  FROM public.mentoria_agenda_liberacoes l
  WHERE l.mentor_id = v_mentor AND l.aluno_email = v_email AND l.ligado
  LIMIT 1;

  SELECT u.nome, m.foto_url, m.formacao, m.turma_nome, m.link_agendamento INTO v_ficha
  FROM public.mentores m
  LEFT JOIN public.users u ON u.id = m.user_id
  WHERE m.user_id = v_mentor;

  RETURN jsonb_build_object(
    'tem_mentor', true,
    'mentor', jsonb_build_object(
      'nome', v_ficha.nome,
      'foto_url', v_ficha.foto_url,
      'formacao', v_ficha.formacao,
      'turma_nome', v_ficha.turma_nome,
      'link_agendamento', CASE WHEN v_lib.mensagem IS NOT NULL THEN v_ficha.link_agendamento ELSE NULL END),
    'agendamento_liberado', v_lib.mensagem IS NOT NULL,
    'mensagem_liberacao', v_lib.mensagem);
END;
$function$;

create or replace function public.api_mentoria_mural(p_email text, p_aba text, p_cursor timestamptz)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_email text := lower(btrim(p_email));
  v_mentor uuid;
  v_itens jsonb;
  v_total int;
  v_proximo timestamptz;
  v_tem_pra_voce boolean;
BEGIN
  IF p_aba NOT IN ('coletivo', 'pra-voce') THEN
    RAISE EXCEPTION 'aba inválida: %', p_aba;
  END IF;

  SELECT m.user_id INTO v_mentor
  FROM public.mentoria_vinculos v
  JOIN public.mentores m ON m.user_id = v.mentor_id
  WHERE v.email_normalizado = v_email AND v.fim IS NULL AND m.ativo
  LIMIT 1;

  IF v_mentor IS NULL THEN
    RETURN jsonb_build_object('itens', '[]'::jsonb, 'proximo_cursor', NULL, 'tem_pra_voce', false);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.mural_posts p
    WHERE p.mentor_id = v_mentor AND p.status = 'publicado' AND p.publico = 'selecionados'
      AND EXISTS (SELECT 1 FROM public.mural_destinatarios d WHERE d.post_id = p.id AND d.aluno_email = v_email)
  ) INTO v_tem_pra_voce;

  -- Busca 21 para saber se há próxima página; devolve 20.
  WITH pagina AS (
    SELECT p.id, p.tag, p.titulo, p.mensagem, p.link_titulo, p.link_url,
           p.anexo_path, p.anexo_nome, p.publicado_em
    FROM public.mural_posts p
    WHERE p.mentor_id = v_mentor
      AND p.status = 'publicado'
      AND (p_cursor IS NULL OR p.publicado_em < p_cursor)
      AND (
        (p_aba = 'coletivo' AND p.publico = 'turma')
        OR (p_aba = 'pra-voce' AND p.publico = 'selecionados' AND EXISTS (
              SELECT 1 FROM public.mural_destinatarios d
              WHERE d.post_id = p.id AND d.aluno_email = v_email))
      )
    ORDER BY p.publicado_em DESC
    LIMIT 21
  ), numerada AS (
    SELECT pagina.*, row_number() OVER (ORDER BY pagina.publicado_em DESC) AS n FROM pagina
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id,
      'tag', n.tag,
      'titulo', n.titulo,
      'mensagem', n.mensagem,
      'link', CASE WHEN n.link_url IS NOT NULL
                   THEN jsonb_build_object('titulo', n.link_titulo, 'url', n.link_url) ELSE NULL END,
      'anexo_path', n.anexo_path,
      'anexo_nome', n.anexo_nome,
      'publicado_em', n.publicado_em) ORDER BY n.publicado_em DESC) FILTER (WHERE n.n <= 20), '[]'::jsonb),
    count(*),
    max(n.publicado_em) FILTER (WHERE n.n = 20)
  INTO v_itens, v_total, v_proximo
  FROM numerada n;

  RETURN jsonb_build_object(
    'itens', v_itens,
    'proximo_cursor', CASE WHEN v_total > 20 THEN v_proximo ELSE NULL END,
    'tem_pra_voce', v_tem_pra_voce);
END;
$function$;

create or replace function public.api_mentoria_sessoes(p_email text, p_quando text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_email text := lower(btrim(p_email));
  v_mentor uuid;
  v_itens jsonb;
BEGIN
  IF p_quando NOT IN ('proximas', 'realizadas') THEN
    RAISE EXCEPTION 'quando inválido: %', p_quando;
  END IF;

  IF p_quando = 'proximas' THEN
    SELECT m.user_id INTO v_mentor
    FROM public.mentoria_vinculos v
    JOIN public.mentores m ON m.user_id = v.mentor_id
    WHERE v.email_normalizado = v_email AND v.fim IS NULL AND m.ativo
    LIMIT 1;

    IF v_mentor IS NULL THEN
      RETURN jsonb_build_object('itens', '[]'::jsonb);
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'tipo', s.tipo,
      'titulo', s.titulo,
      'mentor_nome', u.nome,
      'inicio', s.inicio,
      'meet_link', s.meet_link,
      'gravacao_url', s.gravacao_url) ORDER BY s.inicio ASC), '[]'::jsonb)
    INTO v_itens
    FROM public.mentoria_sessoes s
    LEFT JOIN public.users u ON u.id = s.mentor_id
    WHERE s.mentor_id = v_mentor
      AND s.status = 'agendada'
      AND s.inicio >= now()
      AND (s.tipo = 'coletiva' OR (s.tipo = 'individual' AND s.aluno_email = v_email));
  ELSE
    -- Acervo: coletivas realizadas com gravação, de todos os mentores, mais o
    -- arquivo 2025 (sem mentor). Individuais nunca entram.
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id,
      'tipo', t.tipo,
      'titulo', t.titulo,
      'mentor_nome', t.nome,
      'inicio', t.inicio,
      'meet_link', NULL,
      'gravacao_url', t.gravacao_url) ORDER BY t.inicio DESC), '[]'::jsonb)
    INTO v_itens
    FROM (
      SELECT s.id, s.tipo, s.titulo, u.nome, s.inicio, s.gravacao_url
      FROM public.mentoria_sessoes s
      LEFT JOIN public.users u ON u.id = s.mentor_id
      WHERE s.tipo = 'coletiva'
        AND ((s.status = 'realizada' AND s.gravacao_url IS NOT NULL) OR s.origem = 'arquivo_2025')
      ORDER BY s.inicio DESC
      LIMIT 200
    ) t;
  END IF;

  RETURN jsonb_build_object('itens', v_itens);
END;
$function$;

-- Só a edge (service role) executa.
revoke all on function public.api_mentoria_me(text) from public;
revoke execute on function public.api_mentoria_me(text) from anon, authenticated;
revoke all on function public.api_mentoria_mural(text, text, timestamptz) from public;
revoke execute on function public.api_mentoria_mural(text, text, timestamptz) from anon, authenticated;
revoke all on function public.api_mentoria_sessoes(text, text) from public;
revoke execute on function public.api_mentoria_sessoes(text, text) from anon, authenticated;
