# Rollout faseado por IES do Portal do Gestor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reintroduzir um gate de rollout por IES no Portal do Gestor — toda IES nasce no console antigo restaurado (com seu export original) e é migrada individualmente para o portal novo por uma ativação manual no banco, depois de vídeo tutorial + OK da faculdade.

**Architecture:** Duas árvores de UI convivendo sob o mesmo `/gestor`: o console antigo (`src/experiences/gestor/**`, restaurado do commit `58226452^`) e o portal novo (`src/features/gestor/**`, já em produção). Uma RPC nova (`get_gestor_portal_versao`) decide em runtime qual delas montar, por usuário/IES, com um `bool_and` sobre as IES acessíveis (mais rígido que o antigo `bool_or` — protege contra `gestor_grupo` misto). O export antigo volta junto com o console antigo, inalterado; o export novo já vive exclusivamente dentro do portal novo.

**Tech Stack:** React + react-router-dom, Supabase (Postgres/RPCs, `SECURITY DEFINER`), Vitest.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-08-11-rollout-faseado-portal-gestor-design.md` — qualquer dúvida de escopo/decisão de produto remete a ela.
- **Nenhum arquivo de migration existente é editado.** `20260807030000_gestor_remove_guard_feature_acesso_por_papel.sql`, `20260807031000_gestor_apaga_chaves_de_feature.sql` e `20260806144647_gestor_remove_guard_portal_v2_ga_total.sql` ficam intocados — há testes (`src/test/unit/gestorMigrationsAcessoPorPapel.test.ts`) que travam o conteúdo textual deles.
- **Nenhuma das 9 RPCs `get_institutional_*`/`get_theme_evolution`/`get_simulado_tem_tri`/`get_ies_student_count` é recriada.** O corpo real delas em produção pode ter divergido do `.sql` versionado (guard injetado via `EXECUTE`) — reescrevê-las do zero arriscaria reverter esse guard. Elas voltam a funcionar só por reinserção de dados de configuração (`feature_catalog`/`ies_features`).
- Migrations novas usam timestamp posterior a `20260811125227` (a mais recente do repo hoje) e nome descritivo em snake_case — nunca o formato `<timestamp>_<uuid>.sql` (esse é reservado ao agente do Lovable).
- Arquivos restaurados do console antigo mantêm o conteúdo **idêntico** ao de `58226452^`, exceto os ajustes pontuais listados explicitamente na Task 6 (imports que apontam para código que não existe mais).
- Ordem de execução das tasks importa: 1→2→3 (banco) antes de 4→5→6→7 (frontend) — replica a "ordem de aplicação" da spec (a chave que habilita precisa estar populada antes do front que passa a exigi-la).

---

### Task 1: Migration — restaurar chaves de módulo + criar toggle de rollout

**Files:**
- Create: `supabase/migrations/20260811140000_gestor_restaura_console_antigo_toggle_rollout.sql`
- Test: `src/test/unit/gestorMigrationsRestauraToggleRollout.test.ts`

**Interfaces:**
- Produces: chaves `gestao.enabled`, `gestao.exportar`, `gestao.ia` em `feature_catalog` + linhas `enabled=true` em `ies_features` para todas as IES de `public.ies`; chave `gestao.portal_v2` em `feature_catalog` sem nenhuma linha em `ies_features`. Tasks 3 e 7 leem `gestao.portal_v2` por `ies_features` (ausência de linha = console antigo).

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260811140000_gestor_restaura_console_antigo_toggle_rollout.sql
--
-- Reintroduz o gate de rollout faseado por IES no Portal do Gestor.
-- Contexto: docs/superpowers/specs/2026-08-11-rollout-faseado-portal-gestor-design.md
--
-- PARTE 1: restaura as 3 chaves de MÓDULO CONTRATADO que a migration
-- 20260807031000 apagou (gestao.enabled/exportar/ia). São pré-condição para
-- as RPCs get_institutional_* (console antigo) pararem de levantar
-- 'feature_not_enabled' -- o corpo delas NÃO é tocado aqui, só os dados de
-- configuração que elas leem via user_has_feature('gestao.enabled').
--
-- Decisão explícita (Felipe, 11/08): as 24 IES -- não só as 14 que já tinham
-- a linha antes -- recebem enabled=true nas 3 chaves, inclusive as 10 que
-- nunca tiveram linha (estado ambíguo "não contratou" vs "esqueceram").
insert into public.feature_catalog (key, experience, label, description, sort_order, is_master, active)
values
  ('gestao.enabled',  'gestao', 'Portal do Gestor',    'Master: liga/desliga o portal do gestor inteiro para a IES', 100, true,  true),
  ('gestao.exportar', 'gestao', 'Exportar Relatórios', 'Exportação de relatórios institucionais',                    160, false, true),
  ('gestao.ia',       'gestao', 'Assistente IA',       'Assistente de IA do gestor (protótipo)',                     170, false, true)
on conflict (key) do update set
  experience  = excluded.experience,
  label       = excluded.label,
  description = excluded.description,
  sort_order  = excluded.sort_order,
  is_master   = excluded.is_master,
  active      = excluded.active;

insert into public.ies_features (ies_id, feature_key, enabled)
select i.id, k.feature_key, true
from public.ies i
cross join (values ('gestao.enabled'), ('gestao.exportar'), ('gestao.ia')) as k(feature_key)
on conflict (ies_id, feature_key) do update set
  enabled    = true,
  updated_at = now();

-- PARTE 2: chave NOVA, com semântica diferente da antiga -- não é mais
-- "módulo contratado" (isso agora é gestao.enabled, acima). É o toggle do
-- rollout faseado: ligada = portal novo (Início/Visão Geral/Detalhamento);
-- desligada OU SEM LINHA = console antigo (5 telas). Nasce SEM nenhuma linha
-- em ies_features -- toda IES começa no console antigo. Ativação por IES é
-- uma UPDATE/INSERT manual, feita depois do vídeo tutorial + OK da faculdade:
--
--   insert into public.ies_features (ies_id, feature_key, enabled)
--   values ('<uuid-da-ies>', 'gestao.portal_v2', true)
--   on conflict (ies_id, feature_key) do update set enabled = true, updated_at = now();
insert into public.feature_catalog (key, experience, label, description, sort_order, is_master, active)
values (
  'gestao.portal_v2',
  'gestao',
  'Portal do Gestor v2 (rollout)',
  'Toggle de migração faseada por IES: ligado = portal novo; desligado = console antigo. Ativado manualmente por IES após vídeo tutorial + OK da faculdade.',
  180,
  false,
  true
)
on conflict (key) do update set
  experience  = excluded.experience,
  label       = excluded.label,
  description = excluded.description,
  sort_order  = excluded.sort_order,
  is_master   = excluded.is_master,
  active      = excluded.active;
```

