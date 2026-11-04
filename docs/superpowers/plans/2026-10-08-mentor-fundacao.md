# Página do Mentor · Onda 1 (Fundação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O admin cadastra um mentor (B2C ou B2B), importa os alunos dele por planilha, e o mentor entra no Academy direto no próprio portal (`/mentor`), vendo o nome da turma e quantos alunos tem.

**Architecture:** Papel novo `mentor` no enum `app_role` e experiência nova `mentor` no `get_access`. Duas tabelas novas (`mentores`, `mentoria_vinculos`), lidas por RLS e escritas só por RPC `SECURITY DEFINER`. O aluno do mentor NÃO precisa ser usuário do Academy: o vínculo é por e-mail normalizado, com `sanarflix_user_id` e `academy_user_id` resolvidos quando existirem. Um aluno tem no máximo um vínculo ativo (índice único parcial). O front ganha a árvore `/mentor/*`, uma seção `/admin/mentores` e o contrato da API de Mentoria (documento) para a reunião com o Flix de 13/10.

**Tech Stack:** Supabase Postgres (migrations SQL, plpgsql, RLS), React 18 + TypeScript + Vite, react-router v6, TanStack Query v5, shadcn/ui, Vitest + Testing Library, `xlsx` para planilhas.

**Spec:** Relatório de viabilidade (Claude Doc) https://claude.ai/code/artifact/c157dd6d-5c0f-45dd-8e94-8104f089f582 — seções "Identidade e vínculo", "O que precisa ser criado" e backlog itens 1 e 2. Handoff de design v1.0 (06/10/2026): `C:\Users\felipe.souza\Downloads\Handoff Página do Mentor.html`, telas 00 e A1.

## Global Constraints

- Todo texto de interface em pt-BR. Nenhuma menção a "canal" na interface.
- "Gestão" passa a se chamar "Gestor" no seletor de experiência.
- Login de mentor abre direto no portal do Mentor. Precedência pós-login: `admin > atendimento > mentor > gestao > aluno`.
- Um aluno tem um mentor por vez. Trocar de mentor encerra o vínculo anterior (histórico preservado), nunca apaga.
- Tipo do mentor: `b2c` ou `b2b`. Mentor `b2b` exige IES. O tipo define o menu (B2C: Minha Turma; B2B: Visão Geral) — nesta onda só o Início existe.
- Escrita em `mentores` e `mentoria_vinculos` só por RPC `SECURITY DEFINER` com guard `public.has_role(auth.uid(), 'admin'::app_role)`. Nenhuma policy de INSERT/UPDATE/DELETE.
- Toda RPC de admin grava em `public.admin_audit_log(admin_id, action, metadata)`.
- **Migrations NÃO são aplicadas em produção por quem executa este plano.** O Felipe aplica. Nada de `apply_migration`, `execute_sql` de escrita, deploy de edge ou push na `main`. Trabalhar na branch `feat/mentor-fundacao` em worktree.
- Migration já aplicada nunca é editada; correção vai em arquivo novo (regra de `20260804160000`).
- `ALTER TYPE ... ADD VALUE` vive sozinho no próprio arquivo (não pode ser usado na mesma transação em que é criado).
- Conta de mentor B2C usa como IES âncora a IES "B2C" `abec7c7d-ef07-4871-9e19-090f4d951e5e`. **Nunca** a IES "B2B" `9f21b138-0027-44c8-9660-dc6706d57bc0`: o `b2b-create-user` concede `admin` a quem é criado nela.
- Commits terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Decisões do Felipe em 08/10/2026 (valem para todas as tasks):**
- Mentor B2B: **recorte manual** de alunos (importação, como no B2C), não a IES inteira.
- Fonte do vínculo aluno × mentor: **SGI**. A tabela `mentoria_vinculos` do Academy guarda o espelho e o histórico. A importação por planilha desta onda é a **ponte** até o SGI ter o campo; a sincronização SGI → Academy (`origem = 'sgi'`) é uma onda própria e não entra aqui.
- Conflito na importação: **o admin escolhe trocar**. Sem marcar, quem já tem outro mentor é pulado.
- Seletor de experiência: **escondido para mentor que não é staff**. Mentor puro não vê a opção "Aluno"; mentor que também é gestor alterna entre Gestor e Mentor.

---

## File Structure

| Arquivo | Responsabilidade |
| --- | --- |
| `supabase/migrations/20261008120000_app_role_mentor.sql` (novo) | Só o `ADD VALUE 'mentor'` no enum |
| `supabase/migrations/20261008120100_mentoria_fundacao.sql` (novo) | Tabelas, índices, RLS, helper `mentor_pode_ver_aluno`, `get_access` com a experiência mentor |
| `supabase/migrations/20261008120200_mentoria_rpcs_admin.sql` (novo) | `admin_upsert_mentor`, `admin_list_mentores`, `admin_importar_vinculos`, `admin_encerrar_vinculo`, `get_mentor_contexto` |
| `src/test/unit/mentoriaMigrations.test.ts` (novo) | Testes de texto das 3 migrations |
| `src/experiences/access.ts` (mod) | `ExperienceId` + `mentor`; capabilities `mentoria.view`, `mentores.manage` |
| `src/experiences/shared/globalNav.ts` (mod) | Opção Mentor, rótulo Gestor, `/mentor` na resolução |
| `src/utils/experiences.ts` (mod) | Entrypoint e precedência do mentor |
| `src/experiences/buildAppRoutes.tsx` (mod) | Monta `mentorRoutes()` ou `deniedPortal('/mentor')` |
| `src/features/mentor/mentorRoutes.tsx` (novo) | Árvore `/mentor/*` |
| `src/features/mentor/MentorLayout.tsx` (novo) | Shell mínimo do portal |
| `src/features/mentor/routes/InicioMentor.tsx` (novo) | Tela Início: turma e nº de alunos |
| `src/services/mentor/contexto.ts` (novo) | Wrapper de `get_mentor_contexto` |
| `src/services/admin/mentores.ts` (novo) | Wrappers das 4 RPCs de admin |
| `src/components/admin/mentores/parseVinculosFile.ts` (novo) | Parser da planilha de alunos do mentor |
| `src/components/admin/mentores/MentoresBoard.tsx` (novo) | Lista + ações |
| `src/components/admin/mentores/CreateMentorDialog.tsx` (novo) | Cria conta + cadastro de mentor |
| `src/components/admin/mentores/ImportVinculosDialog.tsx` (novo) | Simula e aplica a importação |
| `src/experiences/admin/pages/MentoresPage.tsx` (novo) | Página `/admin/mentores` |
| `src/experiences/admin/adminRoutes.tsx`, `AdminNav.ts` (mod) | Rota e item de menu |
| `src/components/admin/usuarios/roles.ts`, `src/services/usersService.ts`, `supabase/functions/b2b-create-user/index.ts` (mod) | Papel `mentor` aceito |
| `docs/mentoria/api-de-mentoria-contrato.md` (novo) | Contrato da API para o Flix |

---

### Task 0: Branch isolada

- [ ] **Step 1: Criar a worktree**

```bash
git -C "C:/Users/felipe.souza/Documents/Projetos (Sanar)/sanarflix-study-guide" worktree add -b feat/mentor-fundacao ../sanarflix-mentor-fundacao main
```

- [ ] **Step 2: Instalar e rodar a suíte para ter a linha de base**

```bash
cd ../sanarflix-mentor-fundacao && npm ci && npx vitest run
```
Expected: suíte verde (anotar a contagem de testes para comparar no fim).

---

### Task 1: Migrations do banco (papel, tabelas, RLS, acesso, RPCs)

**Files:**
- Create: `supabase/migrations/20261008120000_app_role_mentor.sql`
- Create: `supabase/migrations/20261008120100_mentoria_fundacao.sql`
- Create: `supabase/migrations/20261008120200_mentoria_rpcs_admin.sql`
- Test: `src/test/unit/mentoriaMigrations.test.ts`

**Interfaces:**
- Produces (SQL, usado pelas Tasks 4 e 6):
  - `public.get_access()` → `jsonb {roles, experiences, capabilities}`; papel `mentor` concede experiência `mentor` e capability `mentoria.view`; `admin` ganha também `mentores.manage`.
  - `public.get_mentor_contexto()` → `jsonb {mentor: {user_id, nome, email, tipo, turma_nome, ies_id, ies_nome, ativo} | null, alunos_ativos: int}`
  - `public.admin_list_mentores()` → `jsonb` array de `{user_id, nome, email, tipo, turma_nome, ies_id, ies_nome, ativo, alunos_ativos}`
  - `public.admin_upsert_mentor(p_user_id uuid, p_tipo text, p_turma_nome text, p_ies_id uuid DEFAULT NULL, p_foto_url text DEFAULT NULL, p_formacao text DEFAULT NULL, p_link_agendamento text DEFAULT NULL, p_ativo boolean DEFAULT true)` → `jsonb {user_id, criado}`
  - `public.admin_importar_vinculos(p_mentor_id uuid, p_linhas jsonb, p_trocar boolean DEFAULT false, p_dry_run boolean DEFAULT true)` → `jsonb {dry_run, total, novos, ja_com_este_mentor, com_outro_mentor: [{email, mentor_atual_id, mentor_atual_nome}], invalidos: [{ordem, email, motivo}], inseridos, trocados}`; `p_linhas` = array de `{email, nome?}`
  - `public.admin_encerrar_vinculo(p_vinculo_id uuid)` → `jsonb {vinculo_id, fim}`
  - `public.mentor_pode_ver_aluno(p_email text)` → `boolean`

