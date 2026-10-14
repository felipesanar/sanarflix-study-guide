# Página do Mentor · Onda 2 (Agir) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O mentor conhece a turma (quem está ativo, esfriando ou sumido), age sobre ela (mural, sessões, liberação de agenda) e presta contas (kanban de intervenções que nasce sozinho das ações); o Flix lê mural e sessões por uma API de Mentoria chamada via Kong.

**Architecture:** Tudo vive no Supabase do Academy (gvqv). Tabelas novas com RLS só de leitura para o próprio mentor; toda escrita por RPC `SECURITY DEFINER` que valida (1) o chamador é mentor ativo e (2) cada aluno citado tem vínculo ativo com ele. Cada RPC de ação grava, na mesma transação, o card de intervenção (quando a regra manda) e uma linha de log por aluno. Anexos do mural no Storage, bucket privado. A API para o Flix é uma edge function (`mentoria-api`) que confia no Kong: chave de serviço num header + identidade do aluno em headers.

**Tech Stack:** Supabase Postgres (plpgsql, RLS, Storage), Deno edge function, React 18 + TS + Vite, react-router v6, TanStack Query v5, shadcn/ui, Vitest.

**Spec:** Handoff da Página do Mentor v1.0 (06/10/2026), telas 01, 02b, 03, 05, 06, 07, 07b. Relatório de viabilidade (Claude Doc c157dd6d). Nota da reunião "Página do Mentorando × Academy" de 13/10/2026 (Notion). Plano anterior: `docs/superpowers/plans/2026-10-08-mentor-fundacao.md` (tabelas `mentores`, `mentoria_vinculos`, `get_mentor_contexto`, portal `/mentor`).

## Global Constraints

- Branch `feat/mentor-fundacao`, worktree `../sanarflix-mentor-fundacao`. Sem merge na `main`, sem push, sem PR, sem deploy de front.
- Migrations: o executor escreve os arquivos e roda os testes de texto. A aplicação em produção é feita pelo controller ao final, pelo MCP do Supabase, com o roteiro de `memory/branch-continua-e-migrations` (functiondef, BEGIN/ROLLBACK, advisors, revoke anon, renomear arquivo para a versão gravada).
- Toda função nova no schema public: `revoke all … from public; revoke execute … from anon; grant execute … to authenticated` (exceto as que só a edge usa com service role: essas ficam `revoke … from public, anon, authenticated`).
- Escrita só por RPC. Nenhuma policy de INSERT/UPDATE/DELETE nas tabelas novas.
- Identidade do aluno = `email_normalizado` (minúsculas, sem espaço), a mesma chave de `mentoria_vinculos`.
- Toda RPC de ação do mentor valida o vínculo ativo de cada aluno citado; aluno fora da turma → `RAISE EXCEPTION 'aluno % não é da sua turma'`.
- Texto de interface em pt-BR; nenhuma menção a "canal"; desempenho sempre em % de acerto (não se aplica a esta onda).
- **Regras de negócio decididas pelo Felipe:**
  - Sumido = 10+ dias sem atividade (corte único). Segmentos da turma: **Ativos** (0–7 dias), **Esfriando** (8–9 dias), **Sumidos** (10+ dias), **Sem dado** (nenhuma atividade conhecida).
  - Contagem de intervenções: **coletiva conta 1; individual conta 1 por aluno**.
  - Portal abre no **Início**.
  - Tags do mural são **livres, definidas pelo mentor** (sugestões: Desempenho, Aviso, Fique por dentro).
  - Acervo de sessões nasce com o **arquivo 2025**: mentorias coletivas gravadas, gerais, sem tribo (mentor nulo).
  - Integração Flix → Academy via **Kong** (credencial registrada no Kong; o Flix nunca chama o Supabase direto).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Regras derivadas (rulings do planejamento)

