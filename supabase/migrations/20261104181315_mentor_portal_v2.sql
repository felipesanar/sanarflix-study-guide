-- Portal do Mentor v2: Academy operacional enquanto a API Flix nao existe.
-- Bases: contexto 20261009125504; aluno 20261014170806; acoes 20261014171927;
-- API sessoes 20261014180542; API mural 20261014170827.
begin;

alter table public.mentores
  add column portal_mentor boolean not null default false,
  add column flix_mentor_id text unique;

create table public.mentoria_canais_gerais (
  tipo text primary key check (tipo in ('avisos', 'plantao')),
  nome text not null,
  url text check (url ~ '^https://[^[:space:]]+$')
);
-- URLs reais serao provisionadas pelo operador, nunca exemplos em producao.
insert into public.mentoria_canais_gerais (tipo, nome)
values ('avisos', 'Grupo de avisos'), ('plantao', 'Plantao de duvidas');
create table public.mentoria_canais (
  mentor_id uuid primary key references public.mentores(user_id) on delete restrict,
  url text not null check (url ~ '^https://chat\.whatsapp\.com/'),
  atualizado_em timestamptz not null default now()
);

alter table public.mural_posts
  add column editada_em timestamptz,
  add column excluida_em timestamptz,
  add column fixada boolean not null default false;
create unique index mural_posts_uma_fixada on public.mural_posts (mentor_id)
  where fixada and excluida_em is null;

alter table public.mentoria_sessoes drop constraint mentoria_sessoes_tipo_check;
UPDATE public.mentoria_sessoes SET tipo = 'encontro_tribo' WHERE tipo = 'coletiva';
alter table public.mentoria_sessoes
  add constraint mentoria_sessoes_tipo_check check (tipo in ('encontro_tribo', 'pos_simulado', 'oficina', 'individual')),
  add column pauta jsonb not null default '[]'::jsonb check (jsonb_typeof(pauta) = 'array'),
  add column descricao text;
-- P10: nao transformar cancelamentos historicos em sessoes agendadas/realizadas.
-- Se houver legado cancelado, o operador deve decidir seu destino antes de aplicar.
do $$ begin
  if exists (select 1 from public.mentoria_sessoes where status = 'cancelada') then
    raise exception 'validacao: existem sessoes canceladas legadas; revisar antes de aplicar Portal v2';
  end if;
end $$;
alter table public.mentoria_sessoes drop constraint mentoria_sessoes_status_check;
alter table public.mentoria_sessoes add constraint mentoria_sessoes_status_check check (status in ('agendada', 'realizada'));

alter table public.mentoria_intervencoes
  add column perfil text check (perfil in ('virada', 'baixo', 'bom'));
create index mentoria_intervencoes_referencia
  on public.mentoria_intervencoes (mentor_id, (origem_ref->>'kind'), (origem_ref->>'id'));
create index mentoria_eventos_card on public.mentoria_eventos (intervencao_id, criado_em, id);

create table public.mentoria_rotina_envios (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.mentores(user_id) on delete restrict,
  semana date not null check (extract(isodow from semana) = 1),
  dia text not null check (dia in ('ter', 'qui', 'sex')),
  tipo text not null check (tipo in ('enquete', 'resposta', 'perola')),
  conteudo text not null default '',
  enviado_em timestamptz,
  unique (mentor_id, semana, dia)
);
create table public.mentoria_sinalizacoes (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.mentores(user_id) on delete restrict,
  aluno_email text not null,
  motivo text not null check (length(btrim(motivo)) > 0),
  criado_em timestamptz not null default now(),
  comite_id uuid,
  -- Nao existe calendario de ciclos no Academy. O ciclo operacional e o vinculo
  -- ativo; nao usar ano/mes ou comite_id nullable para simular unicidade.
  ciclo_id uuid not null references public.mentoria_vinculos(id) on delete restrict,
  unique (mentor_id, aluno_email, ciclo_id)
);
create table public.mentoria_perolas (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.mentores(user_id) on delete restrict,
  texto text not null check (length(btrim(texto)) > 0),
  tema text,
  criado_em timestamptz not null default now()
);
alter table public.mentoria_canais_gerais enable row level security;
alter table public.mentoria_canais enable row level security;
alter table public.mentoria_rotina_envios enable row level security;
alter table public.mentoria_sinalizacoes enable row level security;
alter table public.mentoria_perolas enable row level security;
revoke all on table public.mentoria_canais_gerais, public.mentoria_canais,
  public.mentoria_rotina_envios, public.mentoria_sinalizacoes, public.mentoria_perolas from anon, authenticated;

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

create or replace function public.mentor_canais_listar()
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE v_mentor uuid := public.mentor_ativo_id();
BEGIN
  RETURN (SELECT jsonb_agg(jsonb_build_object('tipo', c.tipo, 'nome', c.nome, 'url', c.url, 'editavel', c.editavel) ORDER BY c.ordem)
    FROM (
      SELECT g.tipo, g.nome, g.url, false AS editavel, CASE g.tipo WHEN 'avisos' THEN 1 ELSE 2 END AS ordem
      FROM public.mentoria_canais_gerais g WHERE g.tipo IN ('avisos', 'plantao')
      UNION ALL
      SELECT 'grupo_tribo', 'Grupo da tribo', (SELECT url FROM public.mentoria_canais WHERE mentor_id = v_mentor), true, 3
    ) c);
END;
$function$;

create or replace function public.mentor_canal_grupo_salvar(p_url text)
 returns jsonb
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE v_mentor uuid := public.mentor_ativo_id();
BEGIN
  IF p_url IS NULL OR btrim(p_url) !~ '^https://chat\.whatsapp\.com/[^[:space:]]+$' THEN
    RAISE EXCEPTION 'validacao: use um link de convite https://chat.whatsapp.com/ do grupo da tribo';
  END IF;
  INSERT INTO public.mentoria_canais (mentor_id, url) VALUES (v_mentor, btrim(p_url))
  ON CONFLICT (mentor_id) DO UPDATE SET url = EXCLUDED.url, atualizado_em = now();
  RETURN jsonb_build_object('tipo', 'grupo_tribo', 'nome', 'Grupo da tribo', 'url', btrim(p_url), 'editavel', true);
END;
$function$;

create or replace function public.mentor_mural_salvar(
  p_id uuid, p_tag text, p_titulo text, p_mensagem text,
  p_link_titulo text, p_link_url text, p_anexo_path text, p_anexo_nome text,
  p_publico text, p_destinatarios text[], p_publicar boolean, p_registrar_intervencao boolean
)
 returns jsonb
 language plpgsql security definer
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
  v_link_url text := nullif(btrim(p_link_url), '');
  v_link_titulo text := nullif(btrim(p_link_titulo), '');