- [ ] **Step 1: Escrever o teste de texto (falha porque os arquivos não existem)**

```ts
// src/test/unit/mentoriaMigrations.test.ts
/**
 * Testes de texto das migrations da Página do Mentor (Onda 1).
 * Não há pgTAP neste repo: o teste lê o SQL e trava as regras que, se
 * sumirem numa recriação futura, abrem dado de aluno ou quebram o acesso.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'supabase', 'migrations');
const ler = (nome: string) => readFileSync(join(dir, nome), 'utf8');

const ENUM = ler('20261008120000_app_role_mentor.sql');
const FUNDACAO = ler('20261008120100_mentoria_fundacao.sql');
const RPCS = ler('20261008120200_mentoria_rpcs_admin.sql');

/** Corpo de uma função (do CREATE até o $$ que fecha). */
const corpo = (sql: string, nome: string): string => {
  const re = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${nome}\\s*\\([\\s\\S]*?\\$function\\$([\\s\\S]*?)\\$function\\$`,
    'i',
  );
  const m = sql.match(re);
  if (!m) throw new Error(`função ${nome} não encontrada`);
  return m[1];
};

describe('migration do enum', () => {
  it('só adiciona o valor mentor, sozinho no arquivo', () => {
    const semComentario = ENUM.replace(/--.*$/gm, '').trim();
    expect(semComentario).toBe("ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mentor';");
  });
});

describe('tabelas e RLS', () => {
  it('um vínculo ativo por aluno (índice único parcial por e-mail)', () => {
    expect(FUNDACAO).toMatch(
      /create unique index mentoria_vinculos_um_ativo_por_aluno\s+on public\.mentoria_vinculos \(email_normalizado\)\s+where fim is null/i,
    );
  });

  it('mentor b2b exige IES', () => {
    expect(FUNDACAO).toMatch(/check \(tipo = 'b2c' or ies_id is not null\)/i);
  });

  it('RLS ligada nas duas tabelas', () => {
    expect(FUNDACAO).toMatch(/alter table public\.mentores enable row level security/i);
    expect(FUNDACAO).toMatch(/alter table public\.mentoria_vinculos enable row level security/i);
  });

  it('nenhuma policy de escrita: só leitura (escrita é por RPC)', () => {
    const policies = FUNDACAO.match(/create policy[\s\S]*?;/gi) ?? [];
    expect(policies.length).toBe(4);
    for (const p of policies) expect(p).toMatch(/for select/i);
  });

  it('mentor só lê os próprios vínculos', () => {
    expect(FUNDACAO).toMatch(/on public\.mentoria_vinculos for select to authenticated\s+using \(mentor_id = auth\.uid\(\)\)/i);
  });
});

describe('get_access', () => {
  const body = corpo(FUNDACAO, 'get_access');

  it('papel mentor concede a experiência mentor e mentoria.view', () => {
    expect(body).toMatch(/'mentor' = any\(v_roles\)/i);
    expect(body).toMatch(/array\['mentor'\]/i);
    expect(body).toMatch(/'mentoria\.view'/i);
  });

  it('admin ganha mentores.manage e mantém as capabilities de antes', () => {
    for (const cap of ['users.manage', 'users.edit', 'impersonate', 'institutional.view', 'mentores.manage']) {
      expect(body).toContain(`'${cap}'`);
    }
  });

  it('atendimento e gestor continuam iguais', () => {
    expect(body).toMatch(/array\['users\.support','users\.edit','feedbacks\.support'\]/i);
    expect(body).toMatch(/array\['institutional\.view','alunos\.view'\]/i);
  });
});

