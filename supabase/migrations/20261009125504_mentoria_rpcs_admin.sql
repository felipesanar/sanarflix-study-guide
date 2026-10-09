-- RPCs da Onda 1: cadastro de mentor, importação de alunos e contexto do mentor.

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

create or replace function public.admin_list_mentores()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'admin role required';
  end if;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', m.user_id,
      'nome', u.nome,
      'email', u.email,
      'tipo', m.tipo,
      'turma_nome', m.turma_nome,
      'ies_id', m.ies_id,
      'ies_nome', i.nome,
      'ativo', m.ativo,
      'alunos_ativos', (SELECT count(*) FROM public.mentoria_vinculos v
                        WHERE v.mentor_id = m.user_id AND v.fim IS NULL)
    ) ORDER BY u.nome)
    FROM public.mentores m
    JOIN public.users u ON u.id = m.user_id
    LEFT JOIN public.ies i ON i.id = m.ies_id
  ), '[]'::jsonb);
END;
$function$;

create or replace function public.admin_importar_vinculos(
  p_mentor_id uuid,
  p_linhas jsonb,
  p_trocar boolean default false,
  p_dry_run boolean default true
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_total int;
  v_novos int;
  v_ja int;
  v_conflitos jsonb;
  v_invalidos jsonb;
  v_inseridos int := 0;
  v_trocados int := 0;
BEGIN
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'admin role required';
  end if;

  IF NOT EXISTS (SELECT 1 FROM public.mentores WHERE user_id = p_mentor_id AND ativo) THEN
    RAISE EXCEPTION 'mentor % não existe ou está inativo', p_mentor_id;
  END IF;

  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array' THEN
    RAISE EXCEPTION 'p_linhas deve ser um array jsonb';
  END IF;

  -- Tabela declarada + TRUNCATE para a função ser reentrante na transação
  -- (mesmo padrão de admin_set_ies_simulados_previstos).
  CREATE TEMP TABLE IF NOT EXISTS _vinc_in (
    ordem int,
    email text,
    nome text,
    situacao text,
    mentor_atual uuid
  ) ON COMMIT DROP;
  TRUNCATE pg_temp._vinc_in;

  INSERT INTO pg_temp._vinc_in (ordem, email, nome)
  SELECT t.ordem::int,
         lower(btrim(COALESCE(t.linha->>'email', ''))),
         NULLIF(btrim(COALESCE(t.linha->>'nome', '')), '')
  FROM jsonb_array_elements(p_linhas) WITH ORDINALITY AS t(linha, ordem);

  v_total := (SELECT count(*) FROM pg_temp._vinc_in);

  UPDATE pg_temp._vinc_in SET situacao = 'email_invalido'
  WHERE email = '' OR email NOT LIKE '%_@_%.__%';

  UPDATE pg_temp._vinc_in a SET situacao = 'duplicado_na_planilha'
  WHERE a.situacao IS NULL
    AND EXISTS (SELECT 1 FROM pg_temp._vinc_in b
                WHERE b.email = a.email AND b.ordem < a.ordem);

  UPDATE pg_temp._vinc_in a
     SET situacao = CASE WHEN v.mentor_id = p_mentor_id THEN 'ja_com_este_mentor' ELSE 'com_outro_mentor' END,
         mentor_atual = v.mentor_id
  FROM public.mentoria_vinculos v
  WHERE a.situacao IS NULL AND v.fim IS NULL AND v.email_normalizado = a.email;

  UPDATE pg_temp._vinc_in SET situacao = 'novo' WHERE situacao IS NULL;

  v_novos := (SELECT count(*) FROM pg_temp._vinc_in WHERE situacao = 'novo');
  v_ja := (SELECT count(*) FROM pg_temp._vinc_in WHERE situacao = 'ja_com_este_mentor');

  v_conflitos := COALESCE((
    SELECT jsonb_agg(jsonb_build_object('email', a.email, 'mentor_atual_id', a.mentor_atual, 'mentor_atual_nome', u.nome) ORDER BY a.ordem)
    FROM pg_temp._vinc_in a LEFT JOIN public.users u ON u.id = a.mentor_atual
    WHERE a.situacao = 'com_outro_mentor'
  ), '[]'::jsonb);

  v_invalidos := COALESCE((
    SELECT jsonb_agg(jsonb_build_object('ordem', a.ordem, 'email', a.email, 'motivo', a.situacao) ORDER BY a.ordem)
    FROM pg_temp._vinc_in a
    WHERE a.situacao IN ('email_invalido', 'duplicado_na_planilha')
  ), '[]'::jsonb);

  if not p_dry_run then
    IF p_trocar THEN
      WITH fechados AS (
        update public.mentoria_vinculos v
           set fim = now()
        FROM pg_temp._vinc_in a
        WHERE a.situacao = 'com_outro_mentor'
          AND v.fim IS NULL
          AND v.email_normalizado = a.email
        RETURNING 1
      )
      SELECT count(*) INTO v_trocados FROM fechados;
    END IF;

    WITH ins AS (
      INSERT INTO public.mentoria_vinculos (mentor_id, email_normalizado, nome, sanarflix_user_id, academy_user_id, origem, created_by)
      SELECT p_mentor_id,
             a.email,
             COALESCE(a.nome, u.nome),
             (SELECT d.sanarflix_user_id FROM public.dim_aluno_b2b d
               WHERE d.email_normalizado = a.email
               ORDER BY (d.status_atual = 'ativo') DESC NULLS LAST
               LIMIT 1),
             u.id,
             'planilha',
             auth.uid()
      FROM pg_temp._vinc_in a
      LEFT JOIN public.users u ON lower(u.email) = a.email
      WHERE a.situacao = 'novo' OR (p_trocar AND a.situacao = 'com_outro_mentor')
      RETURNING 1
    )
    SELECT count(*) INTO v_inseridos FROM ins;

    insert into public.admin_audit_log(admin_id, action, metadata)
    values (auth.uid(), 'mentor_importar_vinculos', jsonb_build_object(
      'mentor_id', p_mentor_id, 'total', v_total, 'inseridos', v_inseridos,
      'trocados', v_trocados, 'trocar', p_trocar));
  end if;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'total', v_total,
    'novos', v_novos,
    'ja_com_este_mentor', v_ja,
    'com_outro_mentor', v_conflitos,
    'invalidos', v_invalidos,
    'inseridos', v_inseridos,
    'trocados', v_trocados
  );