BEGIN
  IF coalesce(btrim(p_tag), '') = '' THEN RAISE EXCEPTION 'tag obrigatória'; END IF;
  IF length(btrim(p_tag)) > 40 THEN RAISE EXCEPTION 'tag com no máximo 40 caracteres'; END IF;
  IF coalesce(btrim(p_titulo), '') = '' THEN RAISE EXCEPTION 'título obrigatório'; END IF;
  IF coalesce(btrim(p_mensagem), '') = '' THEN RAISE EXCEPTION 'mensagem obrigatória'; END IF;
  IF p_publico IS NULL OR p_publico NOT IN ('turma', 'selecionados') THEN
    RAISE EXCEPTION 'público inválido: % (use turma ou selecionados)', p_publico;
  END IF;
  IF v_link_url IS NOT NULL AND v_link_url !~* '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'link inválido (use https)';
  END IF;
  IF v_link_url IS NOT NULL AND v_link_titulo IS NULL THEN RAISE EXCEPTION 'o link precisa de um título'; END IF;
  IF p_anexo_path IS NOT NULL AND p_anexo_path NOT LIKE v_mentor::text || '/%' THEN
    RAISE EXCEPTION 'anexo fora da pasta do mentor';
  END IF;
  IF p_publico = 'selecionados' THEN
    v_dest := public.mentor_exige_alunos(v_mentor, p_destinatarios);
    IF cardinality(v_dest) = 0 THEN RAISE EXCEPTION 'selecione ao menos um destinatário'; END IF;
  END IF;
  IF p_id IS NULL THEN
    v_status_antes := NULL;
    INSERT INTO public.mural_posts (mentor_id, tag, titulo, mensagem, link_titulo, link_url,
                                    anexo_path, anexo_nome, publico, status, publicado_em, origem)
    VALUES (v_mentor, btrim(p_tag), btrim(p_titulo), btrim(p_mensagem), v_link_titulo,
            v_link_url, p_anexo_path, p_anexo_nome, p_publico,
            CASE WHEN p_publicar THEN 'publicado' ELSE 'rascunho' END,
            CASE WHEN p_publicar THEN now() END, 'mentor')
    RETURNING id, status INTO v_post_id, v_status;
  ELSE
    SELECT status INTO v_status_antes FROM public.mural_posts
    WHERE id = p_id AND mentor_id = v_mentor AND excluida_em IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'post não encontrado'; END IF;
    UPDATE public.mural_posts
    SET tag = btrim(p_tag), titulo = btrim(p_titulo), mensagem = btrim(p_mensagem),
        link_titulo = v_link_titulo, link_url = v_link_url, anexo_path = p_anexo_path,
        anexo_nome = p_anexo_nome, publico = p_publico,
        status = CASE WHEN p_publicar THEN 'publicado' ELSE status END,
        publicado_em = CASE WHEN p_publicar THEN coalesce(publicado_em, now()) ELSE publicado_em END,
        editada_em = CASE WHEN v_status_antes = 'publicado' THEN now() ELSE editada_em END,
        updated_at = now()
    WHERE id = p_id AND mentor_id = v_mentor
    RETURNING id, status INTO v_post_id, v_status;
  END IF;
  DELETE FROM public.mural_destinatarios WHERE post_id = v_post_id;
  IF p_publico = 'selecionados' THEN
    INSERT INTO public.mural_destinatarios (post_id, aluno_email) SELECT v_post_id, e FROM unnest(v_dest) e;
  END IF;
  v_novo_publicado := p_publicar AND v_status_antes IS DISTINCT FROM 'publicado';
  IF v_novo_publicado THEN
    IF p_publico = 'turma' THEN
      SELECT coalesce(array_agg(v.email_normalizado ORDER BY v.email_normalizado), '{}') INTO v_emails
      FROM public.mentoria_vinculos v WHERE v.mentor_id = v_mentor AND v.fim IS NULL;
    ELSE v_emails := v_dest;
    END IF;
    IF p_registrar_intervencao THEN
      v_alvo := CASE WHEN p_publico = 'turma' THEN 'turma' WHEN cardinality(v_dest) = 1 THEN 'aluno' ELSE 'grupo' END;
      INSERT INTO public.mentoria_intervencoes (mentor_id, tipo, titulo, status, alvo, origem, origem_ref, concluido_em)
      VALUES (v_mentor, 'mensagem_mural', btrim(p_titulo), 'feito', v_alvo, 'auto',
              jsonb_build_object('kind', 'mural_post', 'id', v_post_id), now()) RETURNING id INTO v_interv_id;
      INSERT INTO public.mentoria_intervencao_alunos (intervencao_id, aluno_email)
      SELECT v_interv_id, e FROM unnest(v_emails) e;
    END IF;
    INSERT INTO public.mentoria_eventos (mentor_id, aluno_email, tipo, intervencao_id, payload)
    SELECT v_mentor, e, 'mural_publicado', v_interv_id, jsonb_build_object('post_id', v_post_id, 'tag', btrim(p_tag)) FROM unnest(v_emails) e;
  END IF;
  RETURN jsonb_build_object('post_id', v_post_id, 'publicado', v_status = 'publicado', 'intervencao_id', v_interv_id);
END;
$function$;

create or replace function public.mentor_mural_listar(p_aluno_email text default null, p_tag text default null)
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_aluno text;
BEGIN
  IF p_aluno_email IS NOT NULL AND btrim(p_aluno_email) <> '' THEN
    v_aluno := (public.mentor_exige_alunos(v_mentor, ARRAY[p_aluno_email]))[1];
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', p.id, 'tag', p.tag, 'titulo', p.titulo, 'mensagem', p.mensagem,
    'link_titulo', p.link_titulo, 'link_url', p.link_url, 'anexo_nome', p.anexo_nome,
    'anexo_path', p.anexo_path, 'publico', p.publico, 'status', p.status,
    'publicado_em', p.publicado_em, 'origem', p.origem, 'editada_em', p.editada_em, 'fixada', p.fixada,
    'destinatarios', coalesce((SELECT jsonb_agg(d.aluno_email ORDER BY d.aluno_email)
      FROM public.mural_destinatarios d WHERE d.post_id = p.id), '[]'::jsonb)
    ) ORDER BY coalesce(p.publicado_em, p.created_at) DESC, p.id)
    FROM public.mural_posts p
    WHERE p.mentor_id = v_mentor AND p.excluida_em IS NULL
      AND (p_tag IS NULL OR p.tag = p_tag)
      AND (v_aluno IS NULL OR p.publico = 'turma' OR EXISTS (
        SELECT 1 FROM public.mural_destinatarios d WHERE d.post_id = p.id AND d.aluno_email = v_aluno))), '[]'::jsonb);