- [ ] **Step 2: Escrever o teste estático (mesmo padrão de `gestorMigrationsAcessoPorPapel.test.ts`)**

```ts
// src/test/unit/gestorMigrationsRestauraToggleRollout.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260811140000_gestor_restaura_console_antigo_toggle_rollout.sql',
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf8').replace(/\r\n/g, '\n');
}

describe('migration 20260811140000 - restaura toggle de rollout do console antigo', () => {
  it('restaura as 3 chaves de módulo em feature_catalog', () => {
    const sql = readMigration();
    expect(sql).toContain("'gestao.enabled'");
    expect(sql).toContain("'gestao.exportar'");
    expect(sql).toContain("'gestao.ia'");
  });

  it('libera as 3 chaves de módulo para TODAS as IES de public.ies, não uma lista fixa de ids', () => {
    const sql = readMigration();
    expect(sql).toMatch(/insert into public\.ies_features[\s\S]*?from public\.ies i/i);
    expect(sql).not.toMatch(/values\s*\(\s*'[0-9a-f-]{36}'/i);
  });

  it('cria a chave gestao.portal_v2 em feature_catalog', () => {
    const sql = readMigration();
    expect(sql).toContain("'gestao.portal_v2'");
  });

  it('NÃO insere nenhuma linha de gestao.portal_v2 em ies_features (toda IES nasce no console antigo)', () => {
    const sql = readMigration();
    const insertsDeIesFeatures = sql.match(/insert into public\.ies_features[\s\S]*?;/gi) ?? [];
    for (const bloco of insertsDeIesFeatures) {
      expect(bloco).not.toContain('gestao.portal_v2');
    }
  });

  it('não edita nenhuma migration existente (arquivo é só INSERT, sem DELETE/ALTER/DROP)', () => {
    const sql = readMigration();
    expect(sql).not.toMatch(/\b(delete|alter table|drop)\b/i);
  });
});
```

- [ ] **Step 3: Rodar o teste**

Run: `npx vitest run src/test/unit/gestorMigrationsRestauraToggleRollout.test.ts`
Expected: 5 testes, todos PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260811140000_gestor_restaura_console_antigo_toggle_rollout.sql src/test/unit/gestorMigrationsRestauraToggleRollout.test.ts
git commit -m "feat(gestor): restaura chaves de modulo e cria toggle de rollout por IES"
```

**Nota de operação (fora do código, para quem for aplicar em produção):** esta migration não é aplicada por push — o banco deste projeto recebe DDL por caminho manual (ver memória `cx-feedback-migration-pendente`). Aplicar via o mesmo processo já usado nas migrations de 07/08.

---

### Task 2: Migration — `get_user_ies_id()` com fallback para `gestor_grupo`

**Files:**
- Create: `supabase/migrations/20260811141000_get_user_ies_id_fallback_gestor_grupo.sql`
- Test: `src/test/unit/gestorMigrationsGetUserIesIdFallback.test.ts`

**Interfaces:**
- Consumes: `public.get_accessible_ies(_user uuid) RETURNS uuid[]` (já existe, vigente em `supabase/migrations/20260807071431_406b9519-5233-4d5d-9788-f552cde063bb.sql`).
- Produces: `public.get_user_ies_id() RETURNS uuid` continua com a mesma assinatura (sem parâmetros); Task 4 (`src/services/institutional.ts:resolveIesId`) depende dela sem nenhuma mudança de chamada.

**Motivação:** o console antigo resolve a IES do usuário via `get_user_ies_id()`, que só lê `users.id_ies`. O papel `gestor_grupo` (multi-IES via `user_groups`) não existia quando o console antigo foi apagado e tem `id_ies` nulo — a função devolveria `NULL` e `resolveIesId` (`src/services/institutional.ts`) lançaria "IES do usuário não encontrada".

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260811141000_get_user_ies_id_fallback_gestor_grupo.sql
--
-- get_user_ies_id() só lia users.id_ies, que é NULL para gestor_grupo (papel
-- formalizado em 07/08, depois que o console antigo -- único chamador desta
-- função -- foi apagado). Sem fallback, um gestor_grupo quebra o console
-- antigo com "IES do usuário não encontrada" (src/services/institutional.ts).
--
-- Fallback: primeira IES de get_accessible_ies(), mesmo padrão já usado pelas
-- RPCs get_gestor_* para resolver v_ies quando users.id_ies é nulo. Não é uma
-- experiência multi-IES de verdade dentro do console antigo (ele nunca teve
-- seletor para isso) -- é o suficiente para não quebrar.
CREATE OR REPLACE FUNCTION public.get_user_ies_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_ies_id UUID;
BEGIN
  SELECT id_ies INTO user_ies_id
  FROM public.users
  WHERE id = auth.uid();

  IF user_ies_id IS NULL THEN
    SELECT (public.get_accessible_ies(auth.uid()))[1] INTO user_ies_id;
  END IF;

  RETURN user_ies_id;
END;
$$;
```

- [ ] **Step 2: Escrever o teste estático de regressão**

```ts
// src/test/unit/gestorMigrationsGetUserIesIdFallback.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function readMigration(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8').replace(/\r\n/g, '\n');
}

function migrationsOrdenadas(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/** A migration mais recente que recria a função é a vigente. */
function vigente(nome: string): { arquivo: string; sql: string } {
  const marca = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${nome}\\(`, 'i');
  const candidatos = migrationsOrdenadas()
    .map((arquivo) => ({ arquivo, sql: readMigration(arquivo) }))
    .filter(({ sql }) => marca.test(sql));
  const ultima = candidatos[candidatos.length - 1];
  if (!ultima) throw new Error(`Nenhuma migration recria ${nome}`);
  return ultima;
}

