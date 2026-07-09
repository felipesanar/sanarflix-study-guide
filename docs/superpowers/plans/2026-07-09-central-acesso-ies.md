# Central de acesso por IES — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer de `/admin/ies` o controle real de acesso por IES: fonte única `get_effective_features()` no banco, gates reativos em todas as rotas do aluno e do gestor, e tela admin catálogo-driven cobrindo as duas experiências.

**Architecture:** O banco ganha `feature_catalog` (catálogo) + RPC `get_effective_features()` (resolve IES do usuário + bypass admin/atendimento + master `gestao.enabled` no servidor). No front, `useEffectiveFeatures` (React Query + Realtime) substitui `useIesFeatures`; `useAccessRules` vira adaptador fino sem interpretação de role; portal do gestor ganha gate por feature (guard + rotas + nav + drawers). A tela admin é reescrita lendo o catálogo do banco, com seções por experiência, master switch, busca, copiar-de e histórico.

**Tech Stack:** React 18 + Vite + TS, React Query (`@tanstack/react-query`), Supabase JS (RPC + Realtime), shadcn/ui, vitest.

**Spec:** `docs/superpowers/specs/2026-07-09-central-acesso-ies-design.md`

## Global Constraints

- Branch de trabalho: `feat/central-acesso-ies` (criada a partir da main; **nunca** commitar direto na main — push na main = deploy prod via Vercel).
- Projeto Supabase de prod é `gvqv` (hardcoded no client). O MCP do Supabase local enxerga OUTRO projeto (`lljn`) — **NÃO usar o MCP para aplicar/verificar DDL**. Todo DDL vai via agente Lovable (Task 0, executada pelo loop principal, não por subagente).
- Typecheck real: `npx tsc -p tsconfig.app.json --noEmit` (o `tsc` da raiz é NO-OP). Testes: `npx vitest run <arquivo>`.
- `feature_catalog` e `get_effective_features` NÃO estão nos tipos gerados do Supabase — usar o padrão de cast documentado do repo (mesmo de `src/services/admin/iesFeatures.ts:36-43`), nunca `as any`.
- Chaves de feature novas (canônicas): `aluno.home`, `aluno.guia_estudos`, `aluno.dashboard`, `aluno.simulados`, `aluno.desempenho_simulados`, `aluno.sanarclass`, `aluno.caderno_erros`, `gestao.enabled` (master), `gestao.visao_institucional`, `gestao.diagnostico_curricular`, `gestao.alunos`, `gestao.insights_pedagogicos`, `gestao.inteligencia_decisoria`, `gestao.exportar`, `gestao.ia`.
- Interface `AccessRules` (`src/types/index.ts:34-45`) NÃO muda nesta rodada. Semânticas novas: `desempenhoInstitucional` ← `gestao.enabled` (gate do portal do gestor); `analytics` ← sempre `false` (flag morto, remoção só no cleanup); `userManagement` ← `bypass` da RPC.
- Feature ausente em `ies_features` = **false** (default fechado — comportamento atual preservado).
- Componente/página nunca decide acesso por role literal — só `AccessRules`/`can()`/`hasExperience()`/`hasFeature()`.
- Commits frequentes, mensagens `feat:`/`test:`/`refactor:` em pt-BR como o histórico do repo.

## Ordem de execução / paralelismo

```
Task 0 (DDL via Lovable — loop principal)  ─┐  pode rodar em paralelo com Task 1
Task 1 (fonte única no front — SERIAL)      ─┤  é o hub; Tasks 2/3/4 dependem da interface dela
Tasks 2, 3, 4 (aluno / gestor / admin)      ─┤  PARALELAS (agentes Sonnet, arquivos disjuntos)
Task 5 (teste de regressão + suíte verde)   ─┘  depois de 2/3/4
```

---

### Task 0: DDL no gvqv via Lovable (catálogo + cópia de chaves + seed + RPC + realtime)

**Executor:** loop principal (via `send_message` ao agente Lovable do projeto). NÃO é tarefa de subagente de código.

**Files:**
- Create: `supabase/migrations/20260709120000_central_acesso_ies.sql` (registro no repo do DDL aplicado via Lovable)

**Interfaces:**
- Produces: tabela `public.feature_catalog`; RPC `public.get_effective_features() returns jsonb` com shape `{ "bypass": boolean, "ies_id": uuid|null, "features": { "<key>": boolean } }`; linhas novas em `ies_features` com as chaves namespaced; `ies_features` na publication `supabase_realtime`.

- [ ] **Step 1: Gravar o SQL no repo** (arquivo acima), conteúdo integral:

```sql
-- Central de acesso por IES (spec 2026-07-09).
-- Aplicado em prod (gvqv) via agente Lovable em 2026-07-09. ADITIVO:
-- nenhuma linha antiga de ies_features é alterada ou removida.

-- 1) Catálogo de features (a tela /admin/ies passa a ler daqui)
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

alter table public.feature_catalog enable row level security;

create policy "Catalogo legivel por autenticados"
  on public.feature_catalog for select
  to authenticated
  using (true);
-- Sem policy de escrita: escrita só via service_role/migrations.

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

-- 2) Cópia das chaves antigas -> novas (POR CÓPIA; linhas antigas ficam intactas)
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

-- 3) Seed de segurança do gestor: toda IES com gestor ativo ganha gestao.* = true.
--    Roda DEPOIS da cópia e SOBRESCREVE (ninguém perde acesso na virada).
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

-- 5) Realtime (o front invalida cache ao vivo quando o admin salva)
alter publication supabase_realtime add table public.ies_features;
```