- **Última atividade** de um aluno = maior entre: `fato_consumo_conteudo_b2b.event_timestamp` (por `sanarflix_user_id`) e `user_sessions.started_at` (por `academy_user_id`). Aluno sem nenhum dos dois → "Sem dado". B2C fica "Sem dado" até a dim do Therlyson trazer todo PRO.
- **Peso no medidor**: card `alvo = 'turma'` ou tipo `mensagem_mural` pesa 1; card de tipo individual (`reuniao_individual`, `whatsapp`) pesa o nº de alunos do card. Planejadas = soma dos pesos dos cards criados no período; realizadas = soma dos pesos dos cards em `feito` no período.
- **Auto-cards**: publicar mural com "registrar como intervenção" → card `mensagem_mural` (Feito); nova sessão individual → card `reuniao_individual` (A fazer); liberar agenda → um card `reuniao_individual` (A fazer) por aluno; nova sessão coletiva → card `reuniao_coletiva` (A fazer) + post automático no mural (tag "Aviso"); marcar sessão feita → card ligado vai para Feito.
- **"Pra você"** = post com `publico = 'selecionados'` que tem o aluno entre os destinatários; liberar agenda também gera um post "Pra você" com a mensagem obrigatória.

---

## File Structure

| Arquivo | Responsabilidade |
| --- | --- |
| `supabase/migrations/20261014200000_mentoria_onda2_tabelas.sql` | Tabelas, índices, RLS, bucket, helpers `mentor_ativo_id`, `mentor_exige_alunos` |
| `supabase/migrations/20261014200100_mentoria_onda2_rpcs_turma.sql` | `mentor_turma`, `mentor_aluno` |
| `supabase/migrations/20261014200200_mentoria_onda2_rpcs_acao.sql` | mural, sessões, agenda, intervenções |
| `supabase/migrations/20261014200300_mentoria_onda2_rpcs_api.sql` | funções que só a edge `mentoria-api` usa |
| `src/test/unit/mentoriaOnda2Migrations.test.ts` | testes de texto das 4 migrations |
| `src/services/mentor/turma.ts`, `mural.ts`, `sessoes.ts`, `intervencoes.ts` | wrappers das RPCs (padrão `callRpc` de `services/admin/mentores.ts`) |
| `src/features/mentor/routes/InicioMentor.tsx` (mod) | Início com alertas, próxima sessão, A fazer |
| `src/features/mentor/routes/MinhaTurma.tsx` | tela 02b |
| `src/features/mentor/components/DrawerAlunoMentor.tsx` | tela 03 (casca, sem notas) |
| `src/features/mentor/routes/Mural.tsx` | tela 05 |
| `src/features/mentor/routes/Sessoes.tsx` | tela 06 |
| `src/features/mentor/routes/Intervencoes.tsx` + `components/DrawerIntervencao.tsx` | telas 07 e 07b |
| `src/features/mentor/mentorRoutes.tsx`, `MentorLayout.tsx` (mod) | rotas e menu |
| `supabase/functions/mentoria-api/index.ts` | API para o Flix via Kong |
| `docs/mentoria/api-de-mentoria-contrato.md` (mod) | contrato v1 com Kong |

---

### Task 1: Tabelas, RLS, Storage e helpers

**Files:**
- Create: `supabase/migrations/20261014200000_mentoria_onda2_tabelas.sql`
- Test: `src/test/unit/mentoriaOnda2Migrations.test.ts`

**Interfaces (produz):**
- Tabelas `mentoria_sessoes`, `mentoria_agenda_liberacoes`, `mural_posts`, `mural_destinatarios`, `mentoria_intervencoes`, `mentoria_intervencao_alunos`, `mentoria_intervencao_comentarios`, `mentoria_eventos`.
- `public.mentor_ativo_id() returns uuid` — `auth.uid()` se tem papel mentor e `mentores.ativo`; senão `RAISE EXCEPTION 'mentor inativo ou sem cadastro'`.
- `public.mentor_exige_alunos(p_mentor uuid, p_emails text[]) returns text[]` — normaliza e devolve os e-mails; `RAISE` no primeiro sem vínculo ativo com `p_mentor`.
- Bucket privado `mural-anexos`; mentor sobe e lê só em `{auth.uid()}/…`.

- [ ] **Step 1: Teste de texto (falha)**