END;
$function$;

create or replace function public.mentor_mural_excluir(p_id uuid)
 returns jsonb
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE v_mentor uuid := public.mentor_ativo_id();
BEGIN
  UPDATE public.mural_posts SET excluida_em = now(), fixada = false, updated_at = now()
  WHERE id = p_id AND mentor_id = v_mentor AND excluida_em IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'validacao: publicacao nao encontrada'; END IF;
  RETURN jsonb_build_object('id', p_id);
END;
$function$;

-- Uma unica assinatura com defaults preserva chamadas de oito argumentos e
-- evita sobrecarga ambigua no PostgREST. DROP sem CASCADE: dependencias abortam.
drop function public.mentor_sessao_salvar(uuid, text, text, text, timestamptz, int, text, text);
create or replace function public.mentor_sessao_salvar(
  p_id uuid, p_tipo text, p_titulo text, p_tema text, p_inicio timestamptz,
  p_duracao_min int, p_meet_link text, p_aluno_email text,
  p_pauta jsonb default null, p_descricao text default null
)
 returns jsonb
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_tipo text := CASE WHEN p_tipo = 'coletiva' THEN 'encontro_tribo' ELSE p_tipo END;
  v_aluno text;
  v_emails text[];
  v_sessao_id uuid;
  v_interv_id uuid;
  v_post_id uuid;
  v_mensagem text;
  v_meet text := nullif(btrim(p_meet_link), '');
  v_tema text := nullif(btrim(p_tema), '');
