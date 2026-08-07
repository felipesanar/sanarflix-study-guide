-- Portal do Gestor v2 — contrato de simulados e slots previstos (spec §6.1, §6.2)
-- Dado novo, tabelas novas, nenhuma migração destrutiva.
-- Leitura por user_can_access_ies (admin e b2b_partner já retornam true nela).
-- Escrita bloqueada para authenticated: só admin (política própria) ou service_role.
--
-- NÃO faz CREATE OR REPLACE FUNCTION em nenhuma das 19 RPCs com guard de feature
-- injetado direto em produção (§7.1). Estas tabelas não têm relação com elas.

-- ---------------------------------------------------------------- contrato
create table if not exists public.ies_contrato_simulados (
  id                    uuid primary key default gen_random_uuid(),
  ies_id                uuid not null references public.ies(id) on delete cascade,
  nome_contrato         text not null,
  simulados_contratados int  not null check (simulados_contratados > 0),
  vigencia_inicio       date not null,
  vigencia_fim          date not null,
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id),
  constraint ies_contrato_simulados_vigencia_check check (vigencia_fim >= vigencia_inicio)
);

create unique index if not exists ies_contrato_simulados_ies_nome_uidx
  on public.ies_contrato_simulados (ies_id, nome_contrato);

create index if not exists ies_contrato_simulados_ies_idx
  on public.ies_contrato_simulados (ies_id);

create index if not exists ies_contrato_simulados_vigencia_idx
  on public.ies_contrato_simulados (ies_id, vigencia_fim desc);

comment on table public.ies_contrato_simulados is
  'Contrato de simulados por IES. simulados_contratados é o denominador do KPI "3 de 7" (spec §6.2).';

-- ------------------------------------------------------------------- slots
create table if not exists public.ies_simulado_previsto (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid not null references public.ies_contrato_simulados(id) on delete cascade,
  ies_id        uuid not null references public.ies(id) on delete cascade,
  ordem         int  not null check (ordem > 0),
  nome_previsto text,
  simulado_id   uuid references public.simulados_admin(id),
  created_at    timestamptz not null default now()
);

create unique index if not exists ies_simulado_previsto_contrato_ordem_uidx
  on public.ies_simulado_previsto (contrato_id, ordem);

create index if not exists ies_simulado_previsto_ies_idx
  on public.ies_simulado_previsto (ies_id);

create index if not exists ies_simulado_previsto_simulado_idx
  on public.ies_simulado_previsto (simulado_id)
  where simulado_id is not null;

comment on table public.ies_simulado_previsto is
  'Um slot por simulado contratado. simulado_id nulo = "A definir" (spec §6.2, decisão 24/07).';
comment on column public.ies_simulado_previsto.simulado_id is
  'Nulo = slot ainda sem simulado real vinculado; o cronograma mostra "A definir" e status previsto (spec §6.4).';

-- --------------------------------------------------------------------- RLS
alter table public.ies_contrato_simulados enable row level security;
alter table public.ies_simulado_previsto  enable row level security;

-- Grants: authenticated só lê. Escrita fica com service_role e com a política de admin.
--
-- O revoke tem que incluir `authenticated`, não só `public, anon`: o pg_default_acl
-- do schema public concede arwdDxtm (tudo) a anon, authenticated e service_role em
-- toda tabela nova. Sem revogar de authenticated primeiro, o `grant select` abaixo
-- é redundante e a tabela nasce com INSERT/UPDATE/DELETE para authenticated — o que
-- deixaria um admin na chave anon escrever direto, contornando a RPC SECURITY
-- DEFINER de §6.3 onde a auditoria mora.
revoke all on table public.ies_contrato_simulados from public, anon, authenticated;
revoke all on table public.ies_simulado_previsto  from public, anon, authenticated;
grant select on public.ies_contrato_simulados to authenticated;
grant select on public.ies_simulado_previsto  to authenticated;
grant all    on public.ies_contrato_simulados to service_role;
grant all    on public.ies_simulado_previsto  to service_role;

-- SELECT: quem pode acessar a IES lê o contrato dela.
drop policy if exists "Contrato legivel por quem acessa a IES" on public.ies_contrato_simulados;
create policy "Contrato legivel por quem acessa a IES"
  on public.ies_contrato_simulados for select to authenticated
  using (public.user_can_access_ies(auth.uid(), ies_id));

drop policy if exists "Slots legiveis por quem acessa a IES" on public.ies_simulado_previsto;
create policy "Slots legiveis por quem acessa a IES"
  on public.ies_simulado_previsto for select to authenticated
  using (public.user_can_access_ies(auth.uid(), ies_id));

-- ESCRITA: só admin. Sem política de INSERT/UPDATE/DELETE para gestor ou
-- gestor_grupo — com RLS ligada e nenhuma política aplicável, a escrita é negada
-- por padrão. As RPCs de admin de §6.3 são SECURITY DEFINER e passam por cima.
drop policy if exists "Admins gerenciam contrato de simulados" on public.ies_contrato_simulados;
create policy "Admins gerenciam contrato de simulados"
  on public.ies_contrato_simulados for all to authenticated
  using      (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins gerenciam slots previstos" on public.ies_simulado_previsto;
create policy "Admins gerenciam slots previstos"
  on public.ies_simulado_previsto for all to authenticated
  using      (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));