END;
$function$;

create or replace function public.admin_encerrar_vinculo(p_vinculo_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_fim timestamptz;
BEGIN
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'admin role required';
  end if;

  UPDATE public.mentoria_vinculos SET fim = now()
  WHERE id = p_vinculo_id AND fim IS NULL
  RETURNING fim INTO v_fim;

  IF v_fim IS NULL THEN
    RAISE EXCEPTION 'vínculo % não existe ou já foi encerrado', p_vinculo_id;
  END IF;

  insert into public.admin_audit_log(admin_id, action, metadata)
  values (auth.uid(), 'mentor_encerrar_vinculo', jsonb_build_object('vinculo_id', p_vinculo_id));

  RETURN jsonb_build_object('vinculo_id', p_vinculo_id, 'fim', v_fim);
END;
$function$;

create or replace function public.get_mentor_contexto()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  SELECT jsonb_build_object(
    'user_id', m.user_id, 'nome', u.nome, 'email', u.email,
    'tipo', m.tipo, 'turma_nome', m.turma_nome,
    'ies_id', m.ies_id, 'ies_nome', i.nome, 'ativo', m.ativo)
  INTO v_mentor
  FROM public.mentores m
  JOIN public.users u ON u.id = m.user_id
  LEFT JOIN public.ies i ON i.id = m.ies_id
  where m.user_id = auth.uid();

  RETURN jsonb_build_object(
    'mentor', v_mentor,
    'alunos_ativos', (SELECT count(*) FROM public.mentoria_vinculos v
                      WHERE v.mentor_id = auth.uid() AND v.fim IS NULL)
  );
END;
$function$;

revoke all on function public.admin_upsert_mentor(uuid, text, text, uuid, text, text, text, boolean) from public;
revoke all on function public.admin_list_mentores() from public;
revoke all on function public.admin_importar_vinculos(uuid, jsonb, boolean, boolean) from public;
revoke all on function public.admin_encerrar_vinculo(uuid) from public;
revoke all on function public.get_mentor_contexto() from public;
grant execute on function public.admin_upsert_mentor(uuid, text, text, uuid, text, text, text, boolean) to authenticated;
grant execute on function public.admin_list_mentores() to authenticated;
grant execute on function public.admin_importar_vinculos(uuid, jsonb, boolean, boolean) to authenticated;
grant execute on function public.admin_encerrar_vinculo(uuid) to authenticated;
grant execute on function public.get_mentor_contexto() to authenticated;