BEGIN
  IF coalesce(btrim(p_titulo), '') = '' THEN RAISE EXCEPTION 'título obrigatório'; END IF;
  IF p_inicio IS NULL THEN RAISE EXCEPTION 'data e hora obrigatórias'; END IF;
  IF p_duracao_min IS NOT NULL AND p_duracao_min NOT BETWEEN 5 AND 480 THEN
    RAISE EXCEPTION 'duração deve estar entre 5 e 480 minutos';
  END IF;
  IF v_meet IS NOT NULL AND v_meet !~* '^https://[^[:space:]]+$' THEN RAISE EXCEPTION 'link inválido (use https)'; END IF;
  IF p_pauta IS NOT NULL AND jsonb_typeof(p_pauta) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'validacao: pauta deve ser uma lista'; END IF;
  IF p_pauta <> '[]'::jsonb AND NOT EXISTS (SELECT 1 FROM public.mentores m WHERE m.user_id = v_mentor AND m.tipo = 'b2b') THEN
    RAISE EXCEPTION 'validacao: pauta disponivel somente para B2B';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_pauta) item
    WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR jsonb_typeof(item->'texto') IS DISTINCT FROM 'string' OR coalesce(btrim(item->>'texto'), '') = ''
      OR coalesce(item->>'origem', '') NOT IN ('tema_critico', 'mais_erradas', 'livre')
      OR jsonb_typeof(item->'ordem') IS DISTINCT FROM 'number' OR (item->>'ordem') !~ '^[0-9]+$'
      OR (item->>'origem' <> 'livre' AND coalesce(btrim(item->>'referenciaId'), '') = '')
      OR (item ? 'referenciaId' AND jsonb_typeof(item->'referenciaId') NOT IN ('string', 'null'))) THEN
    RAISE EXCEPTION 'validacao: item de pauta invalido (texto, origem, referenciaId e ordem)';
  END IF;
  IF p_id IS NOT NULL THEN
    SELECT s.tipo, s.aluno_email INTO v_tipo, v_aluno FROM public.mentoria_sessoes s
    WHERE s.id = p_id AND s.mentor_id = v_mentor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'sessão não encontrada'; END IF;
    IF v_aluno IS NOT NULL THEN PERFORM public.mentor_exige_alunos(v_mentor, ARRAY[v_aluno]); END IF;
    UPDATE public.mentoria_sessoes
    SET titulo = btrim(p_titulo), tema = v_tema, inicio = p_inicio,
        duracao_min = coalesce(p_duracao_min, duracao_min), meet_link = v_meet,
        pauta = coalesce(p_pauta, pauta),
        descricao = CASE WHEN p_descricao IS NULL THEN descricao ELSE nullif(btrim(p_descricao), '') END,
        updated_at = now()
    WHERE id = p_id AND mentor_id = v_mentor RETURNING id INTO v_sessao_id;
    UPDATE public.mentoria_intervencoes i SET titulo = btrim(p_titulo), atualizado_em = now()
    WHERE i.mentor_id = v_mentor AND i.origem_ref->>'kind' = 'sessao' AND i.origem_ref->>'id' = p_id::text
    RETURNING i.id, nullif(i.origem_ref->>'post_id', '')::uuid INTO v_interv_id, v_post_id;
    IF v_tipo <> 'individual' AND v_post_id IS NOT NULL THEN
      v_mensagem := 'Sessão coletiva em ' || to_char(p_inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
        || ' às ' || to_char(p_inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '.'
        || CASE WHEN v_tema IS NOT NULL THEN E'\nTema: ' || v_tema ELSE '' END;
      UPDATE public.mural_posts SET titulo = 'Sessão coletiva: ' || btrim(p_titulo), mensagem = v_mensagem,
        link_titulo = CASE WHEN v_meet IS NOT NULL THEN 'Entrar na sessão' END, link_url = v_meet,
        editada_em = CASE WHEN status = 'publicado' THEN now() ELSE editada_em END, updated_at = now()
      WHERE id = v_post_id AND mentor_id = v_mentor AND excluida_em IS NULL;
    END IF;
    RETURN jsonb_build_object('sessao_id', v_sessao_id, 'intervencao_id', v_interv_id, 'post_id', v_post_id);
  END IF;
  IF v_tipo IS NULL OR v_tipo NOT IN ('encontro_tribo', 'pos_simulado', 'oficina', 'individual') THEN
    RAISE EXCEPTION 'tipo de sessão inválido: %', p_tipo;
  END IF;
  IF v_tipo = 'individual' THEN
    IF coalesce(btrim(p_aluno_email), '') = '' THEN RAISE EXCEPTION 'sessão individual exige um aluno'; END IF;
    v_aluno := (public.mentor_exige_alunos(v_mentor, ARRAY[p_aluno_email]))[1];
  END IF;
  INSERT INTO public.mentoria_sessoes (mentor_id, tipo, titulo, tema, inicio, duracao_min, meet_link,
    aluno_email, status, origem, created_by, pauta, descricao)
  VALUES (v_mentor, v_tipo, btrim(p_titulo), v_tema, p_inicio, coalesce(p_duracao_min, 60),
    v_meet, v_aluno, 'agendada', 'academy', v_mentor, coalesce(p_pauta, '[]'::jsonb), nullif(btrim(p_descricao), ''))
  RETURNING id INTO v_sessao_id;
  IF v_tipo <> 'individual' THEN
    v_mensagem := 'Sessão coletiva em ' || to_char(p_inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
      || ' às ' || to_char(p_inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '.'
      || CASE WHEN v_tema IS NOT NULL THEN E'\nTema: ' || v_tema ELSE '' END;
    INSERT INTO public.mural_posts (mentor_id, tag, titulo, mensagem, link_titulo, link_url, publico, status, publicado_em, origem)
    VALUES (v_mentor, 'Aviso', 'Sessão coletiva: ' || btrim(p_titulo), v_mensagem,
      CASE WHEN v_meet IS NOT NULL THEN 'Entrar na sessão' END, v_meet, 'turma', 'publicado', now(), 'sessao_coletiva')
    RETURNING id INTO v_post_id;
    SELECT coalesce(array_agg(v.email_normalizado ORDER BY v.email_normalizado), '{}') INTO v_emails
    FROM public.mentoria_vinculos v WHERE v.mentor_id = v_mentor AND v.fim IS NULL;
    INSERT INTO public.mentoria_intervencoes (mentor_id, tipo, titulo, status, alvo, origem, origem_ref)
    VALUES (v_mentor, 'reuniao_coletiva', btrim(p_titulo), 'a_fazer', 'turma', 'auto',
      jsonb_build_object('kind', 'sessao', 'id', v_sessao_id, 'post_id', v_post_id)) RETURNING id INTO v_interv_id;
  ELSE
    v_emails := ARRAY[v_aluno];
    INSERT INTO public.mentoria_intervencoes (mentor_id, tipo, titulo, status, alvo, origem, origem_ref)
    VALUES (v_mentor, 'reuniao_individual', btrim(p_titulo), 'a_fazer', 'aluno', 'auto',
      jsonb_build_object('kind', 'sessao', 'id', v_sessao_id)) RETURNING id INTO v_interv_id;
  END IF;
  INSERT INTO public.mentoria_intervencao_alunos (intervencao_id, aluno_email) SELECT v_interv_id, e FROM unnest(v_emails) e;
  INSERT INTO public.mentoria_eventos (mentor_id, aluno_email, tipo, intervencao_id, payload)
  SELECT v_mentor, e, 'sessao_criada', v_interv_id, jsonb_build_object('sessao_id', v_sessao_id, 'tipo', v_tipo, 'inicio', p_inicio)
  FROM unnest(v_emails) e;
  RETURN jsonb_build_object('sessao_id', v_sessao_id, 'intervencao_id', v_interv_id, 'post_id', v_post_id);
END;
$function$;

create or replace function public.mentor_sessao_excluir(p_id uuid)
 returns jsonb
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_sessao public.mentoria_sessoes%rowtype;
BEGIN
  SELECT s.* INTO v_sessao FROM public.mentoria_sessoes s WHERE s.id = p_id AND s.mentor_id = v_mentor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'validacao: sessao nao encontrada'; END IF;
  IF v_sessao.status <> 'agendada' OR v_sessao.inicio <= now() THEN
    RAISE EXCEPTION 'validacao: somente sessao futura e agendada pode ser excluida';
  END IF;
  IF v_sessao.aluno_email IS NOT NULL THEN PERFORM public.mentor_exige_alunos(v_mentor, ARRAY[v_sessao.aluno_email]); END IF;
  -- Retira o anuncio, mas preserva card e log; nao conta exclusao como realizado.
  UPDATE public.mural_posts p SET excluida_em = now(), fixada = false, updated_at = now()
  FROM public.mentoria_intervencoes i WHERE i.mentor_id = v_mentor
    AND i.origem_ref->>'kind' = 'sessao' AND i.origem_ref->>'id' = p_id::text
    AND p.id::text = i.origem_ref->>'post_id' AND p.mentor_id = v_mentor AND p.excluida_em IS NULL;
  INSERT INTO public.mentoria_eventos (mentor_id, tipo, intervencao_id, payload)
  SELECT v_mentor, 'sessao_excluida', i.id, jsonb_build_object('sessao_id', p_id)
  FROM public.mentoria_intervencoes i WHERE i.mentor_id = v_mentor
    AND i.origem_ref->>'kind' = 'sessao' AND i.origem_ref->>'id' = p_id::text;
  DELETE FROM public.mentoria_sessoes WHERE id = p_id AND mentor_id = v_mentor;
  RETURN jsonb_build_object('id', p_id);
END;
$function$;

create or replace function public.mentor_sessoes_listar(p_quando text)
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE v_mentor uuid := public.mentor_ativo_id();
BEGIN
  IF p_quando IS NULL OR p_quando NOT IN ('proximas', 'realizadas', 'todas') THEN
    RAISE EXCEPTION 'filtro inválido: % (use proximas, realizadas ou todas)', p_quando;
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
      ELSE s.mentor_id = v_mentor OR s.origem = 'arquivo_2025' END), '[]'::jsonb);
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
    'alunoNome', coalesce(v.nome, u.nome), 'mensagem', l.mensagem, 'desde', l.desde) ORDER BY l.desde DESC, l.id)
    FROM public.mentoria_agenda_liberacoes l
    JOIN public.mentoria_vinculos v ON v.mentor_id = l.mentor_id AND v.email_normalizado = l.aluno_email AND v.fim IS NULL
    LEFT JOIN public.users u ON u.id = v.academy_user_id
    WHERE l.mentor_id = v_mentor AND l.ligado), '[]'::jsonb);
END;
$function$;

-- Contrato SQL do adaptador Flix: {tipo, referencia_id, titulo?, alunos?:email[],
-- turma_toda?:boolean, tipo_sessao?, perfil?, origem?, intervencao_id?, status?}.
-- referencia_id = id da publicacao/sessao/convite; para status/whatsapp, id unico
-- da ocorrencia (nao o id do aluno/card). Uma referencia de sessao aceita criada
-- e realizada separadamente. Nunca chamar esta porta apos escrita Academy.
create or replace function public.registrar_evento_mentor(p_evento jsonb)
 returns jsonb
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_evento text := p_evento->>'tipo';
  v_ref text := nullif(btrim(p_evento->>'referencia_id'), '');
  v_kind text;
  v_tipo text;
  v_status text := 'a_fazer';
  v_emails text[];
  v_card uuid;
  v_alvo text;
  v_titulo text := nullif(btrim(p_evento->>'titulo'), '');
  v_perfil text := p_evento->>'perfil';
  v_turma boolean := coalesce((p_evento->>'turma_toda')::boolean, false);
