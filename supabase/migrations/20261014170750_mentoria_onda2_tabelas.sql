-- Página do Mentor · Onda 2 (Agir): sessões, liberação de agenda, mural,
-- intervenções e log por aluno. Leitura por RLS só do próprio mentor;
-- escrita só por RPC (arquivos seguintes).

create table public.mentoria_sessoes (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid references public.mentores(user_id) on delete restrict,
  tipo text not null check (tipo in ('coletiva', 'individual')),
  titulo text not null check (length(btrim(titulo)) > 0),
  tema text,
  inicio timestamptz not null,
  duracao_min int not null default 60 check (duracao_min between 5 and 480),
  meet_link text,
  gravacao_url text,
  aluno_email text,
  status text not null default 'agendada' check (status in ('agendada', 'realizada', 'cancelada')),
  realizada_em timestamptz,
  origem text not null default 'academy' check (origem in ('academy', 'arquivo_2025')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentoria_sessoes_mentor_ou_arquivo check (mentor_id is not null or origem = 'arquivo_2025'),
  constraint mentoria_sessoes_individual_tem_aluno check (tipo <> 'individual' or aluno_email is not null)
);
create index mentoria_sessoes_mentor_inicio on public.mentoria_sessoes (mentor_id, inicio desc);

create table public.mentoria_agenda_liberacoes (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.mentores(user_id) on delete restrict,
  aluno_email text not null,
  mensagem text not null check (length(btrim(mensagem)) > 0),
  ligado boolean not null default true,
  desde timestamptz not null default now(),
  desligado_em timestamptz
);
create unique index mentoria_agenda_liberacoes_uma_ligada
  on public.mentoria_agenda_liberacoes (mentor_id, aluno_email)
  where ligado;

create table public.mural_posts (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.mentores(user_id) on delete restrict,
  tag text not null check (length(btrim(tag)) between 1 and 40),
  titulo text not null check (length(btrim(titulo)) > 0),
  mensagem text not null check (length(btrim(mensagem)) > 0),
  link_titulo text,
  link_url text,
  anexo_path text,
  anexo_nome text,
  publico text not null check (publico in ('turma', 'selecionados')),
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  publicado_em timestamptz,
  origem text not null default 'mentor' check (origem in ('mentor', 'sessao_coletiva', 'liberacao_agenda')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mural_posts_link_com_titulo check (link_url is null or link_titulo is not null)
);
create index mural_posts_mentor_publicado on public.mural_posts (mentor_id, publicado_em desc);

create table public.mural_destinatarios (
  post_id uuid not null references public.mural_posts(id) on delete cascade,
  aluno_email text not null,
  primary key (post_id, aluno_email)
);
create index mural_destinatarios_aluno on public.mural_destinatarios (aluno_email);

create table public.mentoria_intervencoes (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.mentores(user_id) on delete restrict,
  tipo text not null check (tipo in ('reuniao_individual', 'reuniao_coletiva', 'mensagem_mural', 'whatsapp', 'outro')),
  titulo text not null check (length(btrim(titulo)) > 0),
  nota text,
  status text not null default 'a_fazer' check (status in ('a_fazer', 'em_andamento', 'feito')),
  alvo text not null check (alvo in ('aluno', 'grupo', 'turma')),
  origem text not null check (origem in ('auto', 'manual')),
  origem_ref jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  concluido_em timestamptz
);
create index mentoria_intervencoes_mentor_criado on public.mentoria_intervencoes (mentor_id, criado_em desc);

create table public.mentoria_intervencao_alunos (
  intervencao_id uuid not null references public.mentoria_intervencoes(id) on delete cascade,
  aluno_email text not null,
  primary key (intervencao_id, aluno_email)
);
create index mentoria_intervencao_alunos_aluno on public.mentoria_intervencao_alunos (aluno_email);

create table public.mentoria_intervencao_comentarios (
  id uuid primary key default gen_random_uuid(),
  intervencao_id uuid not null references public.mentoria_intervencoes(id) on delete cascade,
  autor_id uuid references auth.users(id) on delete set null,
  texto text not null check (length(btrim(texto)) > 0),
  criado_em timestamptz not null default now()
);

create table public.mentoria_eventos (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.mentores(user_id) on delete restrict,
  aluno_email text,
  tipo text not null,
  intervencao_id uuid references public.mentoria_intervencoes(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index mentoria_eventos_aluno on public.mentoria_eventos (mentor_id, aluno_email, criado_em desc);

alter table public.mentoria_sessoes enable row level security;
alter table public.mentoria_agenda_liberacoes enable row level security;
alter table public.mural_posts enable row level security;
alter table public.mural_destinatarios enable row level security;
alter table public.mentoria_intervencoes enable row level security;
alter table public.mentoria_intervencao_alunos enable row level security;
alter table public.mentoria_intervencao_comentarios enable row level security;
alter table public.mentoria_eventos enable row level security;

-- Helper: o chamador é mentor com cadastro ativo? Devolve o id ou falha.
create or replace function public.mentor_ativo_id()
 returns uuid
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_role(auth.uid(), 'mentor'::app_role)
     OR NOT EXISTS (SELECT 1 FROM public.mentores m WHERE m.user_id = auth.uid() AND m.ativo) THEN
    RAISE EXCEPTION 'mentor inativo ou sem cadastro';
  END IF;
  RETURN auth.uid();
END;
$function$;

-- Helper: normaliza e confere que todos os e-mails são da turma do mentor.
create or replace function public.mentor_exige_alunos(p_mentor uuid, p_emails text[])
 returns text[]
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_emails text[];
  v_fora text;
BEGIN
  SELECT coalesce(array_agg(DISTINCT lower(btrim(e))), '{}') INTO v_emails
  FROM unnest(coalesce(p_emails, '{}')) e
  WHERE btrim(e) <> '';

  SELECT e INTO v_fora
  FROM unnest(v_emails) e
  WHERE NOT EXISTS (
    SELECT 1 FROM public.mentoria_vinculos v
    WHERE v.mentor_id = p_mentor AND v.fim IS NULL AND v.email_normalizado = e)
  LIMIT 1;

  IF v_fora IS NOT NULL THEN
    RAISE EXCEPTION 'aluno % não é da sua turma', v_fora;
  END IF;
  RETURN v_emails;
END;
$function$;

-- Leitura: o mentor ativo lê o que é dele. Admin lê tudo.
create policy "Mentor lê suas sessões" on public.mentoria_sessoes for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or (mentor_id = auth.uid() and public.has_role(auth.uid(), 'mentor'::app_role)));
create policy "Mentor lê suas liberações" on public.mentoria_agenda_liberacoes for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or (mentor_id = auth.uid() and public.has_role(auth.uid(), 'mentor'::app_role)));
create policy "Mentor lê seus posts" on public.mural_posts for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or (mentor_id = auth.uid() and public.has_role(auth.uid(), 'mentor'::app_role)));
create policy "Mentor lê destinatários dos seus posts" on public.mural_destinatarios for select to authenticated
  using (exists (select 1 from public.mural_posts p where p.id = post_id
                 and (public.has_role(auth.uid(), 'admin'::app_role) or (p.mentor_id = auth.uid() and public.has_role(auth.uid(), 'mentor'::app_role)))));
create policy "Mentor lê suas intervenções" on public.mentoria_intervencoes for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or (mentor_id = auth.uid() and public.has_role(auth.uid(), 'mentor'::app_role)));
create policy "Mentor lê alunos das suas intervenções" on public.mentoria_intervencao_alunos for select to authenticated
  using (exists (select 1 from public.mentoria_intervencoes i where i.id = intervencao_id
                 and (public.has_role(auth.uid(), 'admin'::app_role) or (i.mentor_id = auth.uid() and public.has_role(auth.uid(), 'mentor'::app_role)))));