describe('RPCs de admin', () => {
  for (const nome of ['admin_upsert_mentor', 'admin_list_mentores', 'admin_importar_vinculos', 'admin_encerrar_vinculo']) {
    it(`${nome} exige admin e é SECURITY DEFINER`, () => {
      const re = new RegExp(`function public\\.${nome}[\\s\\S]*?security definer[\\s\\S]*?\\$function\\$`, 'i');
      expect(RPCS).toMatch(re);
      expect(corpo(RPCS, nome)).toMatch(/if not public\.has_role\(auth\.uid\(\), 'admin'::app_role\) then/i);
    });
  }

  it('upsert, importação e encerramento gravam auditoria', () => {
    for (const nome of ['admin_upsert_mentor', 'admin_importar_vinculos', 'admin_encerrar_vinculo']) {
      expect(corpo(RPCS, nome)).toMatch(/insert into public\.admin_audit_log/i);
    }
  });

  it('importação: trocar encerra o vínculo antigo, nunca apaga', () => {
    const body = corpo(RPCS, 'admin_importar_vinculos');
    expect(body).toMatch(/update public\.mentoria_vinculos[\s\S]*?set fim = now\(\)/i);
    expect(body).not.toMatch(/delete from public\.mentoria_vinculos/i);
  });

  it('importação: dry run não escreve', () => {
    const body = corpo(RPCS, 'admin_importar_vinculos');
    expect(body).toMatch(/if not p_dry_run then/i);
  });

  it('get_mentor_contexto devolve só o mentor logado', () => {
    expect(corpo(RPCS, 'get_mentor_contexto')).toMatch(/where m\.user_id = auth\.uid\(\)/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/test/unit/mentoriaMigrations.test.ts`
Expected: FAIL com `ENOENT ... 20261008120000_app_role_mentor.sql`.

- [ ] **Step 3: Escrever a migration do enum**

```sql
-- supabase/migrations/20261008120000_app_role_mentor.sql
-- Papel novo da Página do Mentor. ADD VALUE não pode ser usado na mesma
-- transação em que é criado, por isso vive sozinho neste arquivo.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mentor';
```

- [ ] **Step 4: Escrever a migration de fundação**

```sql
-- supabase/migrations/20261008120100_mentoria_fundacao.sql
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
  created_by uuid references auth.users(id),
  constraint mentores_b2b_exige_ies check (tipo = 'b2c' or ies_id is not null)
);

comment on table public.mentores is
  'Cadastro do mentor (Página do Mentor). tipo define o menu: b2c = Minha Turma, b2b = Visão Geral. Escrita só via admin_upsert_mentor.';

create table public.mentoria_vinculos (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.mentores(user_id) on delete cascade,
  email_normalizado text not null
    check (email_normalizado = lower(btrim(email_normalizado)) and email_normalizado like '%@%'),
  nome text,
  sanarflix_user_id text,
  academy_user_id uuid references public.users(id) on delete set null,
  inicio timestamptz not null default now(),
  fim timestamptz,
  origem text not null check (origem in ('planilha', 'manual', 'sgi', 'onboarding')),
  created_by uuid references auth.users(id),
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
  using (user_id = auth.uid());

create policy "Admin lê vínculos"
  on public.mentoria_vinculos for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

create policy "Mentor lê os próprios vínculos"
  on public.mentoria_vinculos for select to authenticated
  using (mentor_id = auth.uid());

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
```

- [ ] **Step 5: Escrever a migration das RPCs**

```sql
-- supabase/migrations/20261008120200_mentoria_rpcs_admin.sql
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
               ORDER BY (d.status_atual = 'ativo') DESC
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
```

- [ ] **Step 6: Rodar o teste e ver passar**

Run: `npx vitest run src/test/unit/mentoriaMigrations.test.ts`
Expected: PASS (todos).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261008120000_app_role_mentor.sql supabase/migrations/20261008120100_mentoria_fundacao.sql supabase/migrations/20261008120200_mentoria_rpcs_admin.sql src/test/unit/mentoriaMigrations.test.ts
git commit -m "feat(mentor): papel mentor, tabelas de mentor e vinculo, RPCs de admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Modelo de acesso no front (experiência e capabilities)

**Files:**
- Modify: `src/experiences/access.ts:13-30, 44-58, 65-91`
- Modify: `src/experiences/types.ts` (comentário da lista de experiências)
- Test: `src/test/unit/access.test.ts`

**Interfaces:**
- Produces: `ExperienceId = 'aluno' | 'gestao' | 'admin' | 'atendimento' | 'mentor'`; `Capability` ganha `'mentoria.view'` e `'mentores.manage'`; `deriveAccessFromRoles(['mentor'])` → `{experiences: ['aluno','mentor'], capabilities: ['mentoria.view']}`.

- [ ] **Step 1: Adicionar os testes (falham)**

Acrescentar ao fim do `describe('experiences/access — deriveAccessFromRoles', ...)` em `src/test/unit/access.test.ts`:

```ts
  it('mentor ganha a experiência mentor e só mentoria.view', () => {
    const access = deriveAccessFromRoles(['mentor']);
    expect(access.experiences).toEqual(expect.arrayContaining(['aluno', 'mentor']));
    expect(access.experiences).toHaveLength(2);
    expect(access.capabilities).toEqual(['mentoria.view']);
  });

  it('mentor B2B que também é gestor soma as duas experiências', () => {
    const access = deriveAccessFromRoles(['gestor', 'mentor']);
    expect(access.experiences).toEqual(expect.arrayContaining(['aluno', 'gestao', 'mentor']));
    expect(access.capabilities).toEqual(
      expect.arrayContaining(['institutional.view', 'alunos.view', 'mentoria.view']),
    );
  });

  it('admin ganha mentores.manage (cadastro de mentores), mas não a experiência mentor', () => {
    const access = deriveAccessFromRoles(['admin']);
    expect(access.capabilities).toContain('mentores.manage');
    expect(access.experiences).not.toContain('mentor');
  });
```

E no `describe('experiences/access — parseAccessPayload', ...)`:

```ts
  it('aceita a experiência mentor vinda da RPC', () => {
    const parsed = parseAccessPayload({
      roles: ['mentor'],
      experiences: ['aluno', 'mentor'],
      capabilities: ['mentoria.view'],
    });
    expect(parsed?.experiences).toEqual(['aluno', 'mentor']);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/test/unit/access.test.ts`
Expected: FAIL nos 4 testes novos (`mentor` filtrado por `VALID_EXPERIENCES`; capability ausente).

- [ ] **Step 3: Implementar em `src/experiences/access.ts`**

```ts
export type ExperienceId = 'aluno' | 'gestao' | 'admin' | 'atendimento' | 'mentor';
```

Na união `Capability`, depois de `'feedbacks.support'`:

```ts
  | 'feedbacks.support'
  | 'mentoria.view'
  | 'mentores.manage';
```

Em `ADMIN_CAPABILITIES`, depois de `'alunos.view',`:

```ts
  'alunos.view',
  'mentores.manage',
];
```

Depois de `ATENDIMENTO_CAPABILITIES`:

```ts
const MENTOR_CAPABILITIES: Capability[] = ['mentoria.view'];
```

Em `deriveAccessFromRoles`, depois do bloco de `atendimento`:

```ts
  if (safeRoles.includes('mentor')) {
    experiences.add('mentor');
    MENTOR_CAPABILITIES.forEach((cap) => capabilities.add(cap));
  }
```

E:

```ts
const VALID_EXPERIENCES: ExperienceId[] = ['aluno', 'gestao', 'admin', 'atendimento', 'mentor'];
```

Em `src/experiences/types.ts`, na lista do comentário, acrescentar a linha ` *  - \`mentor\`      — Mentor de turma (B2C ou B2B)`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/test/unit/access.test.ts`
Expected: PASS. O teste antigo "admin ganha experiências admin+gestao" (`toHaveLength(3)`) continua verde.

- [ ] **Step 5: Type-check e commit**

Run: `npm run type-check`
Expected: sem erros. Se algum `Record<Exclude<ExperienceId,'aluno'>, ...>` reclamar da chave `mentor`, é o `EXPERIENCE_ENTRYPOINTS` — ele é tratado na Task 3; neste caso, faça a Task 3 Step 3 antes de commitar e commite as duas juntas.

```bash
git add src/experiences/access.ts src/experiences/types.ts src/test/unit/access.test.ts
git commit -m "feat(mentor): experiencia mentor e capabilities no modelo de acesso

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Seletor, entrypoint e rotas do portal do mentor

**Files:**
- Modify: `src/experiences/shared/globalNav.ts`
- Modify: `src/utils/experiences.ts:28-39`
- Modify: `src/experiences/buildAppRoutes.tsx`
- Create: `src/services/mentor/contexto.ts`
- Create: `src/features/mentor/mentorRoutes.tsx`
- Create: `src/features/mentor/MentorLayout.tsx`
- Create: `src/features/mentor/routes/InicioMentor.tsx`
- Test: `src/test/unit/globalNav.test.ts`, `src/test/unit/experiences.test.ts`, `src/test/unit/buildAppRoutes.test.ts`, `src/test/unit/mentorContexto.test.ts` (novo)

**Interfaces:**
- Consumes: `ExperienceId` com `'mentor'` (Task 2); RPC `get_mentor_contexto()` (Task 1).
- Produces: `mentorRoutes(): RouteObject[]` (rota-layout `/mentor` com filho index); `fetchMentorContexto(): Promise<MentorContexto>`; tipo `MentorContexto = { mentor: MentorResumo | null; alunos_ativos: number }`, `MentorResumo = { user_id: string; nome: string; email: string; tipo: 'b2c' | 'b2b'; turma_nome: string; ies_id: string | null; ies_nome: string | null; ativo: boolean }`.

- [ ] **Step 1: Testes do seletor (falham)**

Em `src/test/unit/globalNav.test.ts`, acrescentar dentro do `describe`:

```ts
  it('mentor puro: só a opção Mentor (o seletor some, pois ele esconde com menos de 2)', () => {
    const options = getExperienceOptions(deriveAccessFromRoles(['mentor']));
    expect(options.map((o) => o.id)).toEqual(['mentor']);
    expect(options[0].url).toBe('/mentor');
  });

  it('mentor que também é gestor alterna entre Gestor e Mentor, sem Aluno', () => {
    expect(ids(['gestor', 'mentor'])).toEqual(['gestao', 'mentor']);
  });

  it('staff que também é mentor continua vendo Aluno', () => {
    expect(ids(['admin', 'mentor'])).toEqual(['aluno', 'admin', 'gestao', 'mentor']);
    expect(ids(['atendimento', 'mentor'])).toEqual(['aluno', 'atendimento', 'mentor']);
  });

  it('o portal do gestor aparece como "Gestor", não "Gestão"', () => {
    const options = getExperienceOptions(deriveAccessFromRoles(['gestor']));
    expect(options.find((o) => o.id === 'gestao')?.label).toBe('Gestor');
  });

  it('resolveCurrentExperience reconhece /mentor', () => {
    expect(resolveCurrentExperience('/mentor')).toBe('mentor');
    expect(resolveCurrentExperience('/mentor/turma')).toBe('mentor');
  });
```

- [ ] **Step 2: Testes do entrypoint (falham)**

Em `src/test/unit/experiences.test.ts`, acrescentar um `describe` no fim do arquivo (usa `makeUser`, `alunoRules` e `gestorRules` já definidos no topo):

```ts
describe('getDefaultRouteForUser — mentor', () => {
  it('mentor puro entra em /mentor', () => {
    const user = makeUser(['mentor']);
    expect(getDefaultRouteForUser(user, alunoRules, deriveAccessFromRoles(['mentor']))).toBe('/mentor');
  });

  it('mentor que também é gestor entra em /mentor (mentor vem antes de gestão)', () => {
    const user = makeUser(['gestor', 'mentor']);
    expect(getDefaultRouteForUser(user, gestorRules, deriveAccessFromRoles(['gestor', 'mentor']))).toBe('/mentor');
  });

  it('EXPERIENCE_ENTRYPOINTS tem a chave mentor', () => {
    expect(EXPERIENCE_ENTRYPOINTS.mentor).toBe('/mentor');
  });
});
```

- [ ] **Step 3: Testes de rota (falham)**

Em `src/test/unit/buildAppRoutes.test.ts`, acrescentar no fim:

```ts
describe('experiences/buildAppRoutes — mentor', () => {
  it('mentor monta a rota-layout /mentor com o Início como index', () => {
    const routes = routesForRoles(['mentor'], alunoRules);
    const mentorRoute = routes.get('/mentor');
    expect(mentorRoute?.children?.length).toBeGreaterThan(0);
    const indexChild = (mentorRoute?.children ?? []).find((c) => c.index);
    expect(indexChild).toBeDefined();
    expect(redirectTarget(indexChild)).toBeUndefined();
  });

  it('quem não é mentor recebe redirect de negação em /mentor', () => {
    for (const roles of [[], ['gestor'], ['admin'], ['atendimento']]) {
      const routes = routesForRoles(roles);
      expect(redirectTarget(routes.get('/mentor'))).toBeDefined();
      expect(routes.get('/mentor')?.children).toBeUndefined();
    }
  });

  it('/home leva o mentor ao /mentor', () => {
    const routes = routesForRoles(['mentor'], alunoRules);
    expect(redirectTarget(routes.get('/home'))).toBe('/mentor');
  });
});
```

- [ ] **Step 4: Teste do service (falha)**

```ts
// src/test/unit/mentorContexto.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
vi.mock('@/utils/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { fetchMentorContexto } from '@/services/mentor/contexto';

describe('services/mentor/contexto', () => {
  beforeEach(() => mockRpc.mockReset());

  it('chama get_mentor_contexto sem argumentos e devolve o payload', async () => {
    const payload = {
      mentor: {
        user_id: 'm1', nome: 'Thiago Taniguchi', email: 't@x.com', tipo: 'b2c',
        turma_nome: 'Tribo Carcará', ies_id: null, ies_nome: null, ativo: true,
      },
      alunos_ativos: 87,
    };
    mockRpc.mockReturnValue(Promise.resolve({ data: payload, error: null }));
    await expect(fetchMentorContexto()).resolves.toEqual(payload);
    expect(mockRpc).toHaveBeenCalledWith('get_mentor_contexto', {});
  });

  it('propaga o erro da RPC', async () => {
    mockRpc.mockReturnValue(Promise.resolve({ data: null, error: { message: 'não autenticado' } }));
    await expect(fetchMentorContexto()).rejects.toThrow('não autenticado');
  });
});
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npx vitest run src/test/unit/globalNav.test.ts src/test/unit/experiences.test.ts src/test/unit/buildAppRoutes.test.ts src/test/unit/mentorContexto.test.ts`
Expected: FAIL nos testes novos.

- [ ] **Step 6: Implementar `globalNav.ts`**

Trocar o import de ícones por:

```ts
import { UserCog, School, Headset, GraduationCap, Users } from 'lucide-react';
```

Trocar `label: 'Gestão',` por `label: 'Gestor',`.

A opção `aluno` deixa de entrar sempre. Trocar a inicialização de `options` por:

```ts
  // Handoff da Página do Mentor (tela 00): o seletor é só para staff. Quem é
  // mentor e não é admin/atendimento não vê "Aluno" — e, sendo só mentor,
  // fica com uma opção e o ExperienceSwitcher se esconde (options.length < 2).
  // A ROTA de aluno continua montada para todos (buildAppRoutes); só o seletor muda.
  const ehStaff = hasExperience(access, 'admin') || hasExperience(access, 'atendimento');
  const escondeAluno = hasExperience(access, 'mentor') && !ehStaff;

  const options: ExperienceOption[] = escondeAluno
    ? []
    : [
        {
          id: 'aluno',
          label: 'Aluno',
          description: 'Estudos, simulados e progresso',
          url: '/',
          icon: GraduationCap,
        },
      ];
```

Atualizar o comentário da função: "`aluno` é a base de todo usuário autenticado, por isso entra sempre" vira "`aluno` entra para todos, exceto mentor que não é staff (seletor só para staff)".

Depois do bloco de `atendimento` em `getExperienceOptions`:

```ts
  if (hasExperience(access, 'mentor')) {
    options.push({
      id: 'mentor',
      label: 'Mentor',
      description: 'Sua turma, mural, sessões e intervenções',
      url: '/mentor',
      icon: Users,
    });
  }
```

Em `resolveCurrentExperience`, antes do `return 'aluno';`:

```ts
  if (pathname.startsWith('/mentor')) return 'mentor';
```

- [ ] **Step 7: Implementar `src/utils/experiences.ts`**

```ts
export const EXPERIENCE_ENTRYPOINTS: Record<Exclude<ExperienceId, 'aluno'>, string> = {
  admin: '/admin',
  atendimento: '/atendimento/usuarios',
  mentor: '/mentor',
  gestao: '/gestor',
};

/** Ordem de precedência das experiências dedicadas para a rota default pós-login. */
const ENTRYPOINT_PRECEDENCE: Exclude<ExperienceId, 'aluno'>[] = [
  'admin',
  'atendimento',
  'mentor',
  'gestao',
];
```

Atualizar o comentário de precedência para `admin > atendimento > mentor > gestao > aluno`.

- [ ] **Step 8: Implementar o service**

```ts
// src/services/mentor/contexto.ts
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/** Resumo do mentor logado — `get_mentor_contexto().mentor`. */
export interface MentorResumo {
  user_id: string;
  nome: string;
  email: string;
  tipo: 'b2c' | 'b2b';
  turma_nome: string;
  ies_id: string | null;
  ies_nome: string | null;
  ativo: boolean;
}

/** `mentor` null = o usuário tem o papel, mas o admin ainda não concluiu o cadastro. */
export interface MentorContexto {
  mentor: MentorResumo | null;
  alunos_ativos: number;
}

/**
 * Contexto do mentor logado. A RPC ainda não está nos tipos gerados — mesmo
 * cast documentado em `src/services/admin/contratoSimulados.ts`.
 */
export async function fetchMentorContexto(): Promise<MentorContexto> {
  const { data, error } = await (supabase.rpc as CallableFunction)('get_mentor_contexto', {});
  if (error) {
    Logger.error('[services/mentor/contexto] get_mentor_contexto falhou:', error);
    throw new Error(error.message ?? 'Falha ao carregar o contexto do mentor.');
  }
  return data as MentorContexto;
}
```

- [ ] **Step 9: Implementar o layout, a tela e as rotas**

```tsx
// src/features/mentor/MentorLayout.tsx
import * as React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ExperienceSwitcher } from '@/experiences/shared/ExperienceSwitcher';
import { cn } from '@/lib/utils';

/**
 * Shell mínimo do Portal do Mentor (`/mentor/*`). Onda 1: só o Início.
 * As seções Minha Turma / Visão Geral, Mural, Sessões e Intervenções entram
 * nas próximas ondas, cada uma como item novo em NAV_ITENS.
 */
const NAV_ITENS = [{ title: 'Início', url: '/mentor', icon: Home, end: true }];

export const MentorLayout: React.FC = () => {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card p-4 md:flex">
        <p className="mb-4 font-semibold text-foreground">Portal do Mentor</p>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITENS.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                  isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t pt-3">
          <ExperienceSwitcher />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void logout()} aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
};
```

Antes de escrever o `MentorLayout`, abrir `src/experiences/shared/ExperienceSwitcher.tsx` e conferir o nome do export e as props obrigatórias. Se ele exigir props (ex.: `variant`), copiar exatamente o uso de `src/experiences/admin/AdminLayout.tsx:98`.

```tsx
// src/features/mentor/routes/InicioMentor.tsx
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMentorContexto } from '@/services/mentor/contexto';

/** Início do mentor — Onda 1: turma e nº de alunos. Alertas entram na Onda 2. */
const InicioMentor: React.FC = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mentor', 'contexto'],
    queryFn: fetchMentorContexto,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando sua turma…</p>;
  if (isError) return <p className="text-sm text-destructive">Não foi possível carregar sua turma. Tente de novo em instantes.</p>;

  if (!data?.mentor) {
    return (
      <div className="max-w-xl space-y-2">
        <h1 className="text-2xl font-semibold">Seu cadastro de mentor ainda não foi concluído</h1>
        <p className="text-muted-foreground">Fale com o time de atendimento para vincular sua turma.</p>
      </div>
    );
  }

  const { mentor, alunos_ativos } = data;
  const primeiroNome = mentor.nome.split(' ')[0];

  return (
    <div className="space-y-4">
      <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        {alunos_ativos} {alunos_ativos === 1 ? 'aluno' : 'alunos'} · {mentor.turma_nome}
      </span>
      <h1 className="text-2xl font-semibold">Olá, {primeiroNome}</h1>
      {alunos_ativos === 0 && (
        <p className="text-muted-foreground">Sua turma ainda não tem alunos vinculados.</p>
      )}
    </div>
  );
};

export default InicioMentor;
```

```tsx
// src/features/mentor/mentorRoutes.tsx
import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import { MentorLayout } from '@/features/mentor/MentorLayout';

const InicioMentor = lazy(() => import('@/features/mentor/routes/InicioMentor'));

/** Rotas da experiência Mentor (`/mentor/*`). */
export const mentorRoutes = (): RouteObject[] => [
  {
    path: '/mentor',
    element: (
      <ExperienceGuard experience="mentor">
        <MentorLayout />
      </ExperienceGuard>
    ),
    children: [{ index: true, element: <InicioMentor /> }],
  },
];
```

Em `src/experiences/buildAppRoutes.tsx`, importar `import { mentorRoutes } from '@/features/mentor/mentorRoutes';` e, depois da linha do `atendimento`:

```tsx
    ...(hasExperience(access, 'mentor') ? mentorRoutes() : deniedPortal('/mentor')),
```

Verificar se as rotas filhas de outros portais estão envolvidas em `<React.Suspense>` em algum ponto do shell (procurar `Suspense` em `src/components/DynamicRoutes.tsx`). Se o Suspense estiver só dentro de cada layout, envolver o `<Outlet />` do `MentorLayout` em `<React.Suspense fallback={null}>`.

- [ ] **Step 10: Rodar e ver passar**

Run: `npx vitest run src/test/unit/globalNav.test.ts src/test/unit/experiences.test.ts src/test/unit/buildAppRoutes.test.ts src/test/unit/mentorContexto.test.ts`
Expected: PASS.

- [ ] **Step 11: Suíte completa, type-check e commit**

Run: `npx vitest run && npm run type-check`
Expected: verde; mesma contagem da Task 0 + os testes novos.

```bash
git add src/experiences/shared/globalNav.ts src/utils/experiences.ts src/experiences/buildAppRoutes.tsx src/services/mentor src/features/mentor src/test/unit/globalNav.test.ts src/test/unit/experiences.test.ts src/test/unit/buildAppRoutes.test.ts src/test/unit/mentorContexto.test.ts
git commit -m "feat(mentor): portal /mentor com Inicio, seletor e entrypoint; Gestao vira Gestor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Papel `mentor` aceito no cadastro de usuário

**Files:**
- Modify: `src/components/admin/usuarios/roles.ts:10-19`
- Modify: `src/services/usersService.ts:20`
- Modify: `supabase/functions/b2b-create-user/index.ts:58`
- Test: `src/test/unit/bulkCreateUsersParse.test.ts`

**Interfaces:**
- Produces: `AppUserRole` inclui `'mentor'`; `CreateUserPayload.role` aceita `'mentor'`; a edge aceita `role: 'mentor'`.

- [ ] **Step 1: Teste (falha)**

No `describe('normalizeRoleInput', ...)` de `src/test/unit/bulkCreateUsersParse.test.ts`:

```ts
  it('aceita mentor', () => {
    expect(normalizeRoleInput('Mentor')).toBe('mentor');
    expect(normalizeRoleInput('mentor')).toBe('mentor');
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/test/unit/bulkCreateUsersParse.test.ts`
Expected: FAIL (`null` em vez de `'mentor'`).

- [ ] **Step 3: Implementar**

`roles.ts`:

```ts
export type AppUserRole = 'aluno' | 'admin' | 'professor' | 'gestor' | 'gestor_grupo' | 'atendimento' | 'mentor';

export const ROLE_OPTIONS: { value: AppUserRole; label: string }[] = [
  { value: 'aluno', label: 'Aluno (padrão)' },
  { value: 'admin', label: 'Admin' },
  { value: 'professor', label: 'Professor' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'gestor_grupo', label: 'Gestor de Grupo' },
  { value: 'atendimento', label: 'Atendimento' },
  { value: 'mentor', label: 'Mentor' },
];
```

`usersService.ts`, linha do `role` em `CreateUserPayload`:

```ts
  role?: 'aluno' | 'professor' | 'admin' | 'gestor' | 'gestor_grupo' | 'atendimento' | 'mentor';
```

`b2b-create-user/index.ts:58`:

```ts
  role: z.enum(['admin', 'professor', 'gestor', 'atendimento', 'gestor_grupo', 'mentor']).optional(),
```

- [ ] **Step 4: Rodar e ver passar, type-check**

Run: `npx vitest run src/test/unit/bulkCreateUsersParse.test.ts && npm run type-check`
Expected: PASS. Se o type-check apontar algum `switch` exaustivo sobre `AppUserRole`, acrescentar o caso `'mentor'` com o mesmo tratamento de `'atendimento'`.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/usuarios/roles.ts src/services/usersService.ts supabase/functions/b2b-create-user/index.ts src/test/unit/bulkCreateUsersParse.test.ts
git commit -m "feat(mentor): papel mentor aceito no cadastro de usuarios

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

A edge `b2b-create-user` NÃO é deployada por quem executa o plano. O deploy é do Felipe, junto com as migrations.

---

### Task 5: Services de admin e parser da planilha de alunos

**Files:**
- Create: `src/services/admin/mentores.ts`
- Create: `src/components/admin/mentores/parseVinculosFile.ts`
- Test: `src/test/unit/adminMentores.test.ts`, `src/test/unit/parseVinculosFile.test.ts`

**Interfaces:**
- Consumes: RPCs da Task 1.
- Produces:
  - `listMentores(): Promise<MentorAdmin[]>`
  - `upsertMentor(input: UpsertMentorInput): Promise<{ user_id: string; criado: boolean }>`
  - `importarVinculos(input: { mentorId: string; linhas: LinhaVinculo[]; trocar: boolean; dryRun: boolean }): Promise<ImportacaoResultado>`
  - `encerrarVinculo(vinculoId: string): Promise<{ vinculo_id: string; fim: string }>`
  - `parseVinculosFile(file: File): Promise<LinhaVinculo[]>`; `LinhaVinculo = { email: string; nome?: string }`
  - Tipos `MentorAdmin`, `UpsertMentorInput`, `ImportacaoResultado` exportados de `src/services/admin/mentores.ts`.

- [ ] **Step 1: Testes do service (falham)**

```ts
// src/test/unit/adminMentores.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
vi.mock('@/utils/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { listMentores, upsertMentor, importarVinculos, encerrarVinculo } from '@/services/admin/mentores';

const ok = (data: unknown) => Promise.resolve({ data, error: null });

describe('services/admin/mentores', () => {
  beforeEach(() => mockRpc.mockReset());

  it('listMentores chama admin_list_mentores', async () => {
    mockRpc.mockReturnValue(ok([]));
    await expect(listMentores()).resolves.toEqual([]);
    expect(mockRpc).toHaveBeenCalledWith('admin_list_mentores', {});
  });

  it('upsertMentor manda todos os p_* (ies nula no B2C)', async () => {
    mockRpc.mockReturnValue(ok({ user_id: 'm1', criado: true }));
    await upsertMentor({ userId: 'm1', tipo: 'b2c', turmaNome: 'Tribo Carcará' });
    expect(mockRpc).toHaveBeenCalledWith('admin_upsert_mentor', {
      p_user_id: 'm1',
      p_tipo: 'b2c',
      p_turma_nome: 'Tribo Carcará',
      p_ies_id: null,
      p_foto_url: null,
      p_formacao: null,
      p_link_agendamento: null,
      p_ativo: true,
    });
  });

  it('importarVinculos repassa dry run e trocar', async () => {
    const resultado = {
      dry_run: true, total: 1, novos: 1, ja_com_este_mentor: 0,
      com_outro_mentor: [], invalidos: [], inseridos: 0, trocados: 0,
    };
    mockRpc.mockReturnValue(ok(resultado));
    await expect(
      importarVinculos({ mentorId: 'm1', linhas: [{ email: 'a@x.com' }], trocar: false, dryRun: true }),
    ).resolves.toEqual(resultado);
    expect(mockRpc).toHaveBeenCalledWith('admin_importar_vinculos', {
      p_mentor_id: 'm1',
      p_linhas: [{ email: 'a@x.com' }],
      p_trocar: false,
      p_dry_run: true,
    });
  });

  it('encerrarVinculo chama admin_encerrar_vinculo', async () => {
    mockRpc.mockReturnValue(ok({ vinculo_id: 'v1', fim: '2026-10-08T12:00:00Z' }));
    await encerrarVinculo('v1');
    expect(mockRpc).toHaveBeenCalledWith('admin_encerrar_vinculo', { p_vinculo_id: 'v1' });
  });

  it('erro da RPC vira exceção com a mensagem do banco', async () => {
    mockRpc.mockReturnValue(Promise.resolve({ data: null, error: { message: 'mentor B2B precisa de IES' } }));
    await expect(upsertMentor({ userId: 'm1', tipo: 'b2b', turmaNome: 'FAI' })).rejects.toThrow('mentor B2B precisa de IES');
  });
});
```

- [ ] **Step 2: Testes do parser (falham)**

```ts
// src/test/unit/parseVinculosFile.test.ts
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVinculosFile } from '@/components/admin/mentores/parseVinculosFile';

function planilha(rows: (string | number)[][]): File {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buf], 'alunos.xlsx');
}

describe('parseVinculosFile', () => {
  it('lê email e nome, normalizando o e-mail', async () => {
    const linhas = await parseVinculosFile(planilha([['email', 'nome'], [' Ana@X.com ', 'Ana Lima']]));
    expect(linhas).toEqual([{ email: 'ana@x.com', nome: 'Ana Lima' }]);
  });

  it('aceita cabeçalho "E-mail" com maiúscula e hífen', async () => {
    const linhas = await parseVinculosFile(planilha([['E-mail'], ['bia@x.com']]));
    expect(linhas).toEqual([{ email: 'bia@x.com' }]);
  });

  it('ignora linhas totalmente vazias', async () => {
    const linhas = await parseVinculosFile(planilha([['email'], [''], ['caio@x.com']]));
    expect(linhas).toEqual([{ email: 'caio@x.com' }]);
  });

  it('sem coluna de e-mail: erro claro', async () => {
    await expect(parseVinculosFile(planilha([['nome'], ['Duda']]))).rejects.toThrow('coluna "email"');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/test/unit/adminMentores.test.ts src/test/unit/parseVinculosFile.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 4: Implementar o service**

```ts
// src/services/admin/mentores.ts
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Wrappers das RPCs de admin da Página do Mentor (Onda 1). Mesmo cast de
 * `src/services/admin/contratoSimulados.ts`: as RPCs ainda não estão nos
 * tipos gerados.
 */

export type MentorTipo = 'b2c' | 'b2b';

export interface MentorAdmin {
  user_id: string;
  nome: string;
  email: string;
  tipo: MentorTipo;
  turma_nome: string;
  ies_id: string | null;
  ies_nome: string | null;
  ativo: boolean;
  alunos_ativos: number;
}

export interface UpsertMentorInput {
  userId: string;
  tipo: MentorTipo;
  turmaNome: string;
  iesId?: string | null;
  fotoUrl?: string | null;
  formacao?: string | null;
  linkAgendamento?: string | null;
  ativo?: boolean;
}

export interface LinhaVinculo {
  email: string;
  nome?: string;
}

export interface ImportacaoResultado {
  dry_run: boolean;
  total: number;
  novos: number;
  ja_com_este_mentor: number;
  com_outro_mentor: { email: string; mentor_atual_id: string; mentor_atual_nome: string | null }[];
  invalidos: { ordem: number; email: string; motivo: 'email_invalido' | 'duplicado_na_planilha' }[];
  inseridos: number;
  trocados: number;
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as CallableFunction)(fn, args);
  if (error) {
    Logger.error(`[services/admin/mentores] ${fn} falhou:`, error);
    throw new Error(error.message ?? `Falha ao executar ${fn}.`);
  }
  return data as T;
}

export async function listMentores(): Promise<MentorAdmin[]> {
  return callRpc<MentorAdmin[]>('admin_list_mentores', {});
}

export async function upsertMentor(input: UpsertMentorInput): Promise<{ user_id: string; criado: boolean }> {
  return callRpc('admin_upsert_mentor', {
    p_user_id: input.userId,
    p_tipo: input.tipo,
    p_turma_nome: input.turmaNome,
    p_ies_id: input.iesId ?? null,
    p_foto_url: input.fotoUrl ?? null,
    p_formacao: input.formacao ?? null,
    p_link_agendamento: input.linkAgendamento ?? null,
    p_ativo: input.ativo ?? true,
  });
}

export async function importarVinculos(input: {
  mentorId: string;
  linhas: LinhaVinculo[];
  trocar: boolean;
  dryRun: boolean;
}): Promise<ImportacaoResultado> {
  return callRpc<ImportacaoResultado>('admin_importar_vinculos', {
    p_mentor_id: input.mentorId,
    p_linhas: input.linhas,
    p_trocar: input.trocar,
    p_dry_run: input.dryRun,
  });
}

export async function encerrarVinculo(vinculoId: string): Promise<{ vinculo_id: string; fim: string }> {
  return callRpc('admin_encerrar_vinculo', { p_vinculo_id: vinculoId });
}
```

- [ ] **Step 5: Implementar o parser**

```ts
// src/components/admin/mentores/parseVinculosFile.ts
import * as XLSX from 'xlsx';
import type { LinhaVinculo } from '@/services/admin/mentores';

/** minúsculas, sem acento, sem espaço/hífen/underscore. */
const chave = (valor: string) =>
  valor.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '');

/**
 * Lê a planilha de alunos do mentor (.xlsx ou .csv). Colunas: `email`
 * (obrigatória) e `nome` (opcional). A validação de e-mail, duplicidade e
 * vínculo com outro mentor é do banco (`admin_importar_vinculos` em dry run).
 */
export async function parseVinculosFile(file: File): Promise<LinhaVinculo[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, blankrows: false, defval: '' });
  if (rows.length === 0) return [];

  const header = rows[0].map((c) => chave(String(c ?? '')));
  const iEmail = header.indexOf('email');
  const iNome = header.indexOf('nome');
  if (iEmail < 0) throw new Error('A planilha precisa de uma coluna "email".');

  const linhas: LinhaVinculo[] = [];
  for (const row of rows.slice(1)) {
    const email = String(row[iEmail] ?? '').trim().toLowerCase();
    const nome = iNome >= 0 ? String(row[iNome] ?? '').trim() : '';
    if (!email && !nome) continue;
    linhas.push(nome ? { email, nome } : { email });
  }
  return linhas;
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/test/unit/adminMentores.test.ts src/test/unit/parseVinculosFile.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/admin/mentores.ts src/components/admin/mentores/parseVinculosFile.ts src/test/unit/adminMentores.test.ts src/test/unit/parseVinculosFile.test.ts
git commit -m "feat(mentor): services de admin e parser da planilha de alunos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tela A1 — `/admin/mentores`