BEGIN
  IF jsonb_typeof(p_evento) IS DISTINCT FROM 'object' OR v_ref IS NULL THEN
    RAISE EXCEPTION 'validacao: evento exige objeto e referencia_id';
  END IF;
  IF v_evento IS NULL OR v_evento NOT IN ('mural_publicado', 'agenda_liberada', 'sessao_criada', 'sessao_realizada',
    'intervencao_tema', 'intervencao_aluno', 'whatsapp', 'status_alterado') THEN
    RAISE EXCEPTION 'validacao: tipo de evento invalido';
  END IF;
  -- Serializa inclusive o caso ainda sem card, sem depender de SELECT inexistente.
  PERFORM 1 FROM public.mentores WHERE user_id = v_mentor FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.mentoria_eventos e WHERE e.mentor_id = v_mentor
    AND e.tipo = v_evento AND e.payload->>'referencia_id' = v_ref AND e.payload->>'fonte' = 'flix') THEN
    RETURN jsonb_build_object('duplicado', true);
  END IF;
  IF p_evento ? 'alunos' AND jsonb_typeof(p_evento->'alunos') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'validacao: alunos deve ser uma lista de emails';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_evento->'alunos', '[]'::jsonb)) a WHERE jsonb_typeof(a) <> 'string') THEN
    RAISE EXCEPTION 'validacao: alunos deve conter emails';
  END IF;
  SELECT coalesce(array_agg(e), '{}') INTO v_emails
  FROM jsonb_array_elements_text(coalesce(p_evento->'alunos', '[]'::jsonb)) e;
  v_emails := public.mentor_exige_alunos(v_mentor, v_emails);
  IF v_turma THEN
    SELECT coalesce(array_agg(v.email_normalizado ORDER BY v.email_normalizado), '{}') INTO v_emails
    FROM public.mentoria_vinculos v WHERE v.mentor_id = v_mentor AND v.fim IS NULL;
  END IF;
  IF v_perfil IS NOT NULL AND (v_perfil NOT IN ('virada', 'baixo', 'bom') OR NOT EXISTS (
    SELECT 1 FROM public.mentores m WHERE m.user_id = v_mentor AND m.tipo = 'b2b')) THEN
    RAISE EXCEPTION 'validacao: perfil B2B invalido';
  END IF;
  v_kind := CASE v_evento
    WHEN 'mural_publicado' THEN 'mural_post' WHEN 'agenda_liberada' THEN 'agenda_liberacao'
    WHEN 'sessao_criada' THEN 'sessao' WHEN 'sessao_realizada' THEN 'sessao'
    ELSE coalesce(p_evento->>'origem', v_evento) END;
  IF v_evento IN ('sessao_criada', 'sessao_realizada') THEN
    v_tipo := CASE WHEN p_evento->>'tipo_sessao' = 'individual' THEN 'reuniao_individual' ELSE 'reuniao_coletiva' END;
  ELSIF v_evento IN ('agenda_liberada', 'intervencao_aluno') THEN v_tipo := 'reuniao_individual';
  ELSIF v_evento = 'mural_publicado' THEN v_tipo := 'mensagem_mural';
  ELSIF v_evento = 'intervencao_tema' THEN v_tipo := 'reuniao_coletiva';
  END IF;
  IF v_evento = 'intervencao_tema' AND coalesce(p_evento->>'origem', '') NOT IN ('tema_critico', 'questao') THEN
    RAISE EXCEPTION 'validacao: origem deve ser tema_critico ou questao';
  END IF;
  IF v_evento IN ('mural_publicado', 'sessao_realizada') THEN v_status := 'feito'; END IF;
  IF v_evento = 'status_alterado' THEN
    v_card := (p_evento->>'intervencao_id')::uuid;
    v_status := CASE p_evento->>'status' WHEN 'afazer' THEN 'a_fazer' WHEN 'andamento' THEN 'em_andamento' ELSE p_evento->>'status' END;
    IF v_status IS NULL OR v_status NOT IN ('a_fazer', 'em_andamento', 'feito') THEN RAISE EXCEPTION 'validacao: status invalido'; END IF;
    PERFORM 1 FROM public.mentoria_intervencoes i WHERE i.id = v_card AND i.mentor_id = v_mentor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'validacao: intervencao nao encontrada'; END IF;
    SELECT coalesce(array_agg(a.aluno_email), '{}') INTO v_emails
    FROM public.mentoria_intervencao_alunos a WHERE a.intervencao_id = v_card;
    v_emails := public.mentor_exige_alunos(v_mentor, v_emails);
    UPDATE public.mentoria_intervencoes SET status = v_status,
      concluido_em = CASE WHEN v_status = 'feito' THEN coalesce(concluido_em, now()) END, atualizado_em = now()
    WHERE id = v_card AND mentor_id = v_mentor;
  ELSIF v_evento = 'whatsapp' THEN
    IF cardinality(v_emails) = 0 THEN RAISE EXCEPTION 'validacao: informe o aluno'; END IF;
  ELSE
    SELECT i.id INTO v_card FROM public.mentoria_intervencoes i
    WHERE i.mentor_id = v_mentor AND i.origem_ref->>'kind' = v_kind AND i.origem_ref->>'id' = v_ref
    ORDER BY i.criado_em, i.id LIMIT 1 FOR UPDATE;
    IF v_evento = 'sessao_realizada' AND v_card IS NOT NULL THEN
      SELECT coalesce(array_agg(a.aluno_email), '{}') INTO v_emails FROM public.mentoria_intervencao_alunos a WHERE a.intervencao_id = v_card;
      v_emails := public.mentor_exige_alunos(v_mentor, v_emails);
      UPDATE public.mentoria_intervencoes SET status = 'feito', concluido_em = coalesce(concluido_em, now()), atualizado_em = now()
      WHERE id = v_card AND mentor_id = v_mentor;
    ELSIF v_card IS NULL AND (v_evento <> 'mural_publicado' OR coalesce((p_evento->>'registrar_intervencao')::boolean, false)) THEN
      IF v_evento IN ('sessao_criada', 'sessao_realizada')
        AND coalesce(p_evento->>'tipo_sessao', '') NOT IN ('encontro_tribo', 'pos_simulado', 'oficina', 'individual') THEN
        RAISE EXCEPTION 'validacao: informe o tipo_sessao para criar o card';
      END IF;
      IF v_tipo = 'reuniao_individual' AND cardinality(v_emails) <> 1 THEN
        RAISE EXCEPTION 'validacao: intervencao individual exige um aluno ativo';
      END IF;
      IF NOT v_turma AND cardinality(v_emails) = 0 THEN RAISE EXCEPTION 'validacao: informe os alunos ou turma_toda'; END IF;
      v_alvo := CASE WHEN v_turma THEN 'turma' WHEN cardinality(v_emails) = 1 THEN 'aluno' ELSE 'grupo' END;
      INSERT INTO public.mentoria_intervencoes (mentor_id, tipo, titulo, nota, status, alvo, origem, origem_ref, perfil, concluido_em)
      VALUES (v_mentor, v_tipo, coalesce(v_titulo, CASE v_evento WHEN 'sessao_realizada' THEN 'Sessao realizada'
        WHEN 'agenda_liberada' THEN 'Agendamento liberado' ELSE 'Intervencao' END), p_evento->>'nota', v_status, v_alvo,
        CASE WHEN v_evento IN ('intervencao_aluno', 'intervencao_tema') THEN 'manual' ELSE 'auto' END,
        jsonb_build_object('kind', v_kind, 'id', v_ref, 'fonte', 'flix'), v_perfil,
        CASE WHEN v_status = 'feito' THEN now() END) RETURNING id INTO v_card;
      INSERT INTO public.mentoria_intervencao_alunos (intervencao_id, aluno_email) SELECT v_card, e FROM unnest(v_emails) e;
    END IF;
  END IF;
  -- Uma ocorrencia sem alunos ainda grava log: deduplicacao funciona em turma vazia.
  INSERT INTO public.mentoria_eventos (mentor_id, aluno_email, tipo, intervencao_id, payload)
  SELECT v_mentor, e.email, v_evento, v_card,
    p_evento || jsonb_build_object('referencia_id', v_ref, 'fonte', 'flix')
  FROM (SELECT unnest(v_emails) AS email UNION ALL SELECT NULL::text WHERE cardinality(v_emails) = 0) e;
  RETURN jsonb_build_object('intervencao_id', v_card, 'duplicado', false);