```ts
// src/test/unit/mentoriaOnda2Migrations.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'supabase', 'migrations');
const ler = (nome: string) => readFileSync(join(dir, nome), 'utf8');
const TAB = ler('20261014200000_mentoria_onda2_tabelas.sql');

const TABELAS = [
  'mentoria_sessoes', 'mentoria_agenda_liberacoes', 'mural_posts', 'mural_destinatarios',
  'mentoria_intervencoes', 'mentoria_intervencao_alunos', 'mentoria_intervencao_comentarios', 'mentoria_eventos',
];

describe('Onda 2 · tabelas', () => {
  it.each(TABELAS)('%s tem RLS ligada', (t) => {
    expect(TAB).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, 'i'));
  });

  it('nenhuma policy de escrita nas tabelas novas', () => {
    const policies = (TAB.match(/create policy[\s\S]*?;/gi) ?? []).filter((p) => !/storage\.objects/i.test(p));
    expect(policies.length).toBeGreaterThan(0);
    for (const p of policies) expect(p).toMatch(/for select/i);
  });

  it('arquivo 2025: sessão sem mentor só com origem arquivo_2025', () => {
    expect(TAB).toMatch(/check \(mentor_id is not null or origem = 'arquivo_2025'\)/i);
  });

  it('sessão individual exige aluno', () => {
    expect(TAB).toMatch(/check \(tipo <> 'individual' or aluno_email is not null\)/i);
  });

  it('link do mural exige título', () => {
    expect(TAB).toMatch(/check \(link_url is null or link_titulo is not null\)/i);
  });

  it('uma liberação de agenda ligada por mentor e aluno', () => {
    expect(TAB).toMatch(/create unique index \w+\s+on public\.mentoria_agenda_liberacoes \(mentor_id, aluno_email\)\s+where ligado/i);
  });

  it('mentor_ativo_id exige papel e cadastro ativo', () => {
    expect(TAB).toMatch(/function public\.mentor_ativo_id\(\)[\s\S]*has_role\(auth\.uid\(\), 'mentor'::app_role\)[\s\S]*m\.ativo/i);
  });

  it('bucket mural-anexos é privado e o mentor só toca a própria pasta', () => {
    expect(TAB).toMatch(/insert into storage\.buckets[\s\S]*'mural-anexos'[\s\S]*false/i);
    expect(TAB).toMatch(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/test/unit/mentoriaOnda2Migrations.test.ts` → ENOENT.

- [ ] **Step 3: Migration**

```sql
-- supabase/migrations/20261014200000_mentoria_onda2_tabelas.sql
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
```

- [ ] **Step 4: Rodar e ver passar; commit** — `feat(mentor): onda 2 — tabelas de sessoes, mural, intervencoes e log`.

---

### Task 2: RPCs de leitura da turma e do aluno

**Files:** Create `supabase/migrations/20261014200100_mentoria_onda2_rpcs_turma.sql`; Modify `src/test/unit/mentoriaOnda2Migrations.test.ts`; Create `src/services/mentor/turma.ts` + `src/test/unit/mentorTurma.test.ts`.

**Interfaces (produz):**
- `public.mentor_turma()` → `jsonb` array de `{email, nome, telefone, semestre, acesso_ate, b2b, academy_user_id, sanarflix_user_id, ultima_atividade, dias_sem_atividade, segmento}`; `segmento ∈ ('ativo','esfriando','sumido','sem_dado')`; ordenado por `dias_sem_atividade desc nulls last, nome`.
- `public.mentor_aluno(p_email text)` → `jsonb {aluno: <mesmo shape de um item de mentor_turma>, liberacao: {ligado, desde, mensagem} | null, intervencoes: [{id, tipo, titulo, status, criado_em}], log: [{tipo, criado_em, payload}]}` (log e intervenções: últimos 50, mais recentes primeiro).
- TS: `fetchTurma(): Promise<AlunoTurma[]>`, `fetchAluno(email): Promise<AlunoDetalhe>`, tipo `Segmento`.

- [ ] **Step 1: Testes (falham)** — acrescentar a `mentoriaOnda2Migrations.test.ts`:

```ts
const TURMA = ler('20261014200100_mentoria_onda2_rpcs_turma.sql');

describe('Onda 2 · turma', () => {
  it('as duas RPCs exigem mentor ativo', () => {
    expect(TURMA).toMatch(/function public\.mentor_turma\(\)[\s\S]*?v_mentor uuid := public\.mentor_ativo_id\(\)/i);
    expect(TURMA).toMatch(/function public\.mentor_aluno\(p_email text\)[\s\S]*?public\.mentor_exige_alunos\(v_mentor, array\[p_email\]\)/i);
  });

  it('corte único de sumido em 10 dias; esfriando 8 a 9', () => {
    expect(TURMA).toMatch(/when dias >= 10 then 'sumido'/i);
    expect(TURMA).toMatch(/when dias >= 8 then 'esfriando'/i);
    expect(TURMA).toMatch(/when dias is null then 'sem_dado'/i);
  });

  it('última atividade junta consumo do Flix e sessão no Academy', () => {
    expect(TURMA).toMatch(/fato_consumo_conteudo_b2b/i);
    expect(TURMA).toMatch(/user_sessions/i);
  });
});
```

E `src/test/unit/mentorTurma.test.ts` no padrão de `src/test/unit/mentorContexto.test.ts`: `fetchTurma` chama `rpc('mentor_turma', {})`; `fetchAluno('A@x.com')` chama `rpc('mentor_aluno', { p_email: 'A@x.com' })`; erro do banco vira exceção com a mensagem.

- [ ] **Step 2: Migration**

```sql
-- supabase/migrations/20261014200100_mentoria_onda2_rpcs_turma.sql
create or replace function public.mentor_turma()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
BEGIN
  RETURN coalesce((
    WITH alunos AS (
      SELECT v.email_normalizado AS email,
             coalesce(v.nome, u.nome, d.nome) AS nome,
             u.telefone,
             coalesce(u.semestre, d.semestre_atual) AS semestre,
             d.vigencia_fim AS acesso_ate,
             (d.sanarflix_user_id IS NOT NULL) AS b2b,
             coalesce(v.academy_user_id, d.academy_user_id) AS academy_user_id,
             coalesce(v.sanarflix_user_id, d.sanarflix_user_id) AS sanarflix_user_id
      FROM public.mentoria_vinculos v
      LEFT JOIN public.users u ON u.id = v.academy_user_id
      LEFT JOIN LATERAL (
        SELECT * FROM public.dim_aluno_b2b d0
        WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST
        LIMIT 1
      ) d ON true
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ),
    atividade AS (
      SELECT a.*,
             greatest(
               (SELECT max(f.event_timestamp) AT TIME ZONE 'UTC' FROM public.fato_consumo_conteudo_b2b f
                 WHERE a.sanarflix_user_id IS NOT NULL AND f.sanarflix_user_id = a.sanarflix_user_id),
               (SELECT max(s.started_at) FROM public.user_sessions s
                 WHERE a.academy_user_id IS NOT NULL AND s.user_id = a.academy_user_id)
             ) AS ultima_atividade
      FROM alunos a
    ),
    calculado AS (
      SELECT x.*, (current_date - (x.ultima_atividade AT TIME ZONE 'America/Sao_Paulo')::date) AS dias
      FROM atividade x
    )
    SELECT jsonb_agg(jsonb_build_object(
      'email', c.email, 'nome', c.nome, 'telefone', c.telefone, 'semestre', c.semestre,
      'acesso_ate', c.acesso_ate, 'b2b', c.b2b, 'academy_user_id', c.academy_user_id,
      'sanarflix_user_id', c.sanarflix_user_id, 'ultima_atividade', c.ultima_atividade,
      'dias_sem_atividade', c.dias,
      'segmento', CASE WHEN dias IS NULL THEN 'sem_dado'
                       WHEN dias >= 10 THEN 'sumido'
                       WHEN dias >= 8 THEN 'esfriando'
                       ELSE 'ativo' END
    ) ORDER BY c.dias DESC NULLS LAST, c.nome)
    FROM calculado c
  ), '[]'::jsonb);
END;
$function$;

create or replace function public.mentor_aluno(p_email text)
 returns jsonb
 language plpgsql
 stable security definer
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
            ORDER BY e0.criado_em DESC LIMIT 50) e), '[]'::jsonb)
  );
END;
$function$;

revoke all on function public.mentor_turma() from public;
revoke execute on function public.mentor_turma() from anon;
grant execute on function public.mentor_turma() to authenticated;
revoke all on function public.mentor_aluno(text) from public;
revoke execute on function public.mentor_aluno(text) from anon;
grant execute on function public.mentor_aluno(text) to authenticated;
```