describe('get_user_ies_id() - fallback para gestor_grupo', () => {
  it('a versão vigente é a migration 20260811141000', () => {
    const { arquivo } = vigente('get_user_ies_id');
    expect(arquivo).toBe('20260811141000_get_user_ies_id_fallback_gestor_grupo.sql');
  });

  it('continua lendo users.id_ies primeiro (não quebra o caminho de gestor puro)', () => {
    const { sql } = vigente('get_user_ies_id');
    expect(sql).toMatch(/SELECT id_ies INTO user_ies_id\s+FROM public\.users\s+WHERE id = auth\.uid\(\)/i);
  });

  it('cai em get_accessible_ies quando id_ies é nulo', () => {
    const { sql } = vigente('get_user_ies_id');
    expect(sql).toMatch(/IF user_ies_id IS NULL THEN/i);
    expect(sql).toMatch(/get_accessible_ies\(auth\.uid\(\)\)\)\[1\]/);
  });

  it('mantém a assinatura sem parâmetros e RETURNS uuid', () => {
    const { sql } = vigente('get_user_ies_id');
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.get_user_ies_id\(\)\s*\nRETURNS uuid/i);
  });
});
```

- [ ] **Step 3: Rodar o teste**

Run: `npx vitest run src/test/unit/gestorMigrationsGetUserIesIdFallback.test.ts`
Expected: 4 testes, todos PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260811141000_get_user_ies_id_fallback_gestor_grupo.sql src/test/unit/gestorMigrationsGetUserIesIdFallback.test.ts
git commit -m "fix(gestor): get_user_ies_id cai em get_accessible_ies para gestor_grupo"
```

---

### Task 3: Migration — RPC `get_gestor_portal_versao()`

**Files:**
- Create: `supabase/migrations/20260811142000_get_gestor_portal_versao.sql`
- Test: `src/test/unit/gestorMigrationsPortalVersao.test.ts`

**Interfaces:**
- Consumes: `public.has_role(uuid, app_role)`, `public.get_accessible_ies(uuid)`, tabela `public.ies_features`.
- Produces: `public.get_gestor_portal_versao() RETURNS boolean` — `true` = portal novo, `false` = console antigo. Task 7 (`useGestorPortalVersao` hook) chama exatamente esta RPC, sem parâmetros.

**Por que uma RPC nova, em vez de reusar `get_effective_features`/`hasFeature`:** `get_effective_features` decide feature por **`bool_or`** sobre as IES acessíveis (correto para `gestao.enabled`, um master de "tem o módulo" — basta uma IES ter para o usuário ser considerado assinante). O rollout por IES exige o oposto: um `gestor_grupo` só vê o portal novo quando **todas** as IES do grupo já foram aprovadas (decisão da spec, evita tela híbrida). Isso exige `bool_and`, que `get_effective_features` não calcula para nenhuma chave hoje — dedicar uma RPC evita reescrever o mecanismo genérico de feature só para inverter a semântica de uma chave.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260811142000_get_gestor_portal_versao.sql
--
-- Decide, para o usuário autenticado, se ele vê o portal novo (Início/Visão
-- Geral/Detalhamento) ou o console antigo (5 telas) -- ver
-- docs/superpowers/specs/2026-08-11-rollout-faseado-portal-gestor-design.md.
--
-- Regra por papel:
--   admin        -> sempre portal novo (dogfooding; sem escapatoria nesta RPC).
--   gestor_grupo -> true SOMENTE SE gestao.portal_v2 = true para TODAS as IES
--                   acessiveis (get_accessible_ies) -- bool_and, nao bool_or.
--                   Uma IES do grupo ainda nao aprovada mantem o grupo inteiro
--                   no console antigo.
--   gestor puro  -> true SOMENTE SE gestao.portal_v2 = true para a sua unica
--                   IES (users.id_ies).
--   sem papel de gestao -> false (nunca deveria ser chamado nesse caso; o
--                   ExperienceGuard ja barra antes).
--
-- Ausencia de linha em ies_features para 'gestao.portal_v2' conta como false
-- (console antigo) -- e o estado em que toda IES nasce apos a Task 1.
CREATE OR REPLACE FUNCTION public.get_gestor_portal_versao()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_ies_list uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(v_uid, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  IF public.has_role(v_uid, 'gestor_grupo'::public.app_role) THEN
    v_ies_list := COALESCE(public.get_accessible_ies(v_uid), ARRAY[]::uuid[]);
  ELSIF public.has_role(v_uid, 'gestor'::public.app_role) THEN
    SELECT COALESCE(array_agg(u.id_ies), ARRAY[]::uuid[]) INTO v_ies_list
    FROM public.users u
    WHERE u.id = v_uid AND u.id_ies IS NOT NULL;
  ELSE
    RETURN false;
  END IF;

  IF v_ies_list IS NULL OR array_length(v_ies_list, 1) IS NULL THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM unnest(v_ies_list) AS ies(id)
    WHERE COALESCE(
      (SELECT f.enabled FROM public.ies_features f
       WHERE f.ies_id = ies.id AND f.feature_key = 'gestao.portal_v2'),
      false
    ) = false
  );
END;
$function$;
```

- [ ] **Step 2: Escrever o teste estático**

```ts
// src/test/unit/gestorMigrationsPortalVersao.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260811142000_get_gestor_portal_versao.sql',
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf8').replace(/\r\n/g, '\n');
}