END;
$function$;

-- Cria somente os slots semanais; nao inventa conteudo pedagogico.
create or replace function public.mentor_rotina_listar(p_semana date)
 returns jsonb
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE v_mentor uuid := public.mentor_ativo_id();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mentores m WHERE m.user_id = v_mentor AND m.tipo = 'b2b') THEN RAISE EXCEPTION 'validacao: rotina somente B2B'; END IF;
  IF p_semana IS NULL OR extract(isodow from p_semana) <> 1 THEN RAISE EXCEPTION 'validacao: semana deve ser segunda-feira'; END IF;
  INSERT INTO public.mentoria_rotina_envios (mentor_id, semana, dia, tipo)
  VALUES (v_mentor, p_semana, 'ter', 'enquete'), (v_mentor, p_semana, 'qui', 'resposta'), (v_mentor, p_semana, 'sex', 'perola')
  ON CONFLICT (mentor_id, semana, dia) DO NOTHING;
  RETURN (SELECT jsonb_agg(jsonb_build_object('id', r.id, 'semana', r.semana, 'dia', r.dia, 'tipo', r.tipo,
    'conteudo', r.conteudo, 'enviado_em', r.enviado_em) ORDER BY CASE r.dia WHEN 'ter' THEN 1 WHEN 'qui' THEN 2 ELSE 3 END)
    FROM public.mentoria_rotina_envios r WHERE r.mentor_id = v_mentor AND r.semana = p_semana);
END;
$function$;

create or replace function public.mentor_rotina_marcar_enviado(p_id uuid)
 returns jsonb
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_em timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mentores m WHERE m.user_id = v_mentor AND m.tipo = 'b2b') THEN RAISE EXCEPTION 'validacao: rotina somente B2B'; END IF;
  UPDATE public.mentoria_rotina_envios SET enviado_em = coalesce(enviado_em, now())
  WHERE id = p_id AND mentor_id = v_mentor RETURNING enviado_em INTO v_em;
  IF NOT FOUND THEN RAISE EXCEPTION 'validacao: envio nao encontrado'; END IF;
  RETURN jsonb_build_object('id', p_id, 'enviado_em', v_em);
END;
$function$;

create or replace function public.mentor_sinalizar_ies(p_email text, p_motivo text)
 returns jsonb
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_email text;
  v_ciclo uuid;
  v_id uuid;
  v_em timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mentores m WHERE m.user_id = v_mentor AND m.tipo = 'b2b') THEN RAISE EXCEPTION 'validacao: sinalizacao somente B2B'; END IF;
  IF coalesce(btrim(p_email), '') = '' OR coalesce(btrim(p_motivo), '') = '' THEN RAISE EXCEPTION 'validacao: aluno e motivo obrigatorios'; END IF;
  v_email := (public.mentor_exige_alunos(v_mentor, ARRAY[p_email]))[1];
  SELECT v.id INTO v_ciclo FROM public.mentoria_vinculos v
  WHERE v.mentor_id = v_mentor AND v.email_normalizado = v_email AND v.fim IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'validacao: vinculo encerrado'; END IF;
  INSERT INTO public.mentoria_sinalizacoes (mentor_id, aluno_email, motivo, ciclo_id)
  VALUES (v_mentor, v_email, btrim(p_motivo), v_ciclo)
  ON CONFLICT (mentor_id, aluno_email, ciclo_id) DO NOTHING RETURNING id, criado_em INTO v_id, v_em;
  IF v_id IS NULL THEN RAISE EXCEPTION 'validacao: aluno ja sinalizado neste ciclo'; END IF;
  INSERT INTO public.mentoria_eventos (mentor_id, aluno_email, tipo, payload)
  VALUES (v_mentor, v_email, 'sinalizacao_ies', jsonb_build_object('sinalizacao_id', v_id, 'motivo', btrim(p_motivo)));
  RETURN jsonb_build_object('id', v_id, 'sinalizado_em', v_em);
END;
$function$;

create or replace function public.mentor_perolas_listar()
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE v_mentor uuid := public.mentor_ativo_id();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mentores m WHERE m.user_id = v_mentor AND m.tipo = 'b2b') THEN RAISE EXCEPTION 'validacao: perolas somente B2B'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'texto', p.texto, 'tema', p.tema, 'criado_em', p.criado_em)
    ORDER BY p.criado_em DESC, p.id) FROM public.mentoria_perolas p WHERE p.mentor_id = v_mentor), '[]'::jsonb);
END;
$function$;

create or replace function public.mentor_perola_salvar(p_texto text, p_tema text)
 returns jsonb
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mentores m WHERE m.user_id = v_mentor AND m.tipo = 'b2b') THEN RAISE EXCEPTION 'validacao: perolas somente B2B'; END IF;
  IF coalesce(btrim(p_texto), '') = '' THEN RAISE EXCEPTION 'validacao: texto obrigatorio'; END IF;
  INSERT INTO public.mentoria_perolas (mentor_id, texto, tema) VALUES (v_mentor, btrim(p_texto), nullif(btrim(p_tema), '')) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END;