**Files:**
- Create: `src/components/admin/mentores/MentoresBoard.tsx`
- Create: `src/components/admin/mentores/CreateMentorDialog.tsx`
- Create: `src/components/admin/mentores/ImportVinculosDialog.tsx`
- Create: `src/experiences/admin/pages/MentoresPage.tsx`
- Modify: `src/experiences/admin/adminRoutes.tsx`, `src/experiences/admin/AdminNav.ts`
- Test: `src/test/unit/buildAppRoutes.test.ts`, `src/test/unit/adminNav.test.ts`, `src/test/components/ImportVinculosDialog.test.tsx` (novo)

**Interfaces:**
- Consumes: `listMentores`, `upsertMentor`, `importarVinculos`, `parseVinculosFile` (Task 5); `usersService.createUser` com `role: 'mentor'` (Task 4).
- Produces: rota filha `mentores` em `/admin`; item de menu "Mentores" com `capability: 'mentores.manage'`.

- [ ] **Step 1: Testes de rota e menu (falham)**

Em `src/test/unit/buildAppRoutes.test.ts`, no teste `'expõe a rota-layout /admin com as 12 seções como filhas (index = Command Center)'`, trocar o título para `13 seções` e a lista esperada para:

```ts
    expect(childPaths).toEqual([
      'index',
      'simulados',
      'monitoramento',
      'usuarios',
      'mentores',
      'ies',
      'contratos',
      'guia',
      'avisos',
      'sanarclass',
      'feedbacks',
      'analytics',
      'auditoria',
    ]);
```

