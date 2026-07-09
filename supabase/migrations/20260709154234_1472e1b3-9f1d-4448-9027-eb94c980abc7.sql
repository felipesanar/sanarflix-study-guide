-- 1) Catálogo de features
create table if not exists public.feature_catalog (
  key         text primary key,
  experience  text not null check (experience in ('aluno','gestao')),
  label       text not null,
  description text not null default '',
  sort_order  int  not null default 0,
  is_master   boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

grant select on public.feature_catalog to authenticated;
grant all on public.feature_catalog to service_role;

alter table public.feature_catalog enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='feature_catalog' and policyname='Catalogo legivel por autenticados') then
    create policy "Catalogo legivel por autenticados"
      on public.feature_catalog for select
      to authenticated
      using (true);
  end if;
end $$;

insert into public.feature_catalog (key, experience, label, description, sort_order, is_master) values
  ('aluno.home',                 'aluno',  'Home',                    'Página inicial com resumo',                                        10, false),
  ('aluno.guia_estudos',         'aluno',  'Guia de Estudos',         'Conteúdos organizados por matéria',                                20, false),
  ('aluno.dashboard',            'aluno',  'Dashboard',               'Métricas e progresso do aluno',                                    30, false),
  ('aluno.simulados',            'aluno',  'Simulados',               'Acesso aos simulados (inclui o modo prova)',                       40, false),
  ('aluno.desempenho_simulados', 'aluno',  'Desempenho Simulados',    'Análise detalhada de simulados',                                   50, false),
  ('aluno.sanarclass',           'aluno',  'SanarClass',              'Aulas e materiais complementares',                                 60, false),
  ('aluno.caderno_erros',        'aluno',  'Caderno de Erros',        'Registro de erros (inclui revisão, triagem e reta final)',         70, false),
  ('gestao.enabled',             'gestao', 'Portal do Gestor',        'Master: liga/desliga o portal do gestor inteiro para a IES',      100, true),
  ('gestao.visao_institucional', 'gestao', 'Visão Institucional',     'KPIs e evolução institucional',                                   110, false),
  ('gestao.diagnostico_curricular','gestao','Diagnóstico Curricular', 'Desempenho por área e tema',                                      120, false),
  ('gestao.alunos',              'gestao', 'Visão de Alunos',         'Lista e desempenho individual dos alunos',                        130, false),
  ('gestao.insights_pedagogicos','gestao', 'Insights Pedagógicos',    'Análises pedagógicas derivadas',                                  140, false),
  ('gestao.inteligencia_decisoria','gestao','Inteligência Decisória', 'Cenários e priorização de intervenções',                          150, false),
  ('gestao.exportar',            'gestao', 'Exportar Relatórios',     'Exportação de relatórios institucionais',                         160, false),
  ('gestao.ia',                  'gestao', 'Assistente IA',           'Assistente de IA do gestor (protótipo)',                          170, false)
on conflict (key) do nothing;

-- 2) Cópia das chaves antigas -> novas
insert into public.ies_features (ies_id, feature_key, enabled)
select f.ies_id, m.new_key, f.enabled
from public.ies_features f
join (values
  ('home',                    'aluno.home'),
  ('studyGuide',              'aluno.guia_estudos'),
  ('dashboard',               'aluno.dashboard'),
  ('simulados',               'aluno.simulados'),
  ('SimuladoDesempenho',      'aluno.desempenho_simulados'),
  ('sanarclass',              'aluno.sanarclass'),
  ('errorNotebook',           'aluno.caderno_erros'),
  ('desempenhoInstitucional', 'gestao.enabled')
) as m(old_key, new_key) on f.feature_key = m.old_key
on conflict (ies_id, feature_key) do update
  set enabled = excluded.enabled, updated_at = now();

-- 3) Seed: toda IES com gestor ativo ganha gestao.* = true
insert into public.ies_features (ies_id, feature_key, enabled)
select u.id_ies, c.key, true
from (
  select distinct usr.id_ies
  from public.user_roles ur
  join public.users usr on usr.id = ur.user_id
  where ur.role in ('gestor','gestor_grupo') and usr.id_ies is not null
) u
cross join (select key from public.feature_catalog where experience = 'gestao') c
on conflict (ies_id, feature_key) do update
  set enabled = true, updated_at = now();

-- 4) RPC fonte única
create or replace function public.get_effective_features()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_bypass boolean;
  v_ies uuid;
  v_features jsonb := '{}'::jsonb;
  v_gestao_master boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_bypass := public.has_role(v_uid, 'admin'::app_role)
           or public.has_role(v_uid, 'atendimento'::app_role);

  select id_ies into v_ies from public.users where id = v_uid;

  if v_bypass then
    select coalesce(jsonb_object_agg(key, true), '{}'::jsonb) into v_features
    from public.feature_catalog where active;
    return jsonb_build_object('bypass', true, 'ies_id', v_ies, 'features', v_features);
  end if;

  select coalesce(
    (select enabled from public.ies_features f
      where f.ies_id = v_ies and f.feature_key = 'gestao.enabled'),
    false) into v_gestao_master;

  select coalesce(jsonb_object_agg(
    c.key,
    case
      when c.experience = 'gestao' and c.key <> 'gestao.enabled' and not v_gestao_master then false
      else coalesce(f.enabled, false)
    end), '{}'::jsonb)
  into v_features
  from public.feature_catalog c
  left join public.ies_features f
    on f.ies_id = v_ies and f.feature_key = c.key
  where c.active;

  return jsonb_build_object('bypass', false, 'ies_id', v_ies, 'features', v_features);
end;
$fn$;

revoke all on function public.get_effective_features() from public, anon;
grant execute on function public.get_effective_features() to authenticated, service_role;

-- 5) Realtime (idempotente)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='ies_features') then
    alter publication supabase_realtime add table public.ies_features;
  end if;
end $$;