- [ ] **Step 2: Aplicar via Lovable** — `send_message` ao projeto Lovable do Academy pedindo para executar o SQL acima no banco, com DUAS verificações prévias pelo agente Lovable (adaptar o SQL se divergir):
  1. Confirmar que `public.users.id = auth.uid()` é a convenção (conferir corpo de uma função existente, ex.: `get_accessible_ies`). Se a resolução de IES do usuário for outra, ajustar o `select id_ies ...` da RPC e o seed (3).
  2. Confirmar `unique (ies_id, feature_key)` em `ies_features` (os `on conflict` dependem disso).

- [ ] **Step 3: Verificar aplicação real** (lição do sync Lovable — não confiar no "ok"): pedir ao Lovable o resultado de:

```sql
select count(*) from public.feature_catalog;                                  -- esperado: 15
select feature_key, count(*) from public.ies_features
 where feature_key like 'aluno.%' or feature_key like 'gestao.%'
 group by 1 order by 1;                                                        -- chaves novas populadas
select public.get_effective_features();                                        -- roda sem erro (como service_role: bypass=false, ies null)
select * from pg_publication_tables where pubname='supabase_realtime'
  and tablename='ies_features';                                                -- 1 linha
```

- [ ] **Step 4: Commit do arquivo de migration no repo**

```bash
git add supabase/migrations/20260709120000_central_acesso_ies.sql
git commit -m "feat: DDL da central de acesso por IES (feature_catalog + get_effective_features)"
```

---

### Task 1: Fonte única no front — `useEffectiveFeatures` + adaptação de `useAccessRules`, guard e default route

**Files:**
- Create: `src/hooks/useEffectiveFeatures.ts`
- Rewrite: `src/hooks/useAccessRules.ts`
- Delete: `src/hooks/useIesFeatures.ts`
- Modify: `src/experiences/shared/ExperienceGuard.tsx:26-38`
- Modify: `src/utils/experiences.ts:57-72` (`getDefaultRouteForUser`)
- Modify: `src/utils/accessRules.ts` (remover `getAccessRules`/`DEFAULT_RULES`/`ADMIN_RULES`; MANTER `isAdmin`/`isProfessor`/`isGestor`/`isGestorGrupo`/`isAtendimento` — são usados para escopo de dados)
- Test: `src/test/unit/useAccessRules.test.tsx` (novo), atualizar `src/test/unit/accessRules.test.ts`, `src/test/unit/experiences.test.ts`, `src/test/components/ExperienceGuard.test.tsx`

**Interfaces:**
- Consumes: RPC `get_effective_features()` → `{ bypass: boolean; ies_id: string | null; features: Record<string, boolean> }` (Task 0).
- Produces (contrato para Tasks 2/3/4/5):
  - `useEffectiveFeatures(): { features: Record<string, boolean>; bypass: boolean; iesId: string | null; loading: boolean; error: string | null; hasFeature: (key: string) => boolean }`
  - `useAccessRules(): { accessRules: AccessRules; loading: boolean; hasFeature: (key: string) => boolean }` — mesma forma de retorno de hoje, mas `hasFeature` agora recebe chave namespaced (`string`), não `keyof AccessRules`.
  - `ExperienceGuard` bloqueia `gestao` quando `accessRules.desempenhoInstitucional === false`.
  - `getDefaultRouteForUser` pula `gestao` na precedência quando `accessRules.desempenhoInstitucional === false`.

- [ ] **Step 1: Testes que falham** — criar `src/test/unit/useAccessRules.test.tsx` (seguir o padrão de mock dos testes existentes em `src/test/`; mockar `useAuth` e a RPC):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

const mockRpc = vi.fn();
const mockChannel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: () => mockChannel,
    removeChannel: vi.fn(),
  },
}));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