describe('get_gestor_portal_versao()', () => {
  it('admin sempre retorna true, sem depender de ies_features', () => {
    const sql = readMigration();
    expect(sql).toMatch(/IF public\.has_role\(v_uid, 'admin'::public\.app_role\) THEN\s*\n\s*RETURN true;/);
  });

  it('gestor_grupo resolve a lista de IES via get_accessible_ies', () => {
    const sql = readMigration();
    expect(sql).toMatch(/has_role\(v_uid, 'gestor_grupo'::public\.app_role\)[\s\S]{0,80}get_accessible_ies\(v_uid\)/);
  });

  it('usa NOT EXISTS sobre a lista de IES (bool_and), não bool_or', () => {
    const sql = readMigration();
    expect(sql).toMatch(/NOT EXISTS/i);
    expect(sql).not.toMatch(/bool_or/i);
  });

  it('ausência de linha em ies_features conta como false (COALESCE ... false)', () => {
    const sql = readMigration();
    expect(sql).toMatch(/COALESCE\(\s*\(SELECT f\.enabled FROM public\.ies_features f[\s\S]*?\),\s*false\s*\)/);
  });

  it('sem papel de gestão retorna false', () => {
    const sql = readMigration();
    expect(sql).toMatch(/ELSE\s*\n\s*RETURN false;/);
  });
});
```

- [ ] **Step 3: Rodar o teste**

Run: `npx vitest run src/test/unit/gestorMigrationsPortalVersao.test.ts`
Expected: 5 testes, todos PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260811142000_get_gestor_portal_versao.sql src/test/unit/gestorMigrationsPortalVersao.test.ts
git commit -m "feat(gestor): RPC get_gestor_portal_versao decide console antigo x portal novo por IES"
```

---

### Task 4: Restaurar a camada de dados do console antigo

**Files:**
- Create (via `git show`, conteúdo idêntico a `58226452^`): `src/services/institutional.ts`, `src/hooks/useInstitutionalPerformanceData.ts`, `src/hooks/useDesempenhoV2State.ts`, `src/utils/mapInstitutionalData.ts`, `src/utils/desempenhoV2Filters.ts`, `src/types/desempenhoV2.ts`, `src/mocks/desempenhoInstitucionalV2.ts`

**Interfaces:**
- Produces: `resolveIesId`, `fetchInstitutionalPerformance`, `fetchStudentScores`, `fetchInstitutionalEvolution`, `fetchInstitutionalTri*`, `fetchSimuladoTemTri`, `fetchIesStudentCount`, `fetchStudentGrowthTri`, `fetchAlunoContato` (de `src/services/institutional.ts`); hook `useInstitutionalPerformanceData(filters)`; hook `useDesempenhoV2State()`; tipo `InstitutionalViewModel` e `DesempenhoV2Tab` (de `src/types/desempenhoV2.ts`). Task 5 e Task 6 importam esses símbolos sem alteração de nome.

- [ ] **Step 1: Restaurar os arquivos**

```bash
mkdir -p src/mocks
git show 58226452^:src/services/institutional.ts > src/services/institutional.ts
git show 58226452^:src/hooks/useInstitutionalPerformanceData.ts > src/hooks/useInstitutionalPerformanceData.ts
git show 58226452^:src/hooks/useDesempenhoV2State.ts > src/hooks/useDesempenhoV2State.ts
git show 58226452^:src/utils/mapInstitutionalData.ts > src/utils/mapInstitutionalData.ts
git show 58226452^:src/utils/desempenhoV2Filters.ts > src/utils/desempenhoV2Filters.ts
git show 58226452^:src/types/desempenhoV2.ts > src/types/desempenhoV2.ts
git show 58226452^:src/mocks/desempenhoInstitucionalV2.ts > src/mocks/desempenhoInstitucionalV2.ts
```

