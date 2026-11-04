-- Página do Mentor · ajustes da revisão final (14/10).
-- ATENÇÃO ao aplicar: as três funções abaixo são recriadas a partir dos arquivos
-- versionados; conferir antes contra pg_get_functiondef em prod (o corpo gravado
-- pode divergir do .sql) e só então aplicar.

-- 1. Espelho B2C: nenhuma tabela é lida direto por cliente; só via RPCs
--    SECURITY DEFINER (e a edge, com service_role, que mantém o acesso).
revoke all on table public.b2c_simulados, public.b2c_questoes, public.b2c_alunos,
  public.b2c_tentativas, public.b2c_respostas, public.b2c_sync_execucoes
  from anon, authenticated;

-- 2. API: "próximas" mantém a sessão visível enquanto ela acontece
--    (início + duração >= agora), mesma regra de mentor_sessoes_listar.
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
      AND s.inicio + make_interval(mins => s.duracao_min) >= now()
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

revoke all on function public.api_mentoria_sessoes(text, text) from public;
revoke execute on function public.api_mentoria_sessoes(text, text) from anon, authenticated;

-- 3. Agenda: desligar também fecha o card "Agendamento liberado" aberto.
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
  ), cl AS (
    -- Fecha o card aberto que a própria liberação criou (origem_ref = agenda_liberacao + id da liberação).
    UPDATE public.mentoria_intervencoes i
    SET status = 'feito', concluido_em = coalesce(i.concluido_em, now()), atualizado_em = now()
    FROM d
    WHERE i.mentor_id = v_mentor
      AND i.origem = 'auto'
      AND i.origem_ref->>'kind' = 'agenda_liberacao'
      AND i.origem_ref->>'id' = d.id::text
      AND i.status <> 'feito'
    RETURNING i.id AS intervencao_id, d.aluno_email
  ), evc AS (
    INSERT INTO public.mentoria_eventos (mentor_id, aluno_email, tipo, intervencao_id, payload)
    SELECT v_mentor, cl.aluno_email, 'intervencao_status', cl.intervencao_id,
           jsonb_build_object('para', 'feito', 'motivo', 'agenda_desligada')
    FROM cl
    RETURNING 1
  )
  SELECT count(*)::int INTO v_n FROM d;

  RETURN jsonb_build_object('desligados', v_n);
END;
$function$;

revoke all on function public.mentor_agenda_desligar(text[]) from public;
revoke execute on function public.mentor_agenda_desligar(text[]) from anon;
grant execute on function public.mentor_agenda_desligar(text[]) to authenticated;

-- 4. Admin: link de agendamento e foto só aceitam https://.
create or replace function public.admin_upsert_mentor(
  p_user_id uuid,
  p_tipo text,
  p_turma_nome text,
  p_ies_id uuid default null,
  p_foto_url text default null,
  p_formacao text default null,
  p_link_agendamento text default null,
  p_ativo boolean default true
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_criado boolean;
BEGIN
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'admin role required';
  end if;

  IF NOT public.has_role(p_user_id, 'mentor'::app_role) THEN
    RAISE EXCEPTION 'usuário % não tem o papel mentor', p_user_id;
  END IF;

  IF p_tipo NOT IN ('b2c', 'b2b') THEN
    RAISE EXCEPTION 'tipo inválido: % (use b2c ou b2b)', p_tipo;
  END IF;

  IF p_tipo = 'b2b' AND p_ies_id IS NULL THEN
    RAISE EXCEPTION 'mentor B2B precisa de IES';
  END IF;

  IF p_tipo = 'b2b' AND p_ies_id IN ('9f21b138-0027-44c8-9660-dc6706d57bc0'::uuid, 'abec7c7d-ef07-4871-9e19-090f4d951e5e'::uuid) THEN
    RAISE EXCEPTION 'IES interna não pode ser a IES de um mentor B2B';
  END IF;

  IF coalesce(btrim(p_link_agendamento), '') <> '' AND btrim(p_link_agendamento) !~* '^https://[^\s]+$' THEN
    RAISE EXCEPTION 'link precisa começar com https://';
  END IF;

  IF coalesce(btrim(p_foto_url), '') <> '' AND btrim(p_foto_url) !~* '^https://[^\s]+$' THEN
    RAISE EXCEPTION 'link precisa começar com https://';
  END IF;

  INSERT INTO public.mentores (user_id, tipo, turma_nome, ies_id, foto_url, formacao, link_agendamento, ativo, created_by)
  VALUES (p_user_id, p_tipo, btrim(p_turma_nome), CASE WHEN p_tipo = 'b2b' THEN p_ies_id END,
          p_foto_url, p_formacao, p_link_agendamento, p_ativo, auth.uid())
  ON CONFLICT (user_id) DO UPDATE
    SET tipo = EXCLUDED.tipo,
        turma_nome = EXCLUDED.turma_nome,
        ies_id = EXCLUDED.ies_id,
        foto_url = EXCLUDED.foto_url,
        formacao = EXCLUDED.formacao,
        link_agendamento = EXCLUDED.link_agendamento,
        ativo = EXCLUDED.ativo,
        updated_at = now()
  RETURNING (xmax = 0) INTO v_criado;

  insert into public.admin_audit_log(admin_id, action, metadata)
  values (auth.uid(), 'mentor_upsert', jsonb_build_object(
    'mentor_id', p_user_id, 'tipo', p_tipo, 'turma_nome', p_turma_nome,
    'ies_id', p_ies_id, 'ativo', p_ativo, 'criado', v_criado));

  RETURN jsonb_build_object('user_id', p_user_id, 'criado', v_criado);
END;
$function$;

revoke all on function public.admin_upsert_mentor(uuid, text, text, uuid, text, text, text, boolean) from public;
revoke execute on function public.admin_upsert_mentor(uuid, text, text, uuid, text, text, text, boolean) from anon;
grant execute on function public.admin_upsert_mentor(uuid, text, text, uuid, text, text, text, boolean) to authenticated;

-- 5. Bucket de anexos do mural: mesmos limites do cliente (10 MB).
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/png','image/jpeg','image/webp','application/pdf']
where id = 'mural-anexos';