import { useAccessRules } from '@/hooks/useAccessRules';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useAccessRules (fonte única get_effective_features)', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockUseAuth.mockReturnValue({ user: { id: 'u1', id_ies: 'ies1', roles: ['gestor'] } });
  });

  it('mapeia chaves namespaced para AccessRules e respeita gestao.enabled', async () => {
    mockRpc.mockResolvedValue({
      data: {
        bypass: false,
        ies_id: 'ies1',
        features: {
          'aluno.home': true, 'aluno.guia_estudos': false, 'aluno.dashboard': true,
          'aluno.simulados': true, 'aluno.desempenho_simulados': false,
          'aluno.sanarclass': false, 'aluno.caderno_erros': true,
          'gestao.enabled': false, 'gestao.visao_institucional': false,
        },
      },
      error: null,
    });
    const { result } = renderHook(() => useAccessRules(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.accessRules.home).toBe(true);
    expect(result.current.accessRules.studyGuide).toBe(false);
    expect(result.current.accessRules.errorNotebook).toBe(true);
    // gestor NÃO tem mais bypass hardcoded: portal segue o contrato da IES
    expect(result.current.accessRules.desempenhoInstitucional).toBe(false);
    expect(result.current.accessRules.analytics).toBe(false);
    expect(result.current.accessRules.userManagement).toBe(false);
    expect(result.current.hasFeature('gestao.visao_institucional')).toBe(false);
  });

  it('bypass do servidor (admin/atendimento) liga tudo, inclusive userManagement', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u2', id_ies: '', roles: ['admin'] } });
    mockRpc.mockResolvedValue({
      data: { bypass: true, ies_id: null, features: { 'aluno.home': true, 'gestao.enabled': true } },
      error: null,
    });
    const { result } = renderHook(() => useAccessRules(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.accessRules.userManagement).toBe(true);
    expect(result.current.accessRules.desempenhoInstitucional).toBe(true);
  });

  it('sem usuário: tudo false, sem chamada à RPC', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useAccessRules(), { wrapper });
    expect(result.current.accessRules.simulados).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/test/unit/useAccessRules.test.tsx` → FAIL (`useEffectiveFeatures` não existe / mapeamento antigo).

- [ ] **Step 3: Implementar `src/hooks/useEffectiveFeatures.ts`:**

```ts
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Payload da RPC `get_effective_features` (fonte única de acesso por feature). */
export interface EffectiveFeaturesPayload {
  bypass: boolean;
  ies_id: string | null;
  features: Record<string, boolean>;
}

const EMPTY: EffectiveFeaturesPayload = { bypass: false, ies_id: null, features: {} };

/**
 * A RPC ainda não está nos tipos gerados do Supabase — cast local documentado
 * (mesmo padrão de `src/services/admin/iesFeatures.ts`).
 */
async function fetchEffectiveFeatures(): Promise<EffectiveFeaturesPayload> {
  const { data, error } = await (supabase.rpc as (
    fn: string,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(
    'get_effective_features',
  );
  if (error) throw new Error(`get_effective_features: ${error.message}`);
  return (data as EffectiveFeaturesPayload | null) ?? EMPTY;
}

/**
 * Fonte única de features efetivas do usuário. O servidor decide bypass
 * (admin/atendimento) e a semântica do master `gestao.enabled` — o front
 * nunca interpreta role para decidir feature. Realtime em `ies_features`
 * (recorte da IES do usuário) invalida o cache: toggle do admin reflete
 * na sessão aberta sem relogar.
 */
export const useEffectiveFeatures = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['effective-features', user?.id],
    queryFn: fetchEffectiveFeatures,
    enabled: !!user,
    staleTime: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!user?.id_ies) return;
    const channel = supabase
      .channel(`ies-features-${user.id_ies}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ies_features', filter: `ies_id=eq.${user.id_ies}` },
        () => queryClient.invalidateQueries({ queryKey: ['effective-features'] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id_ies, queryClient]);

  const features = query.data?.features ?? {};

  return {
    features,
    bypass: query.data?.bypass ?? false,
    iesId: query.data?.ies_id ?? null,
    loading: !!user && query.isLoading,
    error: query.isError ? 'Erro ao carregar permissões' : null,
    hasFeature: (key: string): boolean => features[key] ?? false,
  };
};
```

- [ ] **Step 4: Reescrever `src/hooks/useAccessRules.ts`:**

```ts
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import { AccessRules } from '@/types';

const NO_ACCESS: AccessRules = {
  home: false, studyGuide: false, dashboard: false, SimuladoDesempenho: false,
  userManagement: false, sanarclass: false, simulados: false, analytics: false,
  desempenhoInstitucional: false, errorNotebook: false,
};

/**
 * Adaptador fino da fonte única (`get_effective_features`) para a interface
 * `AccessRules` consumida por rotas/sidebar/bottom-nav.
 *
 * Nenhum role é interpretado aqui — o bypass (admin/atendimento) é decidido
 * no servidor. Semânticas:
 * - `desempenhoInstitucional` == `gestao.enabled` (gate do portal do gestor);
 * - `analytics` é flag morto (sempre false; sai da interface no cleanup);
 * - `userManagement` == bypass (equipe interna Sanar).
 */
export const useAccessRules = () => {
  const { user } = useAuth();
  const { features, bypass, loading, hasFeature } = useEffectiveFeatures();

  const accessRules = useMemo<AccessRules>(() => {
    if (!user) return NO_ACCESS;
    return {
      home: hasFeature('aluno.home'),
      studyGuide: hasFeature('aluno.guia_estudos'),
      dashboard: hasFeature('aluno.dashboard'),
      simulados: hasFeature('aluno.simulados'),
      SimuladoDesempenho: hasFeature('aluno.desempenho_simulados'),
      sanarclass: hasFeature('aluno.sanarclass'),
      errorNotebook: hasFeature('aluno.caderno_erros'),
      desempenhoInstitucional: hasFeature('gestao.enabled'),
      analytics: false,
      userManagement: bypass,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hasFeature deriva de features
  }, [user, features, bypass]);

  return { accessRules, loading, hasFeature };
};
```

- [ ] **Step 5: Deletar `src/hooks/useIesFeatures.ts`** e rodar `npx tsc -p tsconfig.app.json --noEmit` para achar TODOS os consumidores restantes. Corrigir cada um (grep por `useIesFeatures` — não deve sobrar nenhum import).

- [ ] **Step 6: `src/utils/experiences.ts` — pular `gestao` quando o portal está off.** Substituir o corpo do find (linha 63):

```ts
  const dedicated = ENTRYPOINT_PRECEDENCE.find(
    (exp) =>
      experiences.includes(exp) &&
      // Portal do gestor é contratado por IES: sem `gestao.enabled`
      // (espelhado em accessRules.desempenhoInstitucional), a precedência
      // pula para a experiência seguinte — evita loop de redirect com o
      // ExperienceGuard.
      (exp !== 'gestao' || accessRules.desempenhoInstitucional),
  );
```

- [ ] **Step 7: `src/experiences/shared/ExperienceGuard.tsx` — gate de feature do portal gestao.** Substituir o bloco do return (linhas 33-35):

```tsx
  const featureGateOk =
    experience !== 'gestao' || accessRules.desempenhoInstitucional;

  if (!hasExperience(access, experience) || !featureGateOk) {
    return <Navigate to={getDefaultRouteForUser(user, accessRules, access)} replace />;
  }
```

- [ ] **Step 8: `src/utils/accessRules.ts` — enxugar.** Remover `getAccessRules`, `DEFAULT_RULES`, `ADMIN_RULES` e o doc-comment do topo que os descreve; manter `isAdmin`/`isProfessor`/`isGestor`/`isGestorGrupo`/`isAtendimento` (escopo de dados: `useInstitutionalPerformanceData`, `SimuladosDisponiveis` etc.). Rodar `npx tsc -p tsconfig.app.json --noEmit`; corrigir qualquer consumidor restante de `getAccessRules` trocando por `useAccessRules()` (conferir `src/components/LoginForm.tsx`, `src/App.tsx` — se usarem `getAccessRules` para rota pós-login, passam a usar o `accessRules` do hook, que o `DynamicRoutes` já espera carregar).

- [ ] **Step 9: Atualizar testes existentes que quebram** — `src/test/unit/accessRules.test.ts` (remover casos de `getAccessRules`; manter os de `isAdmin`/`isGestor`), `src/test/unit/experiences.test.ts` (novo comportamento: `gestao` na precedência exige `desempenhoInstitucional: true`), `src/test/components/ExperienceGuard.test.tsx` (caso novo: user com experiência `gestao` mas `desempenhoInstitucional: false` → redirect).

- [ ] **Step 10: Rodar tudo e ver passar**

Run: `npx vitest run src/test/unit/useAccessRules.test.tsx src/test/unit/accessRules.test.ts src/test/unit/experiences.test.ts src/test/components/ExperienceGuard.test.tsx` → PASS
Run: `npx tsc -p tsconfig.app.json --noEmit` → sem erros

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: fonte única de acesso via get_effective_features (remove bypass por role)"
```

---

### Task 2: Gates da experiência do aluno (rota do modo prova)

**Files:**
- Modify: `src/experiences/aluno/alunoRoutes.tsx:134-144`
- Test: `src/test/unit/buildAppRoutes.test.ts` (atualizar se referenciar a rota da prova)

**Interfaces:**
- Consumes: `AccessRules` (inalterada) e o helper local `gated()` já existente em `alunoRoutes.tsx:60-68`.
- Produces: `/simulados/:id/prova` gated por `accessRules.simulados`.

- [ ] **Step 1: Teste que falha** — adicionar em `src/test/unit/buildAppRoutes.test.ts` (seguindo o padrão dos casos existentes do arquivo):

```ts
it('modo prova é bloqueado quando a IES não tem simulados', () => {
  const rules = { ...ALL_OFF_RULES, simulados: false };
  const routes = alunoRoutes(alunoUser, rules, alunoAccess);
  const prova = routes.find((r) => r.path === '/simulados/:id/prova');
  expect(prova).toBeDefined();
  // elemento deve ser um <Navigate>, não a página da prova
  expect((prova!.element as React.ReactElement).type).toBe(Navigate);
});
```

(Usar os fixtures/nomes reais do arquivo — se `ALL_OFF_RULES`/`alunoUser` não existirem, criar constantes locais no teste com todos os campos de `AccessRules` em `false` e um `User` mínimo.)

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/test/unit/buildAppRoutes.test.ts` → FAIL (elemento é a página, não Navigate).

- [ ] **Step 3: Implementar** — em `src/experiences/aluno/alunoRoutes.tsx`, substituir o objeto de rota da prova (linhas 134-144) por:

```tsx
    // Modo Prova segue o gate de simulados da IES. Roda em tela cheia (sem
    // aguardar dados de página); ainda passa pelo Layout — que esconde
    // sidebar/bottom-nav internamente (isModoProva) — para preservar
    // ImpersonationBanner/FeedbackFab do App.
    gated(
      accessRules.simulados,
      '/simulados/:id/prova',
      <ExperiencePage waitForData={false}>
        <ModoProva />
      </ExperiencePage>,
      fallback,
    ),
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/test/unit/buildAppRoutes.test.ts` → PASS
Run: `npx tsc -p tsconfig.app.json --noEmit` → sem erros

- [ ] **Step 5: Commit**

```bash
git add src/experiences/aluno/alunoRoutes.tsx src/test/unit/buildAppRoutes.test.ts
git commit -m "feat: modo prova sob o gate aluno.simulados"
```

---

### Task 3: Gates da experiência do gestor (nav + rotas + drawers)

**Files:**
- Modify: `src/experiences/gestor/GestorNav.ts`
- Modify: `src/experiences/gestor/gestorRoutes.tsx`
- Create: `src/experiences/gestor/GestorFeatureGate.tsx`
- Modify: `src/experiences/gestor/GestorLayout.tsx:45-88, 119-135`
- Test: `src/test/unit/experiences-nav.test.ts` (atualizar), `src/test/unit/gestorFeatureGate.test.tsx` (novo)

**Interfaces:**
- Consumes: `useEffectiveFeatures(): { hasFeature: (key: string) => boolean; loading: boolean }` (Task 1); `useAccessRules` para fallback de rota.
- Produces: `GestorNavItem.featureKey: string` (obrigatório); `filterGestorNav(items, access, hasFeature)` — assinatura NOVA com 3º parâmetro; componente `GestorFeatureGate({ featureKey, children })`; `GestorIndexRedirect` (index de `/gestor` resolve a primeira tela ligada).

- [ ] **Step 1: Testes que falham** — criar `src/test/unit/gestorFeatureGate.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { GESTOR_NAV, filterGestorNav } from '@/experiences/gestor/GestorNav';
import type { Access } from '@/experiences/access';

const gestorAccess: Access = {
  experiences: ['aluno', 'gestao'],
  capabilities: ['institutional.view', 'alunos.view'],
} as Access;

describe('GestorNav com gates por feature', () => {
  it('todo item de nav declara featureKey gestao.*', () => {
    for (const item of GESTOR_NAV) {
      expect(item.featureKey, `item ${item.url} sem featureKey`).toMatch(/^gestao\./);
    }
  });

  it('filterGestorNav corta itens sem feature ligada', () => {
    const hasFeature = (key: string) => key === 'gestao.alunos';
    const items = filterGestorNav(GESTOR_NAV, gestorAccess, hasFeature);
    expect(items.map((i) => i.url)).toEqual(['/gestor/alunos']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/test/unit/gestorFeatureGate.test.tsx` → FAIL (`featureKey` não existe).

- [ ] **Step 3: `GestorNav.ts`** — adicionar `featureKey` ao tipo e aos itens; nova assinatura do filtro:

```ts
export interface GestorNavItem extends NavItem {
  /** Módulo do Desempenho Institucional renderizado nesta rota. */
  tab: DesempenhoV2Tab;
  /** Feature da IES (ies_features) que libera este módulo. */
  featureKey: string;
}

export const GESTOR_NAV: GestorNavItem[] = [
  { title: 'Visão Institucional', url: '/gestor/visao-institucional', tab: 'visao-institucional', capability: 'institutional.view', featureKey: 'gestao.visao_institucional' },
  { title: 'Diagnóstico Curricular', url: '/gestor/diagnostico-curricular', tab: 'diagnostico-curricular', capability: 'institutional.view', featureKey: 'gestao.diagnostico_curricular' },
  { title: 'Visão de Alunos', url: '/gestor/alunos', tab: 'visao-alunos', capability: 'alunos.view', featureKey: 'gestao.alunos' },
  { title: 'Insights Pedagógicos', url: '/gestor/insights-pedagogicos', tab: 'insights-pedagogicos', capability: 'institutional.view', featureKey: 'gestao.insights_pedagogicos' },
  { title: 'Inteligência Decisória', url: '/gestor/inteligencia-decisoria', tab: 'inteligencia-decisoria', capability: 'institutional.view', featureKey: 'gestao.inteligencia_decisoria' },
];

/** Sub-navegação filtrada pelas capabilities do usuário E pelas features da IES. */
export const filterGestorNav = (
  items: GestorNavItem[],
  access: Access,
  hasFeature: (key: string) => boolean,
): GestorNavItem[] =>
  items.filter(
    (item) =>
      (item.capability == null || can(access, item.capability)) &&
      hasFeature(item.featureKey),
  );
```

- [ ] **Step 4: Criar `src/experiences/gestor/GestorFeatureGate.tsx`:**

```tsx
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';

interface GestorFeatureGateProps {
  featureKey: string;
  children: React.ReactNode;
}

/**
 * Gate por feature das rotas-filhas de `/gestor`. Feature desligada para a
 * IES → volta ao index do portal (que resolve a primeira tela ligada via
 * GestorIndexRedirect — sem loop: se nada estiver ligado, o index sai do
 * portal).
 */
export const GestorFeatureGate: React.FC<GestorFeatureGateProps> = ({
  featureKey,
  children,
}) => {
  const { hasFeature, loading } = useEffectiveFeatures();
  if (loading) return null;
  if (!hasFeature(featureKey)) return <Navigate to="/gestor" replace />;
  return <>{children}</>;
};

/**
 * Index de `/gestor`: redireciona para a primeira tela ligada (nav já
 * filtrada por capability+feature). Sem nenhuma tela ligada, sai do portal
 * para a experiência base do usuário (sem considerar gestao, para não
 * voltar aqui).
 */
export const GestorIndexRedirect: React.FC = () => {
  const { user, access } = useAuth();
  const { accessRules } = useAccessRules();
  const { hasFeature, loading } = useEffectiveFeatures();
  if (loading) return null;
  const first = filterGestorNav(GESTOR_NAV, access, hasFeature)[0];
  if (first) return <Navigate to={first.url} replace />;
  return (
    <Navigate
      to={getDefaultRouteForUser(user, { ...accessRules, desempenhoInstitucional: false }, access)}
      replace
    />
  );
};
```

(Imports completos no topo do arquivo: `useAuth` de `@/contexts/AuthContext`, `useAccessRules` de `@/hooks/useAccessRules`, `GESTOR_NAV, filterGestorNav` de `@/experiences/gestor/GestorNav`, `getDefaultRouteForUser` de `@/utils/experiences`.)

- [ ] **Step 5: `gestorRoutes.tsx`** — envolver cada rota-filha e trocar o index:

```tsx
    children: [
      { index: true, element: <GestorIndexRedirect /> },
      { path: 'visao-institucional', element: <GestorFeatureGate featureKey="gestao.visao_institucional"><VisaoInstitucionalPage /></GestorFeatureGate> },
      { path: 'diagnostico-curricular', element: <GestorFeatureGate featureKey="gestao.diagnostico_curricular"><DiagnosticoCurricularPage /></GestorFeatureGate> },
      { path: 'alunos', element: <GestorFeatureGate featureKey="gestao.alunos"><AlunosPage /></GestorFeatureGate> },
      { path: 'insights-pedagogicos', element: <GestorFeatureGate featureKey="gestao.insights_pedagogicos"><InsightsPedagogicosPage /></GestorFeatureGate> },
      { path: 'inteligencia-decisoria', element: <GestorFeatureGate featureKey="gestao.inteligencia_decisoria"><InteligenciaDecisoriaPage /></GestorFeatureGate> },
    ],
```

(Adicionar import: `import { GestorFeatureGate, GestorIndexRedirect } from '@/experiences/gestor/GestorFeatureGate';` e remover o import de `Navigate` se ficar sem uso — os redirects de compatibilidade das linhas 41-42 ainda o usam, manter.)

- [ ] **Step 6: `GestorLayout.tsx`** — nav + drawers gateados. No `GestorLayoutContent`:

```tsx
  const { hasFeature } = useEffectiveFeatures();
  const navItems = filterGestorNav(GESTOR_NAV, access, hasFeature);
  const canExport = hasFeature('gestao.exportar');
  const canChat = hasFeature('gestao.ia');
```

Envolver o botão "Exportar" (linhas 71-78) em `{canExport && (...)}` e o botão "IA" (linhas 79-86) em `{canChat && (...)}`. Envolver `<ExportReportDrawer .../>` em `{canExport && (...)}` e `<AiChatDrawer .../>` em `{canChat && (...)}`. Adicionar import `import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';`.

- [ ] **Step 7: Atualizar `src/test/unit/experiences-nav.test.ts`** — os casos de `filterGestorNav` ganham o 3º argumento (`() => true` para preservar os cenários de capability existentes).

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run src/test/unit/gestorFeatureGate.test.tsx src/test/unit/experiences-nav.test.ts` → PASS
Run: `npx tsc -p tsconfig.app.json --noEmit` → sem erros

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: portal do gestor gateado por features da IES (nav, rotas e drawers)"
```

---

### Task 4: Tela `/admin/ies` redesenhada (catálogo do banco, seções, master, busca, copiar, histórico)

**Files:**
- Create: `src/services/admin/featureCatalog.ts`
- Rewrite: `src/components/admin/ies/IesFeaturesBoard.tsx` (vira orquestrador: busca + lista de cards)
- Create: `src/components/admin/ies/IesFeatureCard.tsx`
- Create: `src/components/admin/ies/CopyFeaturesDialog.tsx`
- Create: `src/components/admin/ies/IesAuditTrail.tsx`
- Test: `src/test/unit/featureCatalog.test.ts` (novo)

**Interfaces:**
- Consumes: tabela `feature_catalog` (Task 0); `setIesFeatures(iesId, changes)` de `src/services/admin/iesFeatures.ts` (INALTERADA — aceita qualquer chave); `useAuditLog(filters, options)` de `src/services/admin/audit.ts` (`filters: { action?, search?, from?, limit?, offset? }` → `{ total, rows: AuditLogRow[] }`, `AuditLogRow.metadata.ies_id` identifica a IES); `describeAuditEntry` de `src/services/admin/auditActions.ts`.
- Produces: `FeatureCatalogEntry { key: string; experience: 'aluno' | 'gestao'; label: string; description: string; sortOrder: number; isMaster: boolean }`; `fetchFeatureCatalog(): Promise<FeatureCatalogEntry[]>`.

- [ ] **Step 1: Teste que falha** — `src/test/unit/featureCatalog.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { fetchFeatureCatalog, groupCatalogByExperience } from '@/services/admin/featureCatalog';

describe('featureCatalog', () => {
  it('mapeia snake_case do banco para o tipo do front, ordenado', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                { key: 'gestao.enabled', experience: 'gestao', label: 'Portal do Gestor', description: 'Master', sort_order: 100, is_master: true },
                { key: 'aluno.home', experience: 'aluno', label: 'Home', description: 'Início', sort_order: 10, is_master: false },
              ],
              error: null,
            }),
        }),
      }),
    });
    const catalog = await fetchFeatureCatalog();
    expect(catalog[0]).toEqual({ key: 'gestao.enabled', experience: 'gestao', label: 'Portal do Gestor', description: 'Master', sortOrder: 100, isMaster: true });
    const grouped = groupCatalogByExperience(catalog);
    expect(grouped.aluno.map((f) => f.key)).toEqual(['aluno.home']);
    expect(grouped.gestao[0].isMaster).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/test/unit/featureCatalog.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/services/admin/featureCatalog.ts`:**

```ts
import { supabase } from '@/integrations/supabase/client';
import { withRetry } from '@/utils/networkRetry';

/** Entrada do catálogo de features (`feature_catalog`) — a tela /admin/ies renderiza a partir daqui. */
export interface FeatureCatalogEntry {
  key: string;
  experience: 'aluno' | 'gestao';
  label: string;
  description: string;
  sortOrder: number;
  isMaster: boolean;
}

interface FeatureCatalogRow {
  key: string;
  experience: 'aluno' | 'gestao';
  label: string;
  description: string;
  sort_order: number;
  is_master: boolean;
}

/**
 * `feature_catalog` ainda não está nos tipos gerados do Supabase — cast local
 * documentado (mesmo padrão de `src/services/admin/iesFeatures.ts`).
 */
export async function fetchFeatureCatalog(): Promise<FeatureCatalogEntry[]> {
  return withRetry(async () => {
    const { data, error } = await (supabase.from as (
      table: string,
    ) => {
      select: (cols: string) => {
        eq: (col: string, v: boolean) => {
          order: (col: string) => PromiseLike<{ data: FeatureCatalogRow[] | null; error: { message: string } | null }>;
        };
      };
    })('feature_catalog')
      .select('key, experience, label, description, sort_order, is_master')
      .eq('active', true)
      .order('sort_order');
    if (error) throw new Error(`feature_catalog: ${error.message}`);
    return (data ?? []).map((row) => ({
      key: row.key,
      experience: row.experience,
      label: row.label,
      description: row.description,
      sortOrder: row.sort_order,
      isMaster: row.is_master,
    }));
  });
}

/** Catálogo agrupado por experiência (preservando a ordem de sort_order). */
export function groupCatalogByExperience(
  catalog: FeatureCatalogEntry[],
): { aluno: FeatureCatalogEntry[]; gestao: FeatureCatalogEntry[] } {
  return {
    aluno: catalog.filter((f) => f.experience === 'aluno'),
    gestao: catalog.filter((f) => f.experience === 'gestao'),
  };
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/test/unit/featureCatalog.test.ts` → PASS. Commit parcial:

```bash
git add src/services/admin/featureCatalog.ts src/test/unit/featureCatalog.test.ts
git commit -m "feat: serviço do catálogo de features (feature_catalog)"
```

- [ ] **Step 5: Reescrever a UI.** Manter TODO o comportamento de pendências/salvamento existente (diff local por IES, snapshot `sentKeys`, patch otimista — copiar de `IesFeaturesBoard.tsx:95-154` atual). Estrutura nova:

**`IesFeaturesBoard.tsx`** (orquestrador):
- Carrega em paralelo: `fetchFeatureCatalog()`, `supabase.from('ies').select('id, nome').order('nome')` e `supabase.from('ies_features').select('ies_id, feature_key, enabled')` (manter o `loadIesData` atual, mas construindo `features` a partir das chaves do catálogo em vez de `AVAILABLE_FEATURES`).
- Estado: igual ao atual (`iesList`, `loading`, `error`, `saving`, `pendingChanges`) + `search: string` + `catalog: FeatureCatalogEntry[]`.
- Header da lista: `<Input placeholder="Buscar IES..." />` (shadcn `Input`, ícone `Search` de lucide) filtrando `iesList` por `nome` (case/acento-insensitive: `normalize('NFD').replace(/\p{Diacritic}/gu, '')`).
- Renderiza um `<IesFeatureCard>` por IES filtrada, passando: `ies`, `catalog` agrupado (`groupCatalogByExperience`), `pendingChanges[ies.id]`, `saving === ies.id`, callbacks `onToggle(featureKey, enabled)`, `onSave()`, `onCopyFrom(sourceIesId)` e a lista completa de IES (para o dialog de cópia).
- `onCopyFrom`: pega o estado efetivo (original + pending) da IES fonte e grava como `pendingChanges` da IES destino APENAS as chaves que diferem do estado atual do destino (nada é salvo direto — vira diff pendente).

**`IesFeatureCard.tsx`**:
- Header: ícone `Building2` + nome + badge `"{n} alterações não salvas"` (quando `pending`) + botões `Copiar de...` (abre `CopyFeaturesDialog`), `Histórico` (colapsa `IesAuditTrail`) e `Salvar` (mesma lógica/disabled de hoje).
- Seção **"Experiência do Aluno"** com contador `X/7` (`MonoValue`) e grid `sm:grid-cols-3` dos switches das chaves `aluno.*` (mesmo visual de linha de switch de hoje, `IesFeaturesBoard.tsx:195-216` atual).
- Seção **"Experiência do Gestor"** com contador `X/8`: primeiro o switch do master (`isMaster`, destacado com borda), depois os demais `gestao.*` com `disabled={savingDisabled || !masterOn}` e `className` com `opacity-50` quando master off (`masterOn` = valor efetivo pendente-aware de `gestao.enabled`). O estado dos subswitches é preservado (só desabilita visualmente).
- Contadores usam o valor efetivo (original + pending), como `countEnabledFeatures` atual.

**`CopyFeaturesDialog.tsx`**: shadcn `Dialog` com `Select` de IES fonte (todas menos a atual) + preview "N features vão mudar" + botão "Aplicar como pendências". Não chama RPC nenhuma.

**`IesAuditTrail.tsx`**: usa `useAuditLog({ action: 'ies_features_update', limit: 100 }, { enabled: open })`; filtra client-side `rows.filter((r) => (r.metadata as { ies_id?: string } | null)?.ies_id === iesId)`; renderiza até 10 linhas: data (`toLocaleString('pt-BR')`), `admin_nome` (campo `AuditLogRow`), e o diff de `metadata.changes` como badges `chave: on/off`. Vazio → texto "Sem alterações registradas.".

- [ ] **Step 6: Verificação manual + typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit` → sem erros
Run: `npx vitest run src/test/unit/featureCatalog.test.ts` → PASS
Smoke manual (se houver dev server): `/admin/ies` renderiza cards com 2 seções, busca filtra, master desabilita subswitches, salvar dispara `admin_set_ies_features` com chaves `aluno.*`/`gestao.*`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: tela IES & contratos catálogo-driven (seções por experiência, master, busca, copiar, histórico)"
```

---

### Task 5: Regressão de gates + suíte inteira verde

**Files:**
- Create: `src/test/unit/route-gates.test.tsx`
- Modify: quaisquer testes ainda vermelhos após Tasks 1-4

**Interfaces:**
- Consumes: `alunoRoutes(user, accessRules, access)` (Task 2), `GESTOR_NAV` com `featureKey` (Task 3), `gestorRoutes()` (Task 3).

- [ ] **Step 1: Escrever o teste-guarda** — `src/test/unit/route-gates.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { alunoRoutes } from '@/experiences/aluno/alunoRoutes';
import { GESTOR_NAV } from '@/experiences/gestor/GestorNav';
import type { AccessRules, User } from '@/types';

const ALL_OFF: AccessRules = {
  home: false, studyGuide: false, dashboard: false, SimuladoDesempenho: false,
  userManagement: false, sanarclass: false, simulados: false, analytics: false,
  desempenhoInstitucional: false, errorNotebook: false,
};

const aluno: User = {
  id: 'u1', email: 'a@a.com', nome: 'Aluno', id_ies: 'ies1', ies_nome: 'IES', roles: [],
};

/** Rotas do aluno deliberadamente SEM gate por feature (decisão documentada na spec). */
const ALUNO_UNGATED_ALLOWLIST = ['/meus-feedbacks'];

describe('guarda de regressão: toda rota nova precisa declarar gate', () => {
  it('com todas as features off, toda rota do aluno (fora da allowlist) redireciona', () => {
    const routes = alunoRoutes(aluno, ALL_OFF, { experiences: ['aluno'], capabilities: [] } as never);
    for (const route of routes) {
      if (ALUNO_UNGATED_ALLOWLIST.includes(route.path ?? '')) continue;
      const el = route.element as React.ReactElement;
      expect(el.type, `rota ${route.path} montada sem gate — adicione o gate ou inclua na allowlist`).toBe(Navigate);
    }
  });

  it('todo item da nav do gestor declara featureKey gestao.*', () => {
    for (const item of GESTOR_NAV) {
      expect(item.featureKey, `item ${item.url} sem featureKey`).toMatch(/^gestao\./);
    }
  });
});
```

- [ ] **Step 2: Rodar o teste-guarda** — `npx vitest run src/test/unit/route-gates.test.tsx` → PASS (se FAIL, é gate faltando das Tasks 2/3 — corrigir lá, não afrouxar o teste).

- [ ] **Step 3: Suíte inteira + typecheck**

Run: `npx vitest run` → 0 falhas NOVAS (a main estava 100% verde após o PR #15; qualquer falha nova é desta rodada — corrigir)
Run: `npx tsc -p tsconfig.app.json --noEmit` → sem erros
Run: `npx eslint src --max-warnings=0` apenas nos arquivos tocados se o repo tiver script equivalente (conferir `package.json`; se o lint global estiver quebrado — CI morto conhecido — restringir aos arquivos da rodada).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: guarda de regressão de gates por rota (aluno + gestor)"
```

---

### Task 6 (pós-merge, NÃO nesta rodada — registrado para rastreio): Cleanup

Somente dias após a virada em prod, comportamento confirmado:
1. DELETE das linhas antigas de `ies_features` (`home`, `studyGuide`, `dashboard`, `simulados`, `SimuladoDesempenho`, `sanarclass`, `errorNotebook`, `desempenhoInstitucional`, `analytics`, `cronogramaEnamed`, `enamed`, `intensivoUSCS`) via Lovable.
2. `drop function public.get_ies_features(uuid); drop function public.ies_has_feature(uuid, text);` (mortas).
3. Remover `analytics` da interface `AccessRules` e dos testes.

## Verificação final de ponta a ponta (loop principal, antes do PR)

1. `npx vitest run` verde + `npx tsc -p tsconfig.app.json --noEmit` limpo.
2. Com Task 0 aplicada em prod: logar com conta admin → `/admin/ies` mostra as duas seções por IES; alternar uma feature `aluno.*` de uma IES de teste e confirmar no banco (via Lovable) a linha nova.
3. Impersonar/logar aluno da IES de teste → tela some/aparece conforme toggle SEM relogar (realtime).
4. Logar gestor de IES com `gestao.enabled=false` (IES de teste) → cai na experiência de aluno, sem loop de redirect.
5. Abrir PR (base main) com o roteiro de teste no corpo; merge = deploy.