create policy "Mentor lê comentários das suas intervenções" on public.mentoria_intervencao_comentarios for select to authenticated
  using (exists (select 1 from public.mentoria_intervencoes i where i.id = intervencao_id
                 and (public.has_role(auth.uid(), 'admin'::app_role) or (i.mentor_id = auth.uid() and public.has_role(auth.uid(), 'mentor'::app_role)))));
create policy "Mentor lê seu log" on public.mentoria_eventos for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or (mentor_id = auth.uid() and public.has_role(auth.uid(), 'mentor'::app_role)));

-- Storage: anexos do mural, privado. O mentor sobe e lê só na própria pasta.
insert into storage.buckets (id, name, public)
values ('mural-anexos', 'mural-anexos', false)
on conflict (id) do nothing;

create policy "Mentor sobe anexo na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'mural-anexos' and (storage.foldername(name))[1] = auth.uid()::text
              and public.has_role(auth.uid(), 'mentor'::app_role));
create policy "Mentor lê anexos da própria pasta" on storage.objects for select to authenticated
  using (bucket_id = 'mural-anexos' and (storage.foldername(name))[1] = auth.uid()::text);

revoke all on function public.mentor_ativo_id() from public;
revoke execute on function public.mentor_ativo_id() from anon;
grant execute on function public.mentor_ativo_id() to authenticated;
revoke all on function public.mentor_exige_alunos(uuid, text[]) from public;
revoke execute on function public.mentor_exige_alunos(uuid, text[]) from anon, authenticated;