Nota: `fato_consumo_conteudo_b2b.event_timestamp` é `timestamp without time zone` em UTC (comentário da tabela), por isso o `AT TIME ZONE 'UTC'`.

- [ ] **Step 3: Service** `src/services/mentor/turma.ts` com tipos `Segmento`, `AlunoTurma`, `AlunoDetalhe` espelhando o JSON acima e o mesmo `callRpc` de `src/services/admin/mentores.ts`.
- [ ] **Step 4: Testes verdes; commit** — `feat(mentor): onda 2 — turma e aluno (ultima atividade e segmentos)`.

---

### Task 3: RPCs de ação (mural, sessões, agenda, intervenções)

**Files:** Create `supabase/migrations/20261014200200_mentoria_onda2_rpcs_acao.sql`; Modify o teste de texto; Create `src/services/mentor/{mural,sessoes,intervencoes}.ts` + testes no padrão de `adminMentores.test.ts`.

**Interfaces (produz):**
- `mentor_mural_salvar(p_id uuid, p_tag text, p_titulo text, p_mensagem text, p_link_titulo text, p_link_url text, p_anexo_path text, p_anexo_nome text, p_publico text, p_destinatarios text[], p_publicar boolean, p_registrar_intervencao boolean) → jsonb {post_id, publicado, intervencao_id}`
- `mentor_mural_listar(p_aluno_email text default null, p_tag text default null) → jsonb [{id, tag, titulo, mensagem, link_titulo, link_url, anexo_nome, anexo_path, publico, status, publicado_em, origem, destinatarios: text[]}]`
- `mentor_tags() → jsonb text[]` (tags já usadas pelo mentor + sugestões fixas 'Desempenho', 'Aviso', 'Fique por dentro', sem repetir)
- `mentor_sessao_salvar(p_id uuid, p_tipo text, p_titulo text, p_tema text, p_inicio timestamptz, p_duracao_min int, p_meet_link text, p_aluno_email text) → jsonb {sessao_id, intervencao_id, post_id}`
- `mentor_sessao_marcar_feita(p_id uuid, p_gravacao_url text) → jsonb {sessao_id}`
- `mentor_sessoes_listar(p_quando text) → jsonb` (`p_quando ∈ 'proximas','realizadas','todas'`)
- `mentor_definir_link_agendamento(p_url text) → jsonb {link_agendamento}`
- `mentor_agenda_liberar(p_emails text[], p_mensagem text) → jsonb {liberados, intervencoes}`; mensagem vazia → `RAISE 'mensagem obrigatória'`; sem `link_agendamento` → `RAISE 'cadastre o link do Google Agenda antes de liberar'`
- `mentor_agenda_desligar(p_emails text[]) → jsonb {desligados}` (`null` = todos)
- `mentor_intervencao_criar(p_tipo text, p_titulo text, p_nota text, p_alvo text, p_alunos text[]) → jsonb {intervencao_id}` (origem manual)
- `mentor_intervencao_atualizar(p_id uuid, p_titulo text, p_nota text, p_status text) → jsonb {intervencao_id, status}` (cada mudança de status vira evento por aluno; `feito` grava `concluido_em`)
- `mentor_intervencao_comentar(p_id uuid, p_texto text) → jsonb {comentario_id}`
- `mentor_intervencoes_listar(p_de date, p_ate date) → jsonb {cards: [{id, tipo, titulo, nota, status, alvo, origem, origem_ref, criado_em, alunos: text[], comentarios: [{texto, criado_em}], peso}], planejadas, realizadas}` (peso e somas conforme "Regras derivadas")

Regras de implementação, todas as funções: `v_mentor := public.mentor_ativo_id()` na primeira linha do corpo; e-mails sempre por `public.mentor_exige_alunos(v_mentor, …)`; posts/sessões/cards de outro mentor → `RAISE '… não encontrado'`; todo evento em `mentoria_eventos` com `tipo` em (`mural_publicado`, `sessao_criada`, `sessao_realizada`, `agenda_liberada`, `agenda_desligada`, `intervencao_criada`, `intervencao_status`, `intervencao_comentario`); `revoke … from public, anon; grant … to authenticated` em cada uma.