Em `src/test/unit/adminNav.test.ts`, acrescentar:

```ts
it('Mentores aparece em Contas & acesso só com mentores.manage', () => {
  const admin = filterAdminNav(ADMIN_NAV_GROUPS, deriveAccessFromRoles(['admin']));
  const contas = admin.find((g) => g.label === 'Contas & acesso');
  expect(contas?.items.map((i) => i.title)).toContain('Mentores');

  const cx = filterAdminNav(ADMIN_NAV_GROUPS, deriveAccessFromRoles(['atendimento']));
  const tudo = cx.flatMap((g) => g.items.map((i) => i.title));
  expect(tudo).not.toContain('Mentores');
});
```

Conferir os imports no topo de `adminNav.test.ts` (`ADMIN_NAV_GROUPS`, `filterAdminNav`, `deriveAccessFromRoles`) e acrescentar os que faltarem.

- [ ] **Step 2: Teste do diálogo de importação (falha)**

```tsx
// src/test/components/ImportVinculosDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const importarVinculos = vi.fn();
vi.mock('@/services/admin/mentores', () => ({
  importarVinculos: (...a: unknown[]) => importarVinculos(...a),
}));
const parseVinculosFile = vi.fn();
vi.mock('@/components/admin/mentores/parseVinculosFile', () => ({
  parseVinculosFile: (...a: unknown[]) => parseVinculosFile(...a),
}));

import { ImportVinculosDialog } from '@/components/admin/mentores/ImportVinculosDialog';

const base = {
  dry_run: true, total: 3, novos: 1, ja_com_este_mentor: 1,
  com_outro_mentor: [{ email: 'b@x.com', mentor_atual_id: 'm2', mentor_atual_nome: 'Letícia Lima' }],
  invalidos: [], inseridos: 0, trocados: 0,
};

const renderDialog = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ImportVinculosDialog open mentorId="m1" mentorNome="Thiago" onOpenChange={() => {}} />
    </QueryClientProvider>,
  );

describe('ImportVinculosDialog', () => {
  beforeEach(() => {
    importarVinculos.mockReset();
    parseVinculosFile.mockReset();
  });

  it('simula antes de aplicar e mostra quem já tem outro mentor', async () => {
    parseVinculosFile.mockResolvedValue([{ email: 'a@x.com' }, { email: 'b@x.com' }, { email: 'c@x.com' }]);
    importarVinculos.mockResolvedValue(base);
    renderDialog();

    const input = screen.getByLabelText('Planilha de alunos');
    fireEvent.change(input, { target: { files: [new File(['x'], 'alunos.xlsx')] } });

    await waitFor(() =>
      expect(importarVinculos).toHaveBeenCalledWith({ mentorId: 'm1', linhas: expect.any(Array), trocar: false, dryRun: true }),
    );
    expect(await screen.findByText(/b@x\.com/)).toBeInTheDocument();
    expect(screen.getByText(/Letícia Lima/)).toBeInTheDocument();
  });

  it('aplicar chama a RPC sem dry run, respeitando "trocar"', async () => {
    parseVinculosFile.mockResolvedValue([{ email: 'b@x.com' }]);
    importarVinculos.mockResolvedValueOnce(base).mockResolvedValueOnce({ ...base, dry_run: false, inseridos: 2, trocados: 1 });
    renderDialog();

    fireEvent.change(screen.getByLabelText('Planilha de alunos'), { target: { files: [new File(['x'], 'a.xlsx')] } });
    await screen.findByText(/b@x\.com/);

    fireEvent.click(screen.getByLabelText('Trocar o mentor de quem já tem outro'));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar importação' }));

    await waitFor(() =>
      expect(importarVinculos).toHaveBeenLastCalledWith({ mentorId: 'm1', linhas: expect.any(Array), trocar: true, dryRun: false }),
    );
    expect(await screen.findByText(/2 alunos vinculados/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/test/unit/buildAppRoutes.test.ts src/test/unit/adminNav.test.ts src/test/components/ImportVinculosDialog.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Rota e menu**

`adminRoutes.tsx`: `const MentoresPage = lazy(() => import('@/experiences/admin/pages/MentoresPage'));` e, logo depois de `{ path: 'usuarios', element: <UsuariosPage /> },`:

```tsx
      { path: 'mentores', element: <MentoresPage /> },