- [ ] **Step 2: Checar se algum import desses arquivos aponta para algo que não existe mais**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "institutional|desempenhoV2|useDesempenhoV2State"`

Expected: idealmente vazio. Se aparecer erro de import quebrado (ex.: `withRetry` de `@/utils/networkRetry`, `Logger` de `@/utils/logger`, `withTimeout` local), abra o arquivo alvo do import e confirme se ele ainda existe com o mesmo nome exportado — esses três são utilitários genéricos usados em dezenas de outros arquivos ativos hoje, então a expectativa é que sigam intactos. Se algum símbolo específico realmente sumiu (não o arquivo inteiro), ajuste **só a linha do import** no arquivo restaurado para o equivalente atual — não invente um novo utilitário. Se o arquivo inteiro sumiu sem substituto, pare e escale para o Felipe antes de prosseguir — é sinal de que a Task 4 depende de mais uma peça que a spec não previu.

- [ ] **Step 3: Commit**

```bash
git add src/services/institutional.ts src/hooks/useInstitutionalPerformanceData.ts src/hooks/useDesempenhoV2State.ts src/utils/mapInstitutionalData.ts src/utils/desempenhoV2Filters.ts src/types/desempenhoV2.ts src/mocks/desempenhoInstitucionalV2.ts
git commit -m "restore(gestor): camada de dados do console antigo (services/hooks/utils/types/mocks)"
```

---

### Task 5: Restaurar a UI do console antigo (`analytics/v2` + exportadores)

**Files:**
- Create (via `git show`, conteúdo idêntico a `58226452^`): os 25 arquivos de `src/components/analytics/v2/**` listados no Step 1, mais `src/utils/institutionalReportPdf.ts` e `src/utils/institutionalReportXlsx.ts`

**Interfaces:**
- Consumes: tudo que a Task 4 produziu (`InstitutionalViewModel`, hooks, services).
- Produces: `InstitutionalHeader`, `InstitutionalAlertBanner`, `GlobalFilterBar`, `ExportReportDrawer`, `AiChatDrawer`, `PerformanceModuleTabs`, `ModuleContentRenderer` (de `src/components/analytics/v2/shell/**` e `shared/**`) — todos consumidos por `GestorLayout.tsx` na Task 6, com os mesmos nomes de export que tinham em `58226452^`.

- [ ] **Step 1: Restaurar os arquivos**

```bash
mkdir -p src/components/analytics/v2/modules src/components/analytics/v2/shared src/components/analytics/v2/shell

for f in \
  DesempenhoV2Skeleton.tsx \
  DistanciaFaixaCards.tsx \
  EvolucaoChart.tsx \
  FaixaDistribuicaoChart.tsx \
  KpiCardsGrid.tsx \
  MetaInstitucionalCard.tsx \
  ThemeAccuracyEvolutionChart.tsx \
  TooltipInfo.tsx \
  modules/CurricularSearchBar.tsx \
  modules/DiagnosticoCurricularModule.tsx \
  modules/InsightsInfoTooltip.tsx \
  modules/InsightsPedagogicosModule.tsx \
  modules/InteligenciaDecisoriModule.tsx \
  modules/SimuladorImpactoModule.tsx \
  modules/VisaoAlunosModule.tsx \
  modules/VisaoInstitucionalModule.tsx \
  shared/AiChatDrawer.tsx \
  shared/ExportReportDrawer.tsx \
  shared/StudentAnalyticsDrawer.tsx \
  shell/GlobalFilterBar.tsx \
  shell/InstitutionalAlertBanner.tsx \
  shell/InstitutionalHeader.tsx \
  shell/ModuleContentRenderer.tsx \
  shell/ModuleEmptyState.tsx \
  shell/PerformanceContextBar.tsx \
  shell/PerformanceModuleTabs.tsx \
; do
  git show "58226452^:src/components/analytics/v2/$f" > "src/components/analytics/v2/$f"
done

git show 58226452^:src/utils/institutionalReportPdf.ts > src/utils/institutionalReportPdf.ts
git show 58226452^:src/utils/institutionalReportXlsx.ts > src/utils/institutionalReportXlsx.ts
```

**Nota:** `StudentAnalyticsDrawer.tsx` foi substituído no `DrawerAluno` do portal novo (memória `portal-gestor-v2`, "REGRESSÃO EVITADA: o telefone do aluno") — ele volta aqui só para o console antigo, como peça independente; não mexe no `DrawerAluno` do portal novo.

- [ ] **Step 2: Checar imports quebrados, mesmo procedimento da Task 4**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "analytics/v2|institutionalReport"`

Expected: idealmente vazio. Mesmo critério da Task 4 — corrija só a linha de import quebrada nos arquivos restaurados (ex.: se algum componente de UI compartilhado, tipo `Button`/`Badge`/`Tooltip` de `@/components/ui/*`, mudou de props obrigatórias desde 05/08, ajuste a chamada no arquivo restaurado, nunca o componente de UI compartilhado em si). Se um import inteiro não tiver mais equivalente, pare e escale.

- [ ] **Step 3: Commit**

```bash
git add src/components/analytics/v2 src/utils/institutionalReportPdf.ts src/utils/institutionalReportXlsx.ts
git commit -m "restore(gestor): UI das 5 telas do console antigo e exportadores PDF/XLSX"
```

---

### Task 6: Restaurar `src/experiences/gestor/**` (layout, rotas, nav, feature gate, filters provider, páginas)

**Files:**
- Create (via `git show`, conteúdo idêntico a `58226452^`, exceto `GestorLayout.tsx` — ver Step 2): `src/experiences/gestor/gestorRoutes.tsx`, `src/experiences/gestor/GestorNav.ts`, `src/experiences/gestor/GestorFeatureGate.tsx`, `src/experiences/gestor/GestorFiltersProvider.tsx`, `src/experiences/gestor/pages/VisaoInstitucionalPage.tsx`, `src/experiences/gestor/pages/DiagnosticoCurricularPage.tsx`, `src/experiences/gestor/pages/AlunosPage.tsx`, `src/experiences/gestor/pages/InsightsPedagogicosPage.tsx`, `src/experiences/gestor/pages/InteligenciaDecisoriaPage.tsx`
- Create + edit: `src/experiences/gestor/GestorLayout.tsx`

**Interfaces:**
- Consumes: tudo das Tasks 4 e 5; `ExperienceGuard` (`src/experiences/shared/ExperienceGuard.tsx`, já existe, sem alteração); `ExperienceSwitcher` (`src/experiences/shared/ExperienceSwitcher.tsx`, já existe, sem alteração).
- Produces: `gestorRoutes(): RouteObject[]` — Task 7 consome exatamente essa função para montar a árvore de coexistência.

- [ ] **Step 1: Restaurar os arquivos que não precisam de edição**

```bash
mkdir -p src/experiences/gestor/pages
git show 58226452^:src/experiences/gestor/gestorRoutes.tsx > src/experiences/gestor/gestorRoutes.tsx
git show 58226452^:src/experiences/gestor/GestorNav.ts > src/experiences/gestor/GestorNav.ts
git show 58226452^:src/experiences/gestor/GestorFeatureGate.tsx > src/experiences/gestor/GestorFeatureGate.tsx
git show 58226452^:src/experiences/gestor/GestorFiltersProvider.tsx > src/experiences/gestor/GestorFiltersProvider.tsx
git show 58226452^:src/experiences/gestor/pages/VisaoInstitucionalPage.tsx > src/experiences/gestor/pages/VisaoInstitucionalPage.tsx
git show 58226452^:src/experiences/gestor/pages/DiagnosticoCurricularPage.tsx > src/experiences/gestor/pages/DiagnosticoCurricularPage.tsx
git show 58226452^:src/experiences/gestor/pages/AlunosPage.tsx > src/experiences/gestor/pages/AlunosPage.tsx
git show 58226452^:src/experiences/gestor/pages/InsightsPedagogicosPage.tsx > src/experiences/gestor/pages/InsightsPedagogicosPage.tsx
git show 58226452^:src/experiences/gestor/pages/InteligenciaDecisoriaPage.tsx > src/experiences/gestor/pages/InteligenciaDecisoriaPage.tsx
```

- [ ] **Step 2: Restaurar `GestorLayout.tsx` e ajustar a única parte que não existe mais no app atual**

O pull de hoje (11/08) apagou `src/experiences/shared/GoToStudentButton.tsx` e a função `getPortalEntries` de `globalNav.ts`, substituindo os dois por `src/experiences/shared/ExperienceSwitcher.tsx` (já em produção, usado em `ConteudoSidebar.tsx` e `AdminLayout.tsx`). O `GestorLayout.tsx` antigo usava ambos só para montar "outros portais + trocar de portal" no cabeçalho — isso é exatamente o que `ExperienceSwitcher` já faz sozinho hoje.

```bash
git show 58226452^:src/experiences/gestor/GestorLayout.tsx > src/experiences/gestor/GestorLayout.tsx
```

Editar o arquivo restaurado:

```tsx
// ANTES (não existe mais no app atual):
import { GoToStudentButton } from '@/experiences/shared/GoToStudentButton';
import { getPortalEntries } from '@/experiences/shared/globalNav';
// ...
const otherPortals = getPortalEntries(access).filter((entry) => entry.url !== '/gestor');
// ...
{otherPortals.map(({ title, url, icon: Icon }) => (
  <NavLink key={url} to={url} className="...">
    {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
    {title}
  </NavLink>
))}
<GoToStudentButton className="h-8" />
```

```tsx
// DEPOIS:
import { ExperienceSwitcher } from '@/experiences/shared/ExperienceSwitcher';
// (remove o import de getPortalEntries e a variável otherPortals — ExperienceSwitcher já resolve as opções internamente)
// ...
<ExperienceSwitcher variant="compact" className="h-8" />
```

O restante do arquivo (imports de `InstitutionalHeader`, `GlobalFilterBar`, `ExportReportDrawer`, `AiChatDrawer`, `GESTOR_NAV`, `GestorFiltersProvider`, a lógica de `canExport`/`canChat` via `useEffectiveFeatures().hasFeature('gestao.exportar'/'gestao.ia')`) fica **idêntico** — essas duas chaves já foram restauradas na Task 1.

- [ ] **Step 3: Checar imports quebrados**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "experiences/gestor"`

Expected: vazio, exceto possivelmente `src/experiences/gestor/GestorFeatureGate.tsx` reclamando de `getDefaultRouteForUser` — confirme que esse util ainda existe em `@/utils/experiences` com a mesma assinatura (é consumido hoje por `ExperienceGuard.tsx`, então deve estar intacto). Mesmo critério de escalar das Tasks 4/5 se algo além disso quebrar.

- [ ] **Step 4: Commit**

```bash
git add src/experiences/gestor
git commit -m "restore(gestor): layout, rotas, nav, feature gate e paginas do console antigo"
```

---

### Task 7: Ligar o gate — `useGestorPortalVersao`, `portalV2Gates` adaptado, e reescrever `gestorV2Routes.tsx`

**Files:**
- Create: `src/features/gestor/hooks/useGestorPortalVersao.ts`, `src/test/unit/useGestorPortalVersao.test.ts`
- Create: `src/features/gestor/portalV2Gates.tsx`
- Modify: `src/features/gestor/gestorV2Routes.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `gestorRoutes()` (Task 6); RPC `get_gestor_portal_versao` (Task 3); `GestorShell` (`src/features/gestor/shell/GestorShell.tsx`, já existe, sem alteração).
- Produces: `gestorV2Routes(): RouteObject[]` continua sendo a função que `src/experiences/buildAppRoutes.tsx:80` importa — **assinatura e nome do arquivo não mudam**, só o conteúdo interno. `buildAppRoutes.tsx` não precisa de nenhuma edição.

- [ ] **Step 1: Escrever o hook `useGestorPortalVersao`**

```ts
// src/features/gestor/hooks/useGestorPortalVersao.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Decide se o usuário atual vê o portal novo (true) ou o console antigo
 * (false) -- ver get_gestor_portal_versao() e
 * docs/superpowers/specs/2026-08-11-rollout-faseado-portal-gestor-design.md.
 *
 * Fica em cache por 60s (mesmo staleTime de useEffectiveFeatures) -- não
 * precisa de realtime: a ativação de uma IES é um evento raro e manual,
 * relogar/navegar de novo já reflete.
 */