- [ ] **Step 1: Testes de texto (falham)** — para cada uma das 12 funções: `mentor_ativo_id()` presente; as que recebem e-mail chamam `mentor_exige_alunos`; `mentor_agenda_liberar` contém as duas mensagens de erro acima; `mentor_mural_salvar` insere em `mentoria_intervencoes` com `'mensagem_mural'` quando `p_registrar_intervencao`; `mentor_sessao_salvar` cria post com `origem` `'sessao_coletiva'` para coletiva e card `'reuniao_individual'` para individual; `mentor_intervencoes_listar` tem a expressão de peso (`case when alvo = 'turma' or tipo = 'mensagem_mural' then 1 else`); nenhuma função tem `delete from public.mentoria_` (histórico nunca é apagado).
- [ ] **Step 2: Migration** — escrever as 12 funções seguindo as interfaces e regras. Padrões a copiar: guard e auditoria de `20261009125504_mentoria_rpcs_admin.sql`; `RETURNING … INTO`; `jsonb_agg … ORDER BY`. Publicar grava `status='publicado', publicado_em=now()`; editar post publicado é permitido (mantém `publicado_em`).
- [ ] **Step 3: Services + testes** — wrappers com os nomes `salvarPost`, `listarPosts`, `listarTags`, `salvarSessao`, `marcarSessaoFeita`, `listarSessoes`, `definirLinkAgendamento`, `liberarAgenda`, `desligarAgenda`, `criarIntervencao`, `atualizarIntervencao`, `comentarIntervencao`, `listarIntervencoes`; cada teste confere o nome da RPC e os `p_*`.
- [ ] **Step 4: Verde; commit** — `feat(mentor): onda 2 — RPCs de mural, sessoes, agenda e intervencoes`.

---

### Task 4: Início e Minha Turma (telas 01 e 02b) + drawer do aluno (03)

**Files:** Modify `InicioMentor.tsx`, `mentorRoutes.tsx`, `MentorLayout.tsx`; Create `routes/MinhaTurma.tsx`, `components/DrawerAlunoMentor.tsx`, testes em `src/test/components/mentor/`.

Comportamento (handoff 01, 02b, 03; decisões da onda):
- **Menu** (`NAV_ITENS` do `MentorLayout`, desktop e mobile): Início, Minha Turma (B2C) ou Visão Geral (B2B — nesta onda aponta para a mesma `MinhaTurma`, título "Visão Geral"), Mural, Sessões, Intervenções.
- **Início**: etiqueta "N alunos · Turma"; saudação; frase-guia "N alunos sumiram. Comece por eles." quando houver sumidos; botões "Nova intervenção" e "Publicar no mural"; card **Sumiram** (10+ dias) com contagem, até 5 nomes e "Ver na turma" → `/mentor/turma?filtro=sumido`; card **Próxima sessão coletiva** (de `listarSessoes('proximas')`) com "Adicionar link do Meet" quando `meet_link` vazio; card **A fazer** com os 3 primeiros cards `a_fazer` e "Ver todas as intervenções". Regrediram/Estagnados/Não fizeram o simulado NÃO aparecem (dependem da integração B2C).
- **Minha Turma**: filtro de simulados mostra "nenhum disponível" + aviso "Os simulados ainda não chegam aqui. Enquanto isso, a turma mostra cadastro e engajamento."; cards Ativos na semana, Sem acesso há 10+ dias (com "Ver quem sumiu"), Possível aprovação vazio ("precisa de simulados e de Metas"); segmentos Ativos / Esfriando / Sumidos / Sem dado com contagem; filtro `?filtro=` vira chip removível ("vindo da home"); tabela: aluno, semestre · acesso até, meta "Aguardando Metas", acerto "Sem dado", último acesso ("há N dias" ou "Sem dado"); busca por nome/e-mail; clique na linha abre o drawer.
- **Drawer do aluno**: nome, semestre, etiqueta do segmento; telefone, acesso até; ações **WhatsApp** (reusar `linkWhatsAppAluno` de `src/features/gestor/components/DrawerAluno.tsx`; botão oculto sem telefone), **Mensagem no mural** (abre `/mentor/mural?para=<email>`), **Criar intervenção** (abre o criador inline com o aluno); **Liberar agendamento individual**: switch + mensagem obrigatória ("Falta 1 passo" até enviar) → `liberarAgenda([email], msg)`; já ligado mostra "Liberado desde dd/MM" e "Desligar"; **Log de interações** com filtro Tudo / Intervenções / Mural.
- Estados de loading, erro (com "Tentar de novo") e vazio em todas as telas.

