-- Página do Mentor · Onda 1. Mentor, vínculo aluno × mentor, RLS de leitura
-- e a experiência "mentor" no get_access. Escrita só por RPC (próximo arquivo).

create table public.mentores (
  user_id uuid primary key references public.users(id) on delete cascade,
  tipo text not null check (tipo in ('b2c', 'b2b')),
  turma_nome text not null check (length(btrim(turma_nome)) > 0),
  ies_id uuid references public.ies(id),
  foto_url text,
  formacao text,
  link_agendamento text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint mentores_b2b_exige_ies check (tipo = 'b2c' or ies_id is not null)
);

comment on table public.mentores is
  'Cadastro do mentor (Página do Mentor). tipo define o menu: b2c = Minha Turma, b2b = Visão Geral. Escrita só via admin_upsert_mentor.';

create table public.mentoria_vinculos (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.mentores(user_id) on delete restrict,
  email_normalizado text not null
    check (email_normalizado = lower(btrim(email_normalizado)) and email_normalizado like '%@%'),
  nome text,
  sanarflix_user_id text,
  academy_user_id uuid references public.users(id) on delete set null,
  inicio timestamptz not null default now(),
  fim timestamptz,
  origem text not null check (origem in ('planilha', 'manual', 'sgi', 'onboarding')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint mentoria_vinculos_fim_depois_inicio check (fim is null or fim >= inicio)
);

comment on table public.mentoria_vinculos is
  'Aluno × mentor com histórico. Fonte da verdade: SGI (decisão 08/10/2026); esta tabela é o espelho no Academy. origem = planilha é a ponte até a sincronização com o SGI (origem = sgi). fim null = vínculo ativo. O aluno é identificado por e-mail normalizado; sanarflix_user_id e academy_user_id são resolvidos quando existirem. Trocar de mentor encerra (fim) o vínculo antigo.';

create unique index mentoria_vinculos_um_ativo_por_aluno
  on public.mentoria_vinculos (email_normalizado)
  where fim is null;

create index mentoria_vinculos_mentor_ativos
  on public.mentoria_vinculos (mentor_id)
  where fim is null;

alter table public.mentores enable row level security;
alter table public.mentoria_vinculos enable row level security;

create policy "Admin lê mentores"
  on public.mentores for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

create policy "Mentor lê o próprio cadastro"
  on public.mentores for select to authenticated
  using (user_id = auth.uid() and public.has_role(auth.uid(), 'mentor'::app_role));

create policy "Admin lê vínculos"
  on public.mentoria_vinculos for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

create policy "Mentor lê os próprios vínculos"
  on public.mentoria_vinculos for select to authenticated
  using (
    mentor_id = auth.uid()
    and public.has_role(auth.uid(), 'mentor'::app_role)
    and exists (select 1 from public.mentores m where m.user_id = auth.uid() and m.ativo)
  );

-- Helper para as RPCs das próximas ondas (turma, aluno, mural): o mentor
-- logado tem vínculo ativo com este aluno? Admin sempre pode.
create or replace function public.mentor_pode_ver_aluno(p_email text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select public.has_role(auth.uid(), 'admin'::app_role)
      or exists (
        select 1
        from public.mentoria_vinculos v
        join public.mentores m on m.user_id = v.mentor_id
        where v.mentor_id = auth.uid()
          and m.ativo
          and v.fim is null
          and v.email_normalizado = lower(btrim(p_email))
      );
$function$;

revoke all on function public.mentor_pode_ver_aluno(text) from public;
grant execute on function public.mentor_pode_ver_aluno(text) to authenticated;

-- get_access: corpo vigente em prod (lido com pg_get_functiondef em
-- 08/10/2026) + bloco do mentor + 'mentores.manage' no admin.
create or replace function public.get_access()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_uid uuid := auth.uid();
  v_roles text[] := '{}';
  v_experiences text[] := ARRAY['aluno'];
  v_caps text[] := '{}';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('roles', '[]'::jsonb, 'experiences', '[]'::jsonb, 'capabilities', '[]'::jsonb);
  END IF;

  SELECT COALESCE(array_agg(role::text), '{}') INTO v_roles
  FROM public.user_roles WHERE user_id = v_uid;

  IF 'admin' = ANY(v_roles) THEN
    v_experiences := v_experiences || ARRAY['admin','gestao'];
    v_caps := v_caps || ARRAY['users.manage','users.edit','avisos.manage','ies.manage','guia.manage','sanarclass.manage','simulados.manage','feedbacks.moderate','analytics.view','impersonate','admin.tools','institutional.view','alunos.view','mentores.manage'];
  END IF;

  IF 'gestor' = ANY(v_roles) OR 'gestor_grupo' = ANY(v_roles) THEN
    v_experiences := v_experiences || ARRAY['gestao'];
    v_caps := v_caps || ARRAY['institutional.view','alunos.view'];
  END IF;

  IF 'atendimento' = ANY(v_roles) THEN
    v_experiences := v_experiences || ARRAY['atendimento'];
    v_caps := v_caps || ARRAY['users.support','users.edit','feedbacks.support'];
  END IF;

  IF 'mentor' = ANY(v_roles) THEN
    v_experiences := v_experiences || ARRAY['mentor'];
    v_caps := v_caps || ARRAY['mentoria.view'];
  END IF;

  RETURN jsonb_build_object(
    'roles', to_jsonb(v_roles),
    'experiences', (SELECT to_jsonb(array_agg(DISTINCT e)) FROM unnest(v_experiences) e),
    'capabilities', COALESCE((SELECT to_jsonb(array_agg(DISTINCT c)) FROM unnest(v_caps) c), '[]'::jsonb)
  );
END;
$function$;