```

Atualizar o comentário "12 seções" para "13 seções".

`AdminNav.ts`: importar `GraduationCap` de `lucide-react` e, no grupo "Contas & acesso", depois de Usuários:

```ts
      { title: 'Mentores', url: '/admin/mentores', icon: GraduationCap, capability: 'mentores.manage' },
```

Atualizar o comentário "4 grupos, 12 itens" para "4 grupos, 13 itens".

- [ ] **Step 5: Diálogo de importação**

```tsx
// src/components/admin/mentores/ImportVinculosDialog.tsx
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { importarVinculos, type ImportacaoResultado, type LinhaVinculo } from '@/services/admin/mentores';
import { parseVinculosFile } from '@/components/admin/mentores/parseVinculosFile';

interface Props {
  open: boolean;
  mentorId: string;
  mentorNome: string;
  onOpenChange: (open: boolean) => void;
}

const MOTIVO: Record<string, string> = {
  email_invalido: 'e-mail inválido',
  duplicado_na_planilha: 'repetido na planilha',
};

/**
 * Importa os alunos de um mentor (tela A1). Fluxo: escolher arquivo →
 * simulação no banco (dry run) → admin decide se troca quem já tem outro
 * mentor → aplica. Um aluno tem um mentor por vez; trocar encerra o vínculo
 * anterior, sem apagar.
 */