export function useGestorPortalVersao() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['gestor', 'portal-versao', user?.id],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('get_gestor_portal_versao');
      if (error) throw new Error(`get_gestor_portal_versao: ${error.message}`);
      return Boolean(data);
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  return {
    portalNovo: query.data ?? false,
    loading: !!user && query.isLoading,
    error: query.isError ? 'Erro ao carregar versão do portal' : null,
  };
}
```

- [ ] **Step 2: Escrever o teste do hook**

```ts
// src/test/unit/useGestorPortalVersao.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGestorPortalVersao } from '@/features/gestor/hooks/useGestorPortalVersao';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/contexts/AuthContext');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useGestorPortalVersao', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as ReturnType<typeof useAuth>);
  });

  it('retorna portalNovo=true quando a RPC devolve true', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: true, error: null } as never);
    const { result } = renderHook(() => useGestorPortalVersao(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.portalNovo).toBe(true);
  });

  it('retorna portalNovo=false quando a RPC devolve false', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: false, error: null } as never);
    const { result } = renderHook(() => useGestorPortalVersao(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.portalNovo).toBe(false);
  });

  it('trata erro da RPC como console antigo (fail-safe) e reporta o erro', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'boom' } } as never);
    const { result } = renderHook(() => useGestorPortalVersao(), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.portalNovo).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar os testes do hook**

Run: `npx vitest run src/test/unit/useGestorPortalVersao.test.ts`
Expected: 3 testes, todos PASS. Se o mock de `useAuth`/`supabase` divergir da forma real de importação usada em outros testes do repo (ex.: `src/features/gestor/__tests__/GestorShell.test.tsx` já mocka os dois), alinhe a sintaxe do mock a esse arquivo existente em vez de inventar uma nova.

- [ ] **Step 4: Escrever `portalV2Gates.tsx` (adaptado do histórico — troca a fonte da flag)**