$function$;

create or replace function public.mentor_aluno(p_email text)
 returns jsonb
 language plpgsql stable security definer
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
            ORDER BY e0.criado_em DESC LIMIT 50) e), '[]'::jsonb),
    'sinalizado_em', (SELECT s.criado_em FROM public.mentoria_sinalizacoes s
      JOIN public.mentoria_vinculos v ON v.id = s.ciclo_id AND v.fim IS NULL
      WHERE s.mentor_id = v_mentor AND s.aluno_email = v_email ORDER BY s.criado_em DESC LIMIT 1)
  );
END;
$function$;

create or replace function public.mentor_intervencoes_listar(p_de date, p_ate date)
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_res jsonb;
BEGIN
  WITH base AS (
    SELECT i.id, i.tipo, i.titulo, i.nota, i.status, i.alvo, i.origem, i.origem_ref, i.criado_em, i.perfil,
           coalesce((SELECT array_agg(a.aluno_email ORDER BY a.aluno_email)
                     FROM public.mentoria_intervencao_alunos a WHERE a.intervencao_id = i.id), '{}'::text[]) AS alunos,
           (SELECT count(*) FROM public.mentoria_intervencao_alunos a WHERE a.intervencao_id = i.id)::int AS n_alunos,
           coalesce((SELECT jsonb_agg(jsonb_build_object('texto', c.texto, 'criado_em', c.criado_em) ORDER BY c.criado_em)
                     FROM public.mentoria_intervencao_comentarios c WHERE c.intervencao_id = i.id), '[]'::jsonb) AS comentarios,
           coalesce((SELECT jsonb_agg(jsonb_build_object('em', e.criado_em, 'tipo', e.tipo, 'payload', e.payload,
                       'texto', coalesce(e.payload->>'texto', e.tipo)) ORDER BY e.criado_em, e.id)
                     FROM public.mentoria_eventos e WHERE e.mentor_id = v_mentor AND e.intervencao_id = i.id), '[]'::jsonb) AS historico
    FROM public.mentoria_intervencoes i
    WHERE i.mentor_id = v_mentor
      AND (p_de IS NULL OR (i.criado_em AT TIME ZONE 'America/Sao_Paulo')::date >= p_de)
      AND (p_ate IS NULL OR (i.criado_em AT TIME ZONE 'America/Sao_Paulo')::date <= p_ate)
  ), pesado AS (
    SELECT b.*, case when alvo = 'turma' or tipo = 'mensagem_mural' then 1 else greatest(n_alunos, 1) end AS peso FROM base b
  )
  SELECT jsonb_build_object(
    'cards', coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'tipo', p.tipo, 'titulo', p.titulo, 'nota', p.nota, 'status', p.status,
      'alvo', p.alvo, 'origem', p.origem, 'origem_ref', p.origem_ref, 'criado_em', p.criado_em,
      'alunos', to_jsonb(p.alunos), 'comentarios', p.comentarios, 'peso', p.peso,
      'historico', p.historico, 'perfil', p.perfil
    ) ORDER BY p.criado_em DESC, p.id), '[]'::jsonb),
    'planejadas', coalesce(sum(p.peso), 0), 'realizadas', coalesce(sum(p.peso) FILTER (WHERE p.status = 'feito'), 0)
  ) INTO v_res FROM pesado p;
  RETURN v_res;
END;
$function$;

-- API existente da edge: preserva autenticacao service-only e paginacao.
-- Nao usa mentor_ativo_id: quem chama e a edge com service_role, nao o mentor.
create or replace function public.api_mentoria_mural(p_email text, p_aba text, p_cursor timestamptz)
 returns jsonb
 language plpgsql stable security definer
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
  IF p_aba NOT IN ('coletivo', 'pra-voce') THEN RAISE EXCEPTION 'aba inválida: %', p_aba; END IF;
  SELECT m.user_id INTO v_mentor
  FROM public.mentoria_vinculos v JOIN public.mentores m ON m.user_id = v.mentor_id
  WHERE v.email_normalizado = v_email AND v.fim IS NULL AND m.ativo LIMIT 1;
  IF v_mentor IS NULL THEN
    RETURN jsonb_build_object('itens', '[]'::jsonb, 'proximo_cursor', NULL, 'tem_pra_voce', false);
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.mural_posts p
    WHERE p.mentor_id = v_mentor AND p.status = 'publicado' AND p.publico = 'selecionados' AND p.excluida_em IS NULL
      AND EXISTS (SELECT 1 FROM public.mural_destinatarios d WHERE d.post_id = p.id AND d.aluno_email = v_email)) INTO v_tem_pra_voce;
  WITH pagina AS (
    SELECT p.id, p.tag, p.titulo, p.mensagem, p.link_titulo, p.link_url,
           p.anexo_path, p.anexo_nome, p.publicado_em, p.editada_em, p.fixada
    FROM public.mural_posts p
    WHERE p.mentor_id = v_mentor AND p.excluida_em IS NULL
      AND p.status = 'publicado' AND (p_cursor IS NULL OR p.publicado_em < p_cursor)
      AND ((p_aba = 'coletivo' AND p.publico = 'turma')
        OR (p_aba = 'pra-voce' AND p.publico = 'selecionados' AND EXISTS (
          SELECT 1 FROM public.mural_destinatarios d WHERE d.post_id = p.id AND d.aluno_email = v_email)))
    ORDER BY p.publicado_em DESC LIMIT 21
  ), numerada AS (
    SELECT pagina.*, row_number() OVER (ORDER BY pagina.publicado_em DESC) AS n FROM pagina
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'tag', n.tag, 'titulo', n.titulo, 'mensagem', n.mensagem,
    'link', CASE WHEN n.link_url IS NOT NULL THEN jsonb_build_object('titulo', n.link_titulo, 'url', n.link_url) ELSE NULL END,
    'anexo_path', n.anexo_path, 'anexo_nome', n.anexo_nome, 'publicado_em', n.publicado_em,
    'editada_em', n.editada_em, 'fixada', n.fixada
    ) ORDER BY n.publicado_em DESC) FILTER (WHERE n.n <= 20), '[]'::jsonb),
    count(*), max(n.publicado_em) FILTER (WHERE n.n = 20)
  INTO v_itens, v_total, v_proximo FROM numerada n;
  RETURN jsonb_build_object('itens', v_itens,
    'proximo_cursor', CASE WHEN v_total > 20 THEN v_proximo ELSE NULL END, 'tem_pra_voce', v_tem_pra_voce);
END;
$function$;

-- Corpo vigente de 20261014180542: apenas o predicado coletiva e ampliado.
create or replace function public.api_mentoria_sessoes(p_email text, p_quando text)
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_email text := lower(btrim(p_email));
  v_mentor uuid;
  v_itens jsonb;