- [ ] Testes de componente (Testing Library, services mockados): Início mostra "3 alunos sumiram" com 3 sumidos e esconde a frase com 0; Minha Turma filtra por segmento e o chip "vindo da home" some ao remover; drawer bloqueia "Enviar e liberar" sem mensagem e chama `liberarAgenda` com mensagem; drawer sem telefone não mostra WhatsApp.
- [ ] Commit — `feat(mentor): onda 2 — inicio com alertas, minha turma e drawer do aluno`.

### Task 5: Mural (tela 05)

**Files:** Create `routes/Mural.tsx`, `components/NovaPublicacao.tsx`, testes.

- Nova publicação: tag (combobox com `listarTags()` + texto livre), "Para quem": Toda a turma | Selecionados (atalhos por segmento — Sumidos, Esfriando —, por semestre: 1º a 8º agrupado, 9º a 12º separados; busca; chips removíveis; `?para=<email>` pré-seleciona); título, mensagem, inserir link (título obrigatório quando há URL), anexo (upload para `mural-anexos/{mentor_id}/{uuid}-{nome}` via `supabase.storage`); "Registrar como intervenção (Mensagem · N alunos)" marcado por padrão; "Salvar rascunho"; "Publicar para N alunos".
- Preview "Como o aluno vê" com abas Coletivo e Pra você (Pra você só quando `publico = 'selecionados'`).
- Publicadas: lista com filtro por aluno e por tag; "Editar" reabre o formulário.
- [ ] Testes: link sem título bloqueia publicar; Selecionados sem nenhum aluno bloqueia; publicar chama `salvarPost` com `p_publicar: true` e `p_registrar_intervencao: true`; aba "Pra você" do preview só aparece em Selecionados.
- [ ] Commit — `feat(mentor): onda 2 — mural`.

### Task 6: Sessões e liberação de agenda (tela 06)

**Files:** Create `routes/Sessoes.tsx`, testes.

- Agenda com filtros Todas / Coletivas / Individuais e Próximas / Realizadas; colunas data, tipo, com quem, tema, link, após a sessão (Marcar feita + campo de gravação), editar.
- Nova sessão: linha de cadastro no topo, Coletiva | Individual (individual exige escolher aluno da turma); coletiva sem link mostra "Falta link".
- Bloco "Link do seu Google Agenda" (`definirLinkAgendamento`) — obrigatório antes de liberar.
- Liberar sessão individual em massa: seleção de alunos + mensagem obrigatória (sem mensagem não libera); lista "Liberada para N alunos" (aluno, desde, mensagem) com toggle por aluno e "Desligar todos".
- [ ] Testes: liberar sem link do Agenda mostra o aviso e não chama a RPC; "Desligar todos" chama `desligarAgenda(null)`; "Marcar feita" chama `marcarSessaoFeita` com a gravação.
- [ ] Commit — `feat(mentor): onda 2 — sessoes e liberacao de agenda`.

### Task 7: Intervenções (telas 07 e 07b)

**Files:** Create `routes/Intervencoes.tsx`, `components/DrawerIntervencao.tsx`, testes.