export const ImportVinculosDialog: React.FC<Props> = ({ open, mentorId, mentorNome, onOpenChange }) => {
  const queryClient = useQueryClient();
  const [linhas, setLinhas] = React.useState<LinhaVinculo[]>([]);
  const [simulacao, setSimulacao] = React.useState<ImportacaoResultado | null>(null);
  const [aplicado, setAplicado] = React.useState<ImportacaoResultado | null>(null);
  const [trocar, setTrocar] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [ocupado, setOcupado] = React.useState(false);

  const onArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    setAplicado(null);
    setOcupado(true);
    try {
      const lidas = await parseVinculosFile(file);
      setLinhas(lidas);
      setSimulacao(await importarVinculos({ mentorId, linhas: lidas, trocar: false, dryRun: true }));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível ler a planilha.');
    } finally {
      setOcupado(false);
    }
  };

  const aplicar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await importarVinculos({ mentorId, linhas, trocar, dryRun: false });
      setAplicado(resultado);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'mentores'] });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'A importação falhou.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar alunos de {mentorNome}</DialogTitle>
          <DialogDescription>Planilha .xlsx ou .csv com a coluna "email" (e "nome", opcional).</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="planilha-vinculos">Planilha de alunos</Label>
            <input id="planilha-vinculos" type="file" accept=".xlsx,.xls,.csv" onChange={onArquivo} disabled={ocupado} />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          {simulacao && !aplicado && (
            <div className="space-y-2 text-sm">
              <p>
                {simulacao.total} linhas: {simulacao.novos} novos, {simulacao.ja_com_este_mentor} já são deste mentor,{' '}
                {simulacao.com_outro_mentor.length} com outro mentor, {simulacao.invalidos.length} com problema.
              </p>
              {simulacao.com_outro_mentor.length > 0 && (
                <ul className="max-h-32 overflow-auto rounded border p-2">
                  {simulacao.com_outro_mentor.map((c) => (
                    <li key={c.email}>
                      {c.email} · hoje com {c.mentor_atual_nome ?? 'outro mentor'}
                    </li>
                  ))}
                </ul>
              )}
              {simulacao.invalidos.length > 0 && (
                <ul className="max-h-32 overflow-auto rounded border p-2">
                  {simulacao.invalidos.map((i) => (
                    <li key={i.ordem}>
                      Linha {i.ordem}: {i.email || '(vazio)'} · {MOTIVO[i.motivo] ?? i.motivo}
                    </li>
                  ))}
                </ul>
              )}
              {simulacao.com_outro_mentor.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox id="trocar-mentor" checked={trocar} onCheckedChange={(v) => setTrocar(v === true)} />
                  <Label htmlFor="trocar-mentor">Trocar o mentor de quem já tem outro</Label>
                </div>
              )}
            </div>
          )}

          {aplicado && (
            <p className="text-sm">
              {aplicado.inseridos} alunos vinculados
              {aplicado.trocados > 0 ? `, ${aplicado.trocados} trocados de mentor` : ''}.
            </p>
          )}
        </div>

        <DialogFooter>
          {!aplicado && (
            <Button onClick={aplicar} disabled={!simulacao || ocupado || (simulacao.novos === 0 && !(trocar && simulacao.com_outro_mentor.length > 0))}>
              Aplicar importação
            </Button>
          )}
          {aplicado && <Button onClick={() => onOpenChange(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

- [ ] **Step 6: Diálogo de criação**

```tsx
// src/components/admin/mentores/CreateMentorDialog.tsx
import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { usersService } from '@/services/usersService';
import { upsertMentor, type MentorTipo } from '@/services/admin/mentores';

/** IES âncora da conta de mentor B2C. Nunca a IES "B2B" (ela concede admin no b2b-create-user). */
export const IES_ANCORA_B2C = 'abec7c7d-ef07-4871-9e19-090f4d951e5e';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cria a conta do mentor (edge `b2b-create-user`, papel `mentor`) e o
 * cadastro de mentor (`admin_upsert_mentor`). Um login por perfil: quem é
 * mentor B2C e B2B usa dois e-mails.
 */
export const CreateMentorDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const queryClient = useQueryClient();
  const [nome, setNome] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [tipo, setTipo] = React.useState<MentorTipo>('b2c');
  const [turma, setTurma] = React.useState('');
  const [iesId, setIesId] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);
  const [ocupado, setOcupado] = React.useState(false);

  const { data: iesList = [] } = useQuery({
    queryKey: ['admin', 'ies-lista'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ies').select('id, nome').order('nome');
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const valido = nome.trim() && email.includes('@') && turma.trim() && (tipo === 'b2c' || iesId);

  const salvar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const conta = await usersService.createUser({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        id_ies: tipo === 'b2b' ? iesId : IES_ANCORA_B2C,
        role: 'mentor',
      });
      if (!conta.success || !conta.userId) throw new Error(conta.error ?? 'Não foi possível criar a conta.');
      await upsertMentor({ userId: conta.userId, tipo, turmaNome: turma.trim(), iesId: tipo === 'b2b' ? iesId : null });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'mentores'] });
      onOpenChange(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao cadastrar o mentor.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo mentor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="mentor-nome">Nome</Label>
            <Input id="mentor-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mentor-email">E-mail de login</Label>
            <Input id="mentor-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as MentorTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="b2c">B2C (Minha Turma)</SelectItem>
                <SelectItem value="b2b">B2B (Visão Geral)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="mentor-turma">Nome da turma</Label>
            <Input id="mentor-turma" placeholder="Ex.: Tribo Carcará" value={turma} onChange={(e) => setTurma(e.target.value)} />
          </div>
          {tipo === 'b2b' && (
            <div className="space-y-1">
              <Label>Instituição</Label>
              <Select value={iesId} onValueChange={setIesId}>
                <SelectTrigger><SelectValue placeholder="Escolha a IES" /></SelectTrigger>
                <SelectContent>
                  {iesList.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={!valido || ocupado}>Cadastrar mentor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

- [ ] **Step 7: Board e página**

```tsx
// src/components/admin/mentores/MentoresBoard.tsx
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { AdminLoading, AdminError, AdminEmpty } from '@/experiences/admin/ui';
import { listMentores, type MentorAdmin } from '@/services/admin/mentores';
import { CreateMentorDialog } from './CreateMentorDialog';
import { ImportVinculosDialog } from './ImportVinculosDialog';

type Filtro = 'todos' | 'b2c' | 'b2b';

/** Lista de mentores (tela A1): busca, filtro por tipo, criar e importar alunos. */
export const MentoresBoard: React.FC = () => {
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'mentores'],
    queryFn: listMentores,
  });
  const [busca, setBusca] = React.useState('');
  const [filtro, setFiltro] = React.useState<Filtro>('todos');
  const [criando, setCriando] = React.useState(false);
  const [importando, setImportando] = React.useState<MentorAdmin | null>(null);

  const visiveis = data.filter(
    (m) =>
      (filtro === 'todos' || m.tipo === filtro) &&
      `${m.nome} ${m.email} ${m.turma_nome}`.toLowerCase().includes(busca.toLowerCase()),
  );

  if (isLoading) return <AdminLoading />;
  if (isError) return <AdminError onRetry={() => void refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Buscar mentor"
          className="h-9 rounded-md border px-3 text-sm"
          placeholder="Buscar por nome, e-mail ou turma"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {(['todos', 'b2c', 'b2b'] as Filtro[]).map((f) => (
          <Button key={f} size="sm" variant={filtro === f ? 'default' : 'outline'} onClick={() => setFiltro(f)}>
            {f === 'todos' ? 'Todos' : f.toUpperCase()}
          </Button>
        ))}
        <Button className="ml-auto" onClick={() => setCriando(true)}>Novo mentor</Button>
      </div>

      {visiveis.length === 0 ? (
        <AdminEmpty title="Nenhum mentor encontrado" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2">Mentor</th><th>Tipo</th><th>Turma</th><th>Alunos</th><th>Status</th><th />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((m) => (
              <tr key={m.user_id} className="border-t">
                <td className="py-2">
                  <div className="font-medium">{m.nome}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </td>
                <td>{m.tipo.toUpperCase()}</td>
                <td>{m.turma_nome}{m.ies_nome ? ` · ${m.ies_nome}` : ''}</td>
                <td>{m.alunos_ativos}</td>
                <td>{m.ativo ? 'Ativo' : 'Inativo'}</td>
                <td className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setImportando(m)}>Importar alunos</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <CreateMentorDialog open={criando} onOpenChange={setCriando} />
      {importando && (
        <ImportVinculosDialog
          open
          mentorId={importando.user_id}
          mentorNome={importando.nome}
          onOpenChange={(o) => !o && setImportando(null)}
        />
      )}
    </div>
  );
};
```

Antes de usar `AdminLoading`, `AdminError` e `AdminEmpty`, abrir `src/experiences/admin/ui/AdminError.tsx` e `AdminEmpty.tsx` e conferir os nomes das props (`onRetry`, `title`). Ajustar a chamada ao que existir; não mudar os componentes.

```tsx
// src/experiences/admin/pages/MentoresPage.tsx
import * as React from 'react';
import { AdminSectionHeader } from '@/experiences/admin/ui';
import { MentoresBoard } from '@/components/admin/mentores/MentoresBoard';

/** Seção "Mentores" do Portal do Admin (`/admin/mentores`) — tela A1 do handoff. */
const MentoresPage: React.FC = () => (
  <div className="space-y-6">
    <AdminSectionHeader
      title="Mentores"
      subtitle="Cadastre mentores B2C e B2B e importe os alunos de cada turma. Um aluno tem um mentor por vez."
    />
    <MentoresBoard />
  </div>
);

export default MentoresPage;
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run src/test/unit/buildAppRoutes.test.ts src/test/unit/adminNav.test.ts src/test/components/ImportVinculosDialog.test.tsx`
Expected: PASS.

- [ ] **Step 9: Suíte completa, type-check e commit**

Run: `npx vitest run && npm run type-check`
Expected: verde.

```bash
git add src/components/admin/mentores src/experiences/admin/pages/MentoresPage.tsx src/experiences/admin/adminRoutes.tsx src/experiences/admin/AdminNav.ts src/test/unit/buildAppRoutes.test.ts src/test/unit/adminNav.test.ts src/test/components/ImportVinculosDialog.test.tsx
git commit -m "feat(mentor): tela A1 de mentores no admin (cadastro e importacao de alunos)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Contrato da API de Mentoria (documento para a reunião de 13/10)

**Files:**
- Create: `docs/mentoria/api-de-mentoria-contrato.md`

Não há código nesta task: é o rascunho que o time do Flix vai revisar. O formato precisa ser concreto o bastante para eles estimarem.

- [ ] **Step 1: Escrever o documento**

````markdown
# API de Mentoria · contrato (rascunho v0, 08/10/2026)

Servida pelo Academy (Supabase Edge Function `mentoria-api`), consumida pela
Página do Mentorando no SanarFlix PRO ENAMED.

## Autenticação

- Header `Authorization: Bearer <ID token Cognito do aluno>`.
- A API valida a assinatura pelo JWKS do user pool e lê o claim `userId`
  (confirmado: igual ao `user.id` do `GET /user`).
- Alternativa em discussão: chamada via proxy no BFF, com credencial de
  serviço e o `userId` num header. Decidir na reunião de 13/10.

## Rotas

### GET /mentoria/me
Quem é o mentor do aluno e se ele precisa de onboarding.

```json
{
  "tem_mentor": true,
  "mentor": {
    "nome": "Thiago Taniguchi",
    "foto_url": "https://…",
    "formacao": "Residente em …",
    "turma_nome": "Tribo Carcará",
    "link_agendamento": null
  },
  "agendamento_liberado": false,
  "mensagem_liberacao": null
}
```
`tem_mentor: false` → a página mostra o onboarding (escolha de tribo).

### GET /mentoria/mural?aba=coletivo|pra-voce&cursor=…
```json
{
  "itens": [
    {
      "id": "uuid",
      "tag": "desempenho | aviso | fique_por_dentro",
      "titulo": "…",
      "mensagem": "…",
      "link": { "titulo": "…", "url": "https://…" },
      "anexo": { "nome": "…", "url": "https://… (assinada, 1h)" },
      "publicado_em": "2026-10-08T12:00:00-03:00"
    }
  ],
  "proximo_cursor": null,
  "tem_pra_voce": true
}
```
`tem_pra_voce: false` → a aba "Pra você" não aparece.

### GET /mentoria/sessoes?quando=proximas|realizadas
```json
{
  "itens": [
    {
      "id": "uuid",
      "tipo": "coletiva | individual",
      "titulo": "…",
      "mentor_nome": "…",
      "inicio": "2026-10-15T19:00:00-03:00",
      "meet_link": "https://meet.google.com/…",
      "gravacao_url": null
    }
  ]
}
```
Próximas: só as do mentor do aluno. Realizadas: de todos os mentores
(substitui o payload do toggle `sanarflix-mentorships-upcoming`).

### Onboarding (escolha de tribo)
Não passa por esta API. Decisão de 08/10: o vínculo aluno × mentor mora no
SGI. O onboarding do Flix grava a escolha no SGI e ela chega ao Academy pela
tabela de alunos sincronizada pelo time de dados. Em aberto para 13/10: o SGI
já tem esse campo ou precisa de tabela nova no banco do Flix?

## Erros
`401` token inválido · `404` aluno sem cadastro PRO · `429` limite de taxa.
Corpo: `{ "erro": "codigo", "mensagem": "texto em pt-BR" }`.

## Em aberto (reunião de 13/10)
1. Front direto ou proxy no BFF.
2. Domínios de CORS (web e app).
3. Campo de mentoria no SGI: existe ou vira tabela nova no banco do Flix?
4. Paginação do mural: cursor ou página.
````

- [ ] **Step 2: Commit**

```bash
git add docs/mentoria/api-de-mentoria-contrato.md
git commit -m "docs(mentor): rascunho do contrato da API de Mentoria para o Flix

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Verificação final e entrega para aplicação

- [ ] **Step 1: Suíte, type-check e build**

```bash
npx vitest run && npm run type-check && npm run build
```
Expected: tudo verde. Lint não é critério (o CI de lint está morto; ver memória `deploy-vercel-ci`).

- [ ] **Step 2: Conferir colisão de migrations**

```bash
ls supabase/migrations | cut -c1-14 | sort | uniq -d
```
Expected: vazio. Se `20261008120000`/`…0100`/`…0200` colidirem com algo que chegou na `main`, renomear para o próximo timestamp livre.

- [ ] **Step 3: Abrir o PR (sem merge)**

```bash
git push -u origin feat/mentor-fundacao
gh pr create --title "Pagina do Mentor · Onda 1 (fundacao)" --body "<resumo + ordem de aplicação abaixo>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Ordem de aplicação para o Felipe (vai no corpo do PR):
1. `20261008120000_app_role_mentor.sql` (sozinho).
2. `20261008120100_mentoria_fundacao.sql`.
3. `20261008120200_mentoria_rpcs_admin.sql`.
4. Deploy da edge `b2b-create-user`.
5. Merge do front (o Vercel publica a partir da `main`).

O front antes do banco é seguro: sem o papel `mentor`, ninguém recebe a experiência; a página `/admin/mentores` mostraria erro de RPC inexistente, então o merge vem por último.

---

**Aplicado em produção (gvqv) em 09/10/2026**, pelo MCP do Supabase, a pedido do Felipe. Os arquivos foram renomeados para as versões gravadas em `supabase_migrations.schema_migrations`: `20261009125338_app_role_mentor`, `20261009125425_mentoria_fundacao`, `20261009125504_mentoria_rpcs_admin` e a correção `20261009125601_mentoria_revoga_anon` (tira EXECUTE do papel anon nas seis funções novas, apontado pelo advisor). Verificado depois: `get_access` devolve para admin/gestor/CX o mesmo de antes (admin +`mentores.manage`). Edge `b2b-create-user` e front ainda NÃO publicados.