BEGIN
  IF p_quando NOT IN ('proximas', 'realizadas') THEN RAISE EXCEPTION 'quando inválido: %', p_quando; END IF;
  IF p_quando = 'proximas' THEN
    SELECT m.user_id INTO v_mentor
    FROM public.mentoria_vinculos v JOIN public.mentores m ON m.user_id = v.mentor_id
    WHERE v.email_normalizado = v_email AND v.fim IS NULL AND m.ativo LIMIT 1;
    IF v_mentor IS NULL THEN RETURN jsonb_build_object('itens', '[]'::jsonb); END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'tipo', s.tipo, 'titulo', s.titulo, 'mentor_nome', u.nome,
      'inicio', s.inicio, 'meet_link', s.meet_link, 'gravacao_url', s.gravacao_url
      ) ORDER BY s.inicio ASC), '[]'::jsonb) INTO v_itens
    FROM public.mentoria_sessoes s LEFT JOIN public.users u ON u.id = s.mentor_id
    WHERE s.mentor_id = v_mentor AND s.status = 'agendada'
      AND s.inicio + make_interval(mins => s.duracao_min) >= now()
      AND (s.tipo <> 'individual' OR (s.tipo = 'individual' AND s.aluno_email = v_email));
  ELSE
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'tipo', t.tipo, 'titulo', t.titulo, 'mentor_nome', t.nome,
      'inicio', t.inicio, 'meet_link', NULL, 'gravacao_url', t.gravacao_url
      ) ORDER BY t.inicio DESC), '[]'::jsonb) INTO v_itens
    FROM (SELECT s.id, s.tipo, s.titulo, u.nome, s.inicio, s.gravacao_url
      FROM public.mentoria_sessoes s LEFT JOIN public.users u ON u.id = s.mentor_id
      WHERE s.tipo <> 'individual' AND ((s.status = 'realizada' AND s.gravacao_url IS NOT NULL) OR s.origem = 'arquivo_2025')
      ORDER BY s.inicio DESC LIMIT 200) t;
  END IF;
  RETURN jsonb_build_object('itens', v_itens);
END;
$function$;

revoke all on function public.get_mentor_contexto() from public;
revoke execute on function public.get_mentor_contexto() from anon;
grant execute on function public.get_mentor_contexto() to authenticated;
revoke all on function public.mentor_canais_listar() from public;
revoke execute on function public.mentor_canais_listar() from anon;
grant execute on function public.mentor_canais_listar() to authenticated;
revoke all on function public.mentor_canal_grupo_salvar(text) from public;
revoke execute on function public.mentor_canal_grupo_salvar(text) from anon;
grant execute on function public.mentor_canal_grupo_salvar(text) to authenticated;
revoke all on function public.mentor_mural_salvar(uuid, text, text, text, text, text, text, text, text, text[], boolean, boolean) from public;
revoke execute on function public.mentor_mural_salvar(uuid, text, text, text, text, text, text, text, text, text[], boolean, boolean) from anon;
grant execute on function public.mentor_mural_salvar(uuid, text, text, text, text, text, text, text, text, text[], boolean, boolean) to authenticated;
revoke all on function public.mentor_mural_listar(text, text) from public;
revoke execute on function public.mentor_mural_listar(text, text) from anon;
grant execute on function public.mentor_mural_listar(text, text) to authenticated;
revoke all on function public.mentor_mural_excluir(uuid) from public;
revoke execute on function public.mentor_mural_excluir(uuid) from anon;
grant execute on function public.mentor_mural_excluir(uuid) to authenticated;
revoke all on function public.mentor_sessao_salvar(uuid, text, text, text, timestamptz, int, text, text, jsonb, text) from public;
revoke execute on function public.mentor_sessao_salvar(uuid, text, text, text, timestamptz, int, text, text, jsonb, text) from anon;
grant execute on function public.mentor_sessao_salvar(uuid, text, text, text, timestamptz, int, text, text, jsonb, text) to authenticated;
revoke all on function public.mentor_sessao_excluir(uuid) from public;
revoke execute on function public.mentor_sessao_excluir(uuid) from anon;
grant execute on function public.mentor_sessao_excluir(uuid) to authenticated;
revoke all on function public.mentor_sessoes_listar(text) from public;
revoke execute on function public.mentor_sessoes_listar(text) from anon;
grant execute on function public.mentor_sessoes_listar(text) to authenticated;
revoke all on function public.mentor_convites_listar() from public;
revoke execute on function public.mentor_convites_listar() from anon;
grant execute on function public.mentor_convites_listar() to authenticated;
revoke all on function public.registrar_evento_mentor(jsonb) from public;
revoke execute on function public.registrar_evento_mentor(jsonb) from anon;
grant execute on function public.registrar_evento_mentor(jsonb) to authenticated;
revoke all on function public.mentor_rotina_listar(date) from public;
revoke execute on function public.mentor_rotina_listar(date) from anon;
grant execute on function public.mentor_rotina_listar(date) to authenticated;
revoke all on function public.mentor_rotina_marcar_enviado(uuid) from public;
revoke execute on function public.mentor_rotina_marcar_enviado(uuid) from anon;
grant execute on function public.mentor_rotina_marcar_enviado(uuid) to authenticated;
revoke all on function public.mentor_sinalizar_ies(text, text) from public;
revoke execute on function public.mentor_sinalizar_ies(text, text) from anon;
grant execute on function public.mentor_sinalizar_ies(text, text) to authenticated;
revoke all on function public.mentor_aluno(text) from public;
revoke execute on function public.mentor_aluno(text) from anon;
grant execute on function public.mentor_aluno(text) to authenticated;
revoke all on function public.mentor_perolas_listar() from public;
revoke execute on function public.mentor_perolas_listar() from anon;
grant execute on function public.mentor_perolas_listar() to authenticated;
revoke all on function public.mentor_perola_salvar(text, text) from public;
revoke execute on function public.mentor_perola_salvar(text, text) from anon;
grant execute on function public.mentor_perola_salvar(text, text) to authenticated;
revoke all on function public.mentor_intervencoes_listar(date, date) from public;
revoke execute on function public.mentor_intervencoes_listar(date, date) from anon;
grant execute on function public.mentor_intervencoes_listar(date, date) to authenticated;
revoke all on function public.api_mentoria_mural(text, text, timestamptz) from public;
revoke execute on function public.api_mentoria_mural(text, text, timestamptz) from anon, authenticated;
revoke all on function public.api_mentoria_sessoes(text, text) from public;
revoke execute on function public.api_mentoria_sessoes(text, text) from anon, authenticated;

commit;