- Período: Esta semana / Quinzena (padrão) / Mês / Personalizado → `listarIntervencoes(de, ate)`; filtros busca e tipo; medidor "X de Y intervenções planejadas realizadas no período"; colunas A fazer / Em andamento / Feito com contagem; criação inline no topo da coluna (tipo + aluno/turma + descrição opcional); card com tipo, data, título, nota, aluno / "Turma toda" / "N alunos" e origem "Auto · <origem>" ou "Manual".
- Drawer do card: título editável, aluno com contexto e "Abrir aluno", status, ações (WhatsApp, Mensagem no mural, Liberar agenda — ou, para turma, Mensagem no mural e Nova sessão coletiva), comentários e histórico.
- Mudança de status por drag-and-drop NÃO entra (YAGNI); status muda pelo seletor do drawer e por um menu no card.
- [ ] Testes: medidor soma pesos (card individual com 3 alunos pesa 3; card de turma pesa 1); mudar status chama `atualizarIntervencao`; criação inline exige tipo e alvo.
- [ ] Commit — `feat(mentor): onda 2 — kanban de intervencoes`.

### Task 8: API de Mentoria para o Flix (via Kong)

**Files:** Create `supabase/migrations/20261014200300_mentoria_onda2_rpcs_api.sql`, `supabase/functions/mentoria-api/index.ts`; Modify `docs/mentoria/api-de-mentoria-contrato.md`, `supabase/config.toml` (bloco `[functions.mentoria-api] verify_jwt = false`, autenticação própria por chave).

- Autenticação: o Kong injeta `x-mentoria-key` (segredo `MENTORIA_API_KEY` no Supabase; comparação em tempo constante) e `x-aluno-email` (+ `x-sanarflix-user-id`, só registrado). Sem chave válida → 401 `{erro:'nao_autorizado'}`. CORS fechado (só server-to-server).
- Funções SQL só para a edge (service role; `revoke … from public, anon, authenticated`): `api_mentoria_me(p_email text)`, `api_mentoria_mural(p_email text, p_aba text, p_cursor timestamptz)`, `api_mentoria_sessoes(p_email text, p_quando text)`.
  - `me`: `{tem_mentor, mentor:{nome, foto_url, formacao, turma_nome, link_agendamento}, agendamento_liberado, mensagem_liberacao}`; `link_agendamento` só vai quando há liberação ligada para o aluno.
  - `mural`: aba `coletivo` = posts publicados do mentor atual com `publico='turma'`; `pra-voce` = publicados com o aluno em `mural_destinatarios`; página de 20 por `publicado_em < p_cursor`; `tem_pra_voce`; anexo com URL assinada de 1 h (gerada na edge).
  - `sessoes`: `proximas` = do mentor atual, `agendada`, `inicio >= now()`, coletivas + a individual do próprio aluno; `realizadas` = coletivas `realizada` com gravação de todos os mentores + `arquivo_2025`.
- Rotas: `GET /me`, `GET /mural?aba=&cursor=`, `GET /sessoes?quando=`; respostas e erros no formato do contrato.
- Contrato v1: trocar a seção de autenticação pelo esquema Kong acima e marcar o onboarding como fora da API (SGI, decisão de 13/10).
- [ ] Testes: texto da migration (as 3 funções sem grant para `authenticated`; `pra-voce` filtra por `mural_destinatarios`); teste Deno não existe no repo → a edge tem a lógica de roteamento e auth num módulo puro `supabase/functions/mentoria-api/rotas.ts` com teste Vitest (`src/test/unit/mentoriaApiRotas.test.ts`) cobrindo 401 sem chave, 401 com chave errada, 400 sem `x-aluno-email`, roteamento das 3 rotas e 404.
- [ ] Commit — `feat(mentor): onda 2 — API de Mentoria para o Flix via Kong`.

### Task 9: Verificação, aplicação e entrega

- [ ] `npx vitest run` (falhas só as 40 pré-existentes do Gestor), `npm run type-check`, `npm run build`, colisão de prefixo de migration.
- [ ] Controller aplica as 4 migrations em gvqv com o roteiro (functiondef das funções recriadas — nenhuma nesta onda; BEGIN/ROLLBACK; `apply_migration` um por um; simular um mentor de teste numa transação desfeita chamando `mentor_turma`, `mentor_mural_salvar` com e-mail fora da turma → erro esperado; `get_advisors security`; renomear arquivos para as versões gravadas).
- [ ] Deploy da edge `mentoria-api` (verify_jwt=false) e cadastro do segredo `MENTORIA_API_KEY` — **só com o ok do Felipe**, porque a chave precisa ir para o Kong junto com o time do Flix.
- [ ] Atualizar o preview local (`mentor-branch`, porta 8092).