```tsx
// src/features/gestor/portalV2Gates.tsx
import * as React from 'react';
import { Suspense, lazy } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/accessRules';
import { useGestorPortalVersao } from '@/features/gestor/hooks/useGestorPortalVersao';
import { GestorIndexRedirect } from '@/experiences/gestor/GestorFeatureGate';
import { GestorShell } from '@/features/gestor/shell/GestorShell';

/** Parâmetro de URL da válvula de escape, só para admin — ver useEscapeParaLegado. */
const ESCAPE_LEGADO_PARAM = 'legado';

/**
 * Válvula de escape SOMENTE para quem tem role `admin`: força a experiência
 * legada mesmo com o rollout aprovado, quando a URL tem `?legado=1`.
 *
 * Admin sempre recebe portalNovo=true de get_gestor_portal_versao() (linha de
 * dogfooding da RPC) — sem isso, quem está operando o rollout nunca consegue
 * ver o console antigo de uma IES específica para confirmar visualmente como
 * ela está antes de aprovar. Isto NUNCA decide quem PODE acessar (isso é
 * 100% servidor); só decide, para quem já passou pelo ExperienceGuard, qual
 * das duas UIs mostrar.
 */
function useEscapeParaLegado(search: string): boolean {
  const { user } = useAuth();
  if (!isAdmin(user)) return false;
  return new URLSearchParams(search).get(ESCAPE_LEGADO_PARAM) === '1';
}

// O layout legado é lazy de propósito: quem está no portal novo nunca baixa o
// bundle de components/analytics/v2.
const GestorLayoutLegado = lazy(() =>
  import('@/experiences/gestor/GestorLayout').then((m) => ({ default: m.GestorLayout })),
);
const Inicio = lazy(() => import('@/features/gestor/routes/Inicio'));

const Espera: React.FC = () => (
  <div className="min-h-screen bg-background" aria-busy="true" />
);

/**
 * Shell da árvore `/gestor`: com o rollout aprovado para a(s) IES do usuário,
 * serve o portal novo (GestorShell); senão, o console antigo (GestorLayout).
 *
 * Uma árvore só, porque `buildAppRoutes` é síncrono e não conhece o resultado
 * da RPC — duas árvores irmãs no mesmo path deixariam a segunda inalcançável.
 */
export const GestorPortalShell: React.FC = () => {
  const { portalNovo, loading } = useGestorPortalVersao();
  const location = useLocation();
  const escapeLegado = useEscapeParaLegado(location.search);
  if (loading) return <Espera />;
  const mostraPortalNovo = portalNovo && !escapeLegado;
  return (
    <Suspense fallback={<Espera />}>
      {mostraPortalNovo ? <GestorShell /> : <GestorLayoutLegado />}
    </Suspense>
  );
};

/** Rota exclusiva do portal v2: sem o rollout aprovado, volta ao index de `/gestor`. */
export const PortalV2Gate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { portalNovo, loading } = useGestorPortalVersao();
  const location = useLocation();
  const escapeLegado = useEscapeParaLegado(location.search);
  if (loading) return <Espera />;
  if (!portalNovo || escapeLegado) {
    return <Navigate to={{ pathname: '/gestor', search: location.search }} replace />;
  }
  return <>{children}</>;
};

/**
 * Rota exclusiva das 5 telas legadas: com o rollout aprovado elas saem do ar
 * para essa IES (o shell novo não monta o GestorFiltersProvider que elas
 * exigem). Exceção: admin com `?legado=1` sempre alcança.
 */
export const LegacyGestorGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { portalNovo, loading } = useGestorPortalVersao();
  const location = useLocation();
  const escapeLegado = useEscapeParaLegado(location.search);
  if (loading) return <Espera />;
  if (portalNovo && !escapeLegado) {
    return <Navigate to={{ pathname: '/gestor', search: location.search }} replace />;
  }
  return <>{children}</>;
};

/** Index de `/gestor`: Início novo com o rollout aprovado; GestorIndexRedirect (antigo) sem ele. */
export const GestorIndexSwitch: React.FC = () => {
  const { portalNovo, loading } = useGestorPortalVersao();
  const location = useLocation();
  const escapeLegado = useEscapeParaLegado(location.search);
  if (loading) return <Espera />;
  const mostraPortalNovo = portalNovo && !escapeLegado;
  if (!mostraPortalNovo) return <GestorIndexRedirect />;
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
      <Inicio />
    </Suspense>
  );
};
```

Confirme antes de commitar que `isAdmin` ainda existe em `@/utils/accessRules` com essa assinatura (`isAdmin(user)`) — é utilitário genérico, esperado que siga intacto.

- [ ] **Step 5: Reescrever `src/features/gestor/gestorV2Routes.tsx`**

```tsx
// src/features/gestor/gestorV2Routes.tsx
import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import { gestorRoutes } from '@/experiences/gestor/gestorRoutes';
import {
  GestorPortalShell,
  GestorIndexSwitch,
  LegacyGestorGate,
  PortalV2Gate,
} from '@/features/gestor/portalV2Gates';

const VisaoGeral = lazy(() => import('@/features/gestor/routes/VisaoGeral'));
const Detalhamento = lazy(() => import('@/features/gestor/routes/Detalhamento'));

/**
 * Árvore de rotas da experiência Gestão durante o rollout faseado por IES
 * (spec 2026-08-11-rollout-faseado-portal-gestor-design.md).
 *
 * Um único `/gestor`, protegido por ExperienceGuard (esse continua sendo o
 * único gate por PAPEL — separa gestão de aluno/admin/CX). Dentro dele,
 * GestorPortalShell decide, via get_gestor_portal_versao(), entre o portal
 * novo (Início/Visão Geral/Detalhamento, dentro de GestorShell) e o console
 * antigo (5 telas, dentro de GestorLayout, reaproveitando gestorRoutes()
 * inteiro — que fica intacto).
 */
export const gestorV2Routes = (): RouteObject[] => {
  const legado = gestorRoutes();
  const portalLegado = legado.find((rota) => rota.path === '/gestor');
  const compat = legado.filter((rota) => rota.path !== '/gestor');

  const telasLegadas: RouteObject[] = (portalLegado?.children ?? [])
    .filter((filha) => !filha.index)
    .map((filha) => ({
      ...filha,
      element: <LegacyGestorGate>{filha.element}</LegacyGestorGate>,
    }));

  return [
    {
      path: '/gestor',
      element: (
        <ExperienceGuard experience="gestao">
          <GestorPortalShell />
        </ExperienceGuard>
      ),
      children: [
        { index: true, element: <GestorIndexSwitch /> },
        { path: 'visao-geral', element: <PortalV2Gate><VisaoGeral /></PortalV2Gate> },
        { path: 'detalhamento', element: <PortalV2Gate><Detalhamento /></PortalV2Gate> },
        ...telasLegadas,
      ],
    },
    ...compat,
  ];
};
```

- [ ] **Step 6: Checar imports/tipos**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "gestorV2Routes|portalV2Gates|useGestorPortalVersao"`
Expected: vazio.

- [ ] **Step 7: Commit**

```bash
git add src/features/gestor/hooks/useGestorPortalVersao.ts src/features/gestor/portalV2Gates.tsx src/features/gestor/gestorV2Routes.tsx src/test/unit/useGestorPortalVersao.test.ts
git commit -m "feat(gestor): liga o gate de rollout por IES entre console antigo e portal novo"
```

---

### Task 8: Testes de decisão de roteamento

**Files:**
- Create: `src/features/gestor/__tests__/gestorV2Routes.test.tsx`

**Interfaces:**
- Consumes: `gestorV2Routes` (Task 7), `useGestorPortalVersao` (Task 7, mockado neste teste).

- [ ] **Step 1: Escrever o teste**

```tsx
// src/features/gestor/__tests__/gestorV2Routes.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { gestorV2Routes } from '@/features/gestor/gestorV2Routes';
import { useGestorPortalVersao } from '@/features/gestor/hooks/useGestorPortalVersao';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';

vi.mock('@/features/gestor/hooks/useGestorPortalVersao');
vi.mock('@/contexts/AuthContext');
vi.mock('@/hooks/useAccessRules');

// Os módulos de tela (GestorShell/Inicio/VisaoGeral, GestorLayout/analytics-v2)
// puxam data-fetching real — mockar como componentes triviais para isolar só
// a DECISÃO de roteamento, que é o que este teste cobre.
vi.mock('@/features/gestor/shell/GestorShell', () => ({
  GestorShell: () => <div data-testid="portal-novo" />,
}));
vi.mock('@/experiences/gestor/GestorLayout', () => ({
  GestorLayout: () => <div data-testid="console-antigo" />,
}));

function renderGestor(initialPath = '/gestor') {
  const router = createMemoryRouter(gestorV2Routes(), { initialEntries: [initialPath] });
  return render(<RouterProvider router={router} />);
}

describe('gestorV2Routes - decisão console antigo x portal novo', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', roles: ['gestor'] },
      access: { roles: ['gestor'], experiences: ['aluno', 'gestao'], capabilities: [] },
    } as ReturnType<typeof useAuth>);
    vi.mocked(useAccessRules).mockReturnValue({
      accessRules: { desempenhoInstitucional: true } as ReturnType<typeof useAccessRules>['accessRules'],
    } as ReturnType<typeof useAccessRules>);
  });

  it('monta o portal novo quando get_gestor_portal_versao devolve true', async () => {
    vi.mocked(useGestorPortalVersao).mockReturnValue({ portalNovo: true, loading: false, error: null });
    renderGestor();
    expect(await screen.findByTestId('portal-novo')).toBeInTheDocument();
  });

  it('monta o console antigo quando get_gestor_portal_versao devolve false', async () => {
    vi.mocked(useGestorPortalVersao).mockReturnValue({ portalNovo: false, loading: false, error: null });
    renderGestor();
    expect(await screen.findByTestId('console-antigo')).toBeInTheDocument();
  });

  it('não monta nada (tela de espera) enquanto a decisão está carregando', () => {
    vi.mocked(useGestorPortalVersao).mockReturnValue({ portalNovo: false, loading: true, error: null });
    renderGestor();
    expect(screen.queryByTestId('portal-novo')).not.toBeInTheDocument();
    expect(screen.queryByTestId('console-antigo')).not.toBeInTheDocument();
  });

  it('smoke test estrutural: as 5 telas legadas continuam registradas como rotas-filhas de /gestor', () => {
    // Teste estrutural, não de render: renderizar as 5 telas de verdade exigiria
    // mockar toda a cadeia de data-fetching do console antigo (Task 4/5), fora
    // do escopo deste teste de DECISÃO de roteamento. Isso cobre a garantia
    // mínima da spec ("as 5 URLs voltam a montar tela real, não redirect
    // morto") no nível de definição de rota.
    const rotas = gestorV2Routes();
    const portalGestor = rotas.find((r) => r.path === '/gestor');
    const paths = (portalGestor?.children ?? []).map((c) => c.path).filter(Boolean);
    expect(paths).toEqual(
      expect.arrayContaining([
        'visao-institucional',
        'diagnostico-curricular',
        'alunos',
        'insights-pedagogicos',
        'inteligencia-decisoria',
      ]),
    );
  });
});
```

- [ ] **Step 2: Rodar o teste**

Run: `npx vitest run src/features/gestor/__tests__/gestorV2Routes.test.tsx`
Expected: 4 testes, todos PASS. Se `useAuth`/`useAccessRules` exigirem um shape diferente do mockado aqui, alinhe com o mock já usado em `src/features/gestor/__tests__/GestorShell.test.tsx` (mesmo diretório, já restaurado/mantido pelo pull de hoje).

- [ ] **Step 3: Commit**

```bash
git add src/features/gestor/__tests__/gestorV2Routes.test.tsx
git commit -m "test(gestor): cobre a decisão de roteamento console antigo x portal novo"
```

---

### Task 9: Verificação final

**Files:** nenhum arquivo novo — só execução.

- [ ] **Step 1: Suíte completa**

Run: `npx vitest run`
Expected: todos os testes passam, incluindo os novos das Tasks 1–3 e 7–8 e os já existentes (`gestorMigrationsAcessoPorPapel.test.ts` continua verde — nenhuma migration existente foi tocada).

- [ ] **Step 2: Type-check na árvore inteira**

Run: `npx tsc --noEmit -p .`
Expected: exit 0. Este projeto já teve suíte verde com type-check quebrado três vezes na mesma frente (memória `portal-gestor-v2`) — não pular este passo.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build conclui sem erro. Confirme também que o bundle do console antigo (`analytics/v2`) está em um chunk separado/lazy (os `lazy(() => import(...))` da Task 7 já garantem isso) — não deveria inflar o bundle inicial do portal novo.

- [ ] **Step 4: Commit final (se algo precisou de ajuste nos passos anteriores)**

```bash
git add -A
git commit -m "chore(gestor): ajustes finais de type-check/build do rollout faseado por IES"
```

Se nada precisou de ajuste, não há o que commitar aqui — as Tasks 1–8 já deixaram tudo commitado.
