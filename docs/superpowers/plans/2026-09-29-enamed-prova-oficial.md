# ENAMED 2026 · Prova oficial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the official ENAMED 2026 exam (already loaded as simulado `97d67578-4204-4009-8056-fd0df28aa30d`, `prova_oficial = true`) a dedicated student screen and its own block in the gestor portal v2. Also keep it out of the regular series, the contract count and the student rankings.

**Architecture:** Four RPCs, all created or replaced from the **live prod definition**:
- a new student list RPC and a new student detail RPC;
- a new gestor block RPC;
- one-line filters added to `get_gestor_visao_geral`, `get_user_rankings` and `get_user_simulados`.

The front has a new `src/features/prova-oficial` module for the student and small additions in `src/features/gestor`. Every RPC returns plain JSON, and the front reads it through React Query hooks.

**Tech Stack:** Postgres (Supabase, project `gvqvrmkizemwsasmupmo`), React 18 + Vite + TS, React Query, shadcn/ui + Tailwind, recharts, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-enamed-prova-oficial-design.md`

## Global Constraints

- All UI copy in pt-BR.
- **The student never sees TRI**, proficiency or an estimated score: only acertos, areas and questions (spec D3).
- **Student question review follows the student's own caderno order and numbering** (D4). The fallback is caderno 1 when `simulado_aluno_caderno` has no row.
- Gestor: the prova is **excluded from `get_gestor_visao_geral`** (series, "atual", KPIs), gets its own block, and is not linked to `ies_simulado_previsto` (D5).
- **Keep `type = 'simulado_enamed'` everywhere.** Never introduce a new type (D6).
- **Every `CREATE OR REPLACE` of an existing RPC must start from `pg_get_functiondef` of the live prod function, never from a repo `.sql`.** Live bodies carry a `gestao.enabled` feature guard that repo migrations don't have (see memory "armadilha do guard de feature"). Save the old definition to `supabase/rollback/<fn>_<timestamp>.sql` before replacing it.
- New RPCs:
  - `SECURITY DEFINER`, `SET search_path TO 'public'`;
  - `REVOKE ALL ... FROM PUBLIC, anon`;
  - `GRANT EXECUTE ... TO authenticated`.
- **The results-released predicate must be copied verbatim from the live `get_user_simulados`.** Do not invent it.
- Front agents do **not** edit `src/integrations/supabase/types.ts`. Only Task 1 does.
- Agents do **not** commit, push or publish. The orchestrator reviews, runs tests and commits.
- Prod SQL runs through MCP `mcp__5f1e7e5f-622a-4dd3-a891-d2017c19269e__execute_sql` / `apply_migration` with `project_id: "gvqvrmkizemwsasmupmo"`. The orchestrator has the user's authorization to apply in prod once the regression checks pass.

## Shared contracts (all tasks rely on these exact shapes)

```ts
// get_aluno_provas_oficiais() -> ProvaOficialResumo[]   (never null; [] when none)
export interface ProvaOficialResumo {
  simuladoId: string;
  nome: string;
  dataRealizacao: string | null;   // ISO
  caderno: number | null;          // 1 | 2 | null
  acertos: number;
  totalValidas: number;            // questions not annulled
}

// get_aluno_prova_oficial(p_simulado_id uuid) -> ProvaOficialAluno | null
export interface ProvaOficialAluno {
  simuladoId: string;
  nome: string;
  dataRealizacao: string | null;
  caderno: number;                 // effective caderno (fallback 1)
  acertos: number;
  totalValidas: number;
  emBranco: number;                // non-annulled questions with resposta null
  areas: { area: string; acertos: number; total: number }[];          // ordered by total desc, area asc
  trajetoria: { simuladoId: string; nome: string; data: string | null; acertoPct: number | null; provaOficial: boolean }[]; // chronological, prova last
  questoes: QuestaoProvaOficial[]; // ordered by posicao (student's caderno)
}
export interface QuestaoProvaOficial {
  questionId: string;
  posicao: number;                 // number in the student's caderno
  numeroCaderno1: number;
  grandeArea: string | null;
  especialidade: string | null;
  enunciado: string;
  alternativas: { A: string | null; B: string | null; C: string | null; D: string | null };
  imagem: string | null;
  imagem2: string | null;
  imagemComentario: string | null;
  correta: string;
  resposta: string | null;
  acertou: boolean;
  anulada: boolean;
  comentario: string | null;
}

// get_gestor_prova_oficial(p_ies_id uuid, p_semestre text) -> Envelope<ProvaOficialGestorPayload>
// (same { data, meta } envelope and Meta shape as get_gestor_visao_geral)
export interface ProvaOficialGestor {
  simuladoId: string;
  nome: string;
  data: string | null;
  participantes: number;           // students of the recorte with answers
  comTri: number;                  // of those, with resultados_alunos_tri.score_proprio
  conceito: number | null;         // 1..5, null when comTri = 0
  proficientesPct: number | null;  // 0..100 int, null when comTri = 0
  mediaAcertos: number | null;     // 1 decimal
  totalQuestoes: number;           // non-annulled
  amostraPequena: boolean;         // participantes < 10
  numeracaoCaderno2: Record<string, number>; // key = numero_questao (caderno 1), value = position in caderno 2
}
export interface ProvaOficialGestorPayload {
  provas: ProvaOficialGestor[];    // released provas oficiais of the IES, newest first
  idsProvasOficiais: string[];     // same ids, for badges
}
```

---

### Task 1: Database — student RPCs, gestor RPC, exclusion filters (single agent, SQL)

**Files:**
- Create: `supabase/migrations/<applied_version>_prova_oficial_rpcs.sql`. Rename it to the version MCP records after `apply_migration`.
- Create: `supabase/rollback/get_gestor_visao_geral_<ts>.sql`, `supabase/rollback/get_user_rankings_<ts>.sql`, `supabase/rollback/get_user_simulados_<ts>.sql` (live definitions before the change).
- Modify: `src/integrations/supabase/types.ts`:
  - `simulados_admin` Row/Insert/Update: add `prova_oficial: boolean` (Insert/Update optional);
  - add Tables `simulado_cadernos` and `simulado_aluno_caderno`;
  - add Functions `get_aluno_provas_oficiais` (Args never, Returns Json), `get_aluno_prova_oficial` (Args `{ p_simulado_id: string }`, Returns Json) and `get_gestor_prova_oficial` (Args `{ p_ies_id: string; p_semestre: string }`, Returns Json).

**Interfaces:** Produces the three RPCs with the exact JSON shapes in "Shared contracts".

- [ ] **Step 1: Snapshot the live definitions**

  Run `SELECT pg_get_functiondef('public.<fn>'::regproc)` for `get_gestor_visao_geral`, `get_user_rankings` and `get_user_simulados`, and save each to `supabase/rollback/`. Copy the results-released predicate verbatim out of `get_user_simulados` and reuse it everywhere below as `<RELEASED(s)>`.

- [ ] **Step 2: Capture the regression baseline, BEFORE any change**

  Inside one read-only transaction, impersonate the admin `felipe.souza@sanar.com`:

  ```sql
  BEGIN;
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', (SELECT id FROM public.users WHERE email='felipe.souza@sanar.com'), 'role','authenticated')::text, true);
  SELECT i.nome, sem, md5((public.get_gestor_visao_geral(i.id, sem)->'data')::text) AS h
  FROM public.ies i
  JOIN public.ies_features f ON f.ies_id = i.id AND f.feature_key = 'gestao.portal_v2' AND f.enabled
  CROSS JOIN unnest(ARRAY['geral','6ano']) sem
  ORDER BY 1,2;
  ROLLBACK;
  ```

  Save the output to `supabase/rollback/visao_geral_baseline_<ts>.txt`. If the RPC returns no `data` key, hash the whole result minus `meta`.

- [ ] **Step 3: Write the migration.** Contents:

  **a) `get_gestor_visao_geral`:** the live body, with **only** the change `WHERE type = 'simulado_enamed'` → `WHERE type = 'simulado_enamed' AND NOT prova_oficial` in every `(SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed')`. Keep everything else byte-identical, including the guard.

  **b) `get_user_rankings`:** the live body, adding `AND NOT sa.prova_oficial`, or the equivalent on the simulados join, **only in the branch where `p_simulado_id IS NULL`**, so the prova doesn't enter the Home/Desempenho rankings.

  **c) `get_user_simulados`:** the live body, adding `AND NOT s.prova_oficial`, so the prova doesn't appear in the generic Desempenho/Correção lists. The student reaches it through the dedicated card.

  **d) New `get_aluno_provas_oficiais()`:**

  ```sql
  CREATE OR REPLACE FUNCTION public.get_aluno_provas_oficiais()
  RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'simuladoId', x.id, 'nome', x.nome, 'dataRealizacao', x.data_realizacao,
      'caderno', x.caderno, 'acertos', x.acertos, 'totalValidas', x.total
    ) ORDER BY x.data_realizacao DESC NULLS LAST), '[]'::jsonb)
    FROM (
      SELECT s.id, s.nome, s.data_realizacao, sac.caderno,
             count(*) FILTER (WHERE a.correct AND NOT coalesce(q.anulada,false)) AS acertos,
             count(*) FILTER (WHERE NOT coalesce(q.anulada,false))                AS total
      FROM public.simulados_admin s
      JOIN public.answer_progress a ON a.simulado = s.id AND a.user_id = auth.uid()
      JOIN public.questoes_simulado q ON q.id = a.question_id
      LEFT JOIN public.simulado_aluno_caderno sac ON sac.simulado_id = s.id AND sac.user_id = auth.uid()
      WHERE s.prova_oficial AND <RELEASED(s)>
      GROUP BY s.id, s.nome, s.data_realizacao, sac.caderno
    ) x;
  $$;
  ```

  **e) New `get_aluno_prova_oficial(p_simulado_id uuid)`** (plpgsql, STABLE, SECURITY DEFINER):
  - Return NULL when `auth.uid()` is null, the simulado isn't `prova_oficial` or isn't `<RELEASED(s)>`, or the user has no `answer_progress` rows for it.
  - Effective caderno: `coalesce((SELECT caderno FROM simulado_aluno_caderno WHERE simulado_id = p_simulado_id AND user_id = auth.uid()), 1)`.
  - `questoes`: `questoes_simulado q`
    - LEFT JOIN `simulado_cadernos c ON c.simulado_id = q.simulado_id AND c.question_id = q.id AND c.caderno = <eff>`;
    - LEFT JOIN `answer_progress a ON a.simulado = q.simulado_id AND a.question_id = q.id AND a.user_id = auth.uid()`;
    - `posicao = coalesce(c.posicao, q.numero_questao)`, `numeroCaderno1 = q.numero_questao`;
    - `alternativas = jsonb_build_object('A', q.alternativa_a, 'B', q.alternativa_b, 'C', q.alternativa_c, 'D', q.alternativa_d)`;
    - `resposta = a.resposta_usuario`, `acertou = coalesce(a.correct,false) AND NOT q.anulada`;
    - order by `posicao`.
  - `acertos` = count of `acertou`; `totalValidas` = count of non-annulled questions; `emBranco` = non-annulled with `resposta IS NULL`.
  - `areas` = group by `coalesce(q.grande_area,'Sem área')` over non-annulled questions, ordered by total desc, area asc.
  - `trajetoria`:
    - the user's other simulados: `type='simulado_enamed' AND NOT prova_oficial AND <RELEASED(s)>`, with `answer_progress` rows for the user, and `coalesce(s.data_realizacao, s.data_liberacao, s.created_at) <= coalesce(<prova>.data_realizacao, now())`;
    - `acertoPct = round(100.0 * count(*) FILTER (WHERE a.correct AND NOT q.anulada) / nullif(count(*) FILTER (WHERE NOT q.anulada),0))`;
    - keep the last 6 by date, sort them ascending, then append the prova itself with `provaOficial: true` and its own acertoPct.

  **f) New `get_gestor_prova_oficial(p_ies_id uuid, p_semestre text)`:**
  - Build it by copying from the live `get_gestor_visao_geral`, **verbatim**:
    - the parameter handling;
    - the feature guard;
    - the `gestor_pode_acessar_ies` access check;
    - the resolution of `v_ies`;
    - the recorte of students by `p_semestre` (`kpi_alunos` + the semester filter, including `'6ano'` = semesters 11–12 and `'geral'` = all);
    - the `meta` envelope builder.
  - Then compute, for every `simulados_admin s` with `s.prova_oficial AND s.type='simulado_enamed' AND v_ies = ANY(s.ies_ids) AND s.simulado_pai_id IS NULL AND s.status IN ('ativo','encerrado') AND <RELEASED(s)>`:
    - `participantes` = distinct recorte students with `answer_progress` in `s`;
    - `comTri` / `n_prof` from `resultados_alunos_tri r`, where `r.simulado_id = s.id AND r.college_id = v_ies AND r.score_proprio IS NOT NULL AND r.student_id IN recorte`, with `n_prof = count(*) FILTER (WHERE r.score_proprio >= 60)`;
    - `proficientesPct = round(100.0*n_prof/comTri)`;
    - `conceito`: when `p_semestre = 'geral'` and `resultados_ies_tri` has `(v_ies, s.id)`, use its `concept`; otherwise apply the same 90/75/60/40 → 5/4/3/2, else 1, CASE the live function uses; NULL when `comTri = 0`;
    - `mediaAcertos` = `round(avg(per-student count of correct non-annulled), 1)`;
    - `totalQuestoes` = count of non-annulled questions;
    - `amostraPequena = participantes < 10`;
    - `numeracaoCaderno2` = `jsonb_object_agg(q.numero_questao::text, c.posicao)` from `simulado_cadernos c` (caderno 2) joined to `questoes_simulado q`, or `'{}'` when absent.
  - Return `jsonb_build_object('data', jsonb_build_object('provas', <array newest first>, 'idsProvasOficiais', <array>), 'meta', <meta>)`.

  **Grants for d, e and f:** `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION ... TO authenticated;`

- [ ] **Step 4: Apply** with `apply_migration` (name `prova_oficial_rpcs`). Rename the repo file to the recorded version (`SELECT version FROM supabase_migrations.schema_migrations WHERE name='prova_oficial_rpcs'`).

- [ ] **Step 5: Regression check (must pass).** Re-run Step 2's query. Every hash must equal the baseline. The prova is still unreleased, so no IES may change. On any difference, immediately re-apply the saved definition from `supabase/rollback/` and report.

- [ ] **Step 6: Functional check of the new RPCs** inside `BEGIN … ROLLBACK`, which temporarily releases the prova so it is visible:

  ```sql
  BEGIN;
  UPDATE public.simulados_admin SET liberacao_desempenho='imediato' WHERE id='97d67578-4204-4009-8056-fd0df28aa30d';
  -- a) student: pick one caderno-2 student
  SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM public.simulado_aluno_caderno WHERE simulado_id='97d67578-4204-4009-8056-fd0df28aa30d' AND caderno=2 LIMIT 1), 'role','authenticated')::text, true);
  SELECT jsonb_array_length(public.get_aluno_provas_oficiais()) AS n_cards,
         (public.get_aluno_prova_oficial('97d67578-4204-4009-8056-fd0df28aa30d') -> 'questoes' -> 0 ->> 'posicao') AS primeira_posicao,
         (public.get_aluno_prova_oficial('97d67578-4204-4009-8056-fd0df28aa30d') -> 'questoes' -> 0 ->> 'numeroCaderno1') AS c1_da_primeira,
         (public.get_aluno_prova_oficial('97d67578-4204-4009-8056-fd0df28aa30d') ->> 'acertos') AS acertos,
         jsonb_array_length(public.get_aluno_prova_oficial('97d67578-4204-4009-8056-fd0df28aa30d') -> 'areas') AS n_areas;
  -- expected: n_cards=1, primeira_posicao=1, c1_da_primeira=46, n_areas=7, acertos = the value in 09_verificacao expectations for that RA
  -- b) gestor view as admin for PARACATU, 'geral'
  SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM public.users WHERE email='felipe.souza@sanar.com'), 'role','authenticated')::text, true);
  SELECT public.get_gestor_prova_oficial((SELECT id FROM public.ies WHERE nome='PARACATU'), 'geral') -> 'data';
  -- expected: provas[0].participantes = 124, totalQuestoes = 100, numeracaoCaderno2."1" = 30
  ROLLBACK;
  ```

  Also confirm that with the prova **unreleased** (outside the transaction) `get_gestor_prova_oficial` returns `provas: []` and `get_aluno_provas_oficiais()` returns `[]`.

- [ ] **Step 7: Update `types.ts`** as listed under Files. Run `npx tsc --noEmit -p tsconfig.app.json`, or the repo's type-check script, and confirm there are no new errors.

- [ ] **Step 8: Report.** Include the migration version, the rollback file paths, the baseline-vs-after hash comparison (all equal) and the Step 6 outputs.

---

### Task 2: Student — API hooks, pure helpers, card on /simulados (agent A)

**Files:**
- Create: `src/features/prova-oficial/types.ts` (the student interfaces from Shared contracts, verbatim).
- Create: `src/features/prova-oficial/api.ts`.
- Create: `src/features/prova-oficial/lib/questoes.ts` + `src/features/prova-oficial/__tests__/questoes.test.ts`.
- Create: `src/features/prova-oficial/components/CardProvaOficial.tsx` + `src/features/prova-oficial/__tests__/CardProvaOficial.test.tsx`.
- Modify: `src/pages/Simulados.tsx`. Render `<CardsProvaOficial />` between the header block (ends ~L66) and `<Tabs>` (~L68).

**Interfaces:**
- Produces:
  - `useProvasOficiaisAluno(): UseQueryResult<ProvaOficialResumo[]>`;
  - `useProvaOficialAluno(simuladoId: string | undefined): UseQueryResult<ProvaOficialAluno | null>`;
  - `filtrarQuestoes(questoes: QuestaoProvaOficial[], filtro: FiltroQuestoes): QuestaoProvaOficial[]`;
  - `destaquesPorArea(areas: ProvaOficialAluno['areas']): { melhor: string | null; maisFraca: string | null }`;
  - `export type FiltroQuestoes = { tipo: 'todas' | 'erradas' | 'em_branco'; area: string | null }`;
  - `CardsProvaOficial` (default export: none; named export).
- Consumes: the RPCs from Task 1 (by name only).

- [ ] **Step 1: Write the failing tests for the helpers**

```ts
// src/features/prova-oficial/__tests__/questoes.test.ts
import { describe, it, expect } from 'vitest';
import { filtrarQuestoes, destaquesPorArea } from '../lib/questoes';
import type { QuestaoProvaOficial } from '../types';

const q = (over: Partial<QuestaoProvaOficial>): QuestaoProvaOficial => ({
  questionId: 'x', posicao: 1, numeroCaderno1: 1, grandeArea: 'Cirurgia', especialidade: null,
  enunciado: 'e', alternativas: { A: 'a', B: 'b', C: 'c', D: 'd' }, imagem: null, imagem2: null,
  imagemComentario: null, correta: 'A', resposta: 'A', acertou: true, anulada: false, comentario: null, ...over,
});

describe('filtrarQuestoes', () => {
  const lista = [
    q({ questionId: '1', acertou: true }),
    q({ questionId: '2', acertou: false, resposta: 'B' }),
    q({ questionId: '3', acertou: false, resposta: null, grandeArea: 'Pediatria' }),
    q({ questionId: '4', acertou: false, anulada: true, resposta: 'C' }),
  ];
  it('todas devolve tudo na ordem recebida', () => {
    expect(filtrarQuestoes(lista, { tipo: 'todas', area: null }).map((x) => x.questionId)).toEqual(['1', '2', '3', '4']);
  });
  it('erradas exclui acertos, brancos e anuladas', () => {
    expect(filtrarQuestoes(lista, { tipo: 'erradas', area: null }).map((x) => x.questionId)).toEqual(['2']);
  });
  it('em_branco pega só resposta nula não anulada', () => {
    expect(filtrarQuestoes(lista, { tipo: 'em_branco', area: null }).map((x) => x.questionId)).toEqual(['3']);
  });
  it('combina com filtro de área', () => {
    expect(filtrarQuestoes(lista, { tipo: 'todas', area: 'Pediatria' }).map((x) => x.questionId)).toEqual(['3']);
  });
});

describe('destaquesPorArea', () => {
  it('melhor e mais fraca por percentual, empate pelo maior total', () => {
    const r = destaquesPorArea([
      { area: 'Clínica Médica', acertos: 18, total: 24 }, // 75%
      { area: 'Cirurgia', acertos: 7, total: 14 },        // 50%
      { area: 'Pediatria', acertos: 9, total: 12 },       // 75%
    ]);
    expect(r).toEqual({ melhor: 'Clínica Médica', maisFraca: 'Cirurgia' });
  });
  it('lista vazia devolve nulls', () => {
    expect(destaquesPorArea([])).toEqual({ melhor: null, maisFraca: null });
  });
});
```

- [ ] **Step 2: Run to verify it fails.** Run `npx vitest run src/features/prova-oficial/__tests__/questoes.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/questoes.ts`**

```ts
import type { ProvaOficialAluno, QuestaoProvaOficial } from '../types';

export type FiltroQuestoes = { tipo: 'todas' | 'erradas' | 'em_branco'; area: string | null };

export function filtrarQuestoes(questoes: QuestaoProvaOficial[], filtro: FiltroQuestoes): QuestaoProvaOficial[] {
  return questoes.filter((q) => {
    if (filtro.area && q.grandeArea !== filtro.area) return false;
    if (filtro.tipo === 'erradas') return !q.anulada && !q.acertou && q.resposta !== null;
    if (filtro.tipo === 'em_branco') return !q.anulada && q.resposta === null;
    return true;
  });
}

export function destaquesPorArea(areas: ProvaOficialAluno['areas']): { melhor: string | null; maisFraca: string | null } {
  const validas = areas.filter((a) => a.total > 0);
  if (validas.length === 0) return { melhor: null, maisFraca: null };
  const pct = (a: { acertos: number; total: number }) => a.acertos / a.total;
  const ordenadas = [...validas].sort((a, b) => pct(b) - pct(a) || b.total - a.total);
  return { melhor: ordenadas[0].area, maisFraca: ordenadas[ordenadas.length - 1].area };
}
```

- [ ] **Step 4: Run the helper tests.** Expected: PASS.

- [ ] **Step 5: Implement `api.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ProvaOficialAluno, ProvaOficialResumo } from './types';

const rpc = supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export function useProvasOficiaisAluno() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['prova-oficial', user?.id, 'lista'],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await rpc('get_aluno_provas_oficiais');
      if (error) throw new Error(`get_aluno_provas_oficiais: ${error.message}`);
      return (Array.isArray(data) ? data : []) as ProvaOficialResumo[];
    },
  });
}

export function useProvaOficialAluno(simuladoId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['prova-oficial', user?.id, 'detalhe', simuladoId],
    enabled: !!user?.id && !!simuladoId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await rpc('get_aluno_prova_oficial', { p_simulado_id: simuladoId });
      if (error) throw new Error(`get_aluno_prova_oficial: ${error.message}`);
      return (data ?? null) as ProvaOficialAluno | null;
    },
  });
}
```

  Check how `useAuth()` exposes the user id in `src/contexts/AuthContext` (`user?.id`) and adapt if the field differs.

- [ ] **Step 6: Write the failing card test**

  Mock `../api` with `vi.mock`, then:
  - with `[]`, the component renders nothing (`container` is empty);
  - with one resumo `{ nome: 'ENAMED 2026 · Prova oficial (13/09/26)', acertos: 75, totalValidas: 100, caderno: 2, ... }`, it renders the text `ENAMED 2026` and `75 de 100`, and a link with the name "Ver meu resultado" whose `href` is `/simulados/<simuladoId>/prova-oficial`;
  - the rendered text contains neither "TRI" nor "nota".

  Use `render` from `@/test/utils`. `react-router-dom` is mocked globally in `src/test/setup.ts`; if `Link` is affected, add `vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'))` as in `src/features/gestor/__tests__/queries.test.tsx`.

- [ ] **Step 7: Implement `CardProvaOficial.tsx`**
  - Named export `CardsProvaOficial`, which returns `null` while loading, on error or with an empty list. Otherwise it renders one card per prova.
  - Layout: a shadcn `Card` with a highlight border in brand color, a small uppercase label "Prova oficial", the title `nome`, a line `13/09/2026 · Caderno 2` (date formatted `dd/MM/yyyy` from `dataRealizacao`, omitting the caderno when null), the big text `{acertos} de {totalValidas}` with the label "acertos", and a `Link` button "Ver meu resultado" → `/simulados/${simuladoId}/prova-oficial`.
  - Mobile-first: stack vertically, with the button full width on small screens.
  - Follow the visual language of `src/components/simulados/SimuladoCard.tsx` (same Card/Badge/Button primitives, `primary` tokens).

- [ ] **Step 8: Insert it in `src/pages/Simulados.tsx`.** Import `{ CardsProvaOficial }` and render it between the header block and `<Tabs>`. Nothing else changes.

- [ ] **Step 9: Run the tests.** Run `npx vitest run src/features/prova-oficial`. Expected: PASS. Also run `npx vitest run src/test/components` if any existing test covers `Simulados.tsx`.

---

### Task 3: Student — dedicated page `/simulados/:id/prova-oficial` (agent A, after Task 2)

**Files:**
- Create: `src/features/prova-oficial/pages/ProvaOficialPage.tsx`.
- Create: `src/features/prova-oficial/components/DesempenhoPorArea.tsx`, `TrajetoriaProva.tsx`, `QuestaoRevisao.tsx` and `ListaQuestoes.tsx`.
- Create: `src/features/prova-oficial/__tests__/ProvaOficialPage.test.tsx` and `__tests__/QuestaoRevisao.test.tsx`.
- Modify: `src/experiences/aluno/alunoRoutes.tsx`. Add a lazy import and a gated route next to `/simulados/:id/prova` (~L138-145), using `accessRules.simulados`, `ExperiencePage` with `loadingMessage="Carregando sua prova..."`, and the same fallback.

**Interfaces:**
- Consumes: `useProvaOficialAluno`, `filtrarQuestoes`, `destaquesPorArea`, `FiltroQuestoes` and the types from Task 2.
- Produces: the default export `ProvaOficialPage`.

- [ ] **Step 1: Write the failing page test** (mock `../api`):
  - with `data: null` (not released or not the student's), it shows "Resultado ainda não disponível" and a link back to `/simulados`;
  - with a fixture of 3 questions (caderno 2, positions 36/37/38, `numeroCaderno1` 7/8/9, one correct, one wrong, one blank):
    - the header shows `ENAMED 2026`, `Caderno 2` and `1 de 3`;
    - the "Por área" section lists the areas;
    - the first question shown is labelled `Caderno 2 · Questão 36` and contains `no Caderno 1 era a questão 7`;
    - clicking the "Erradas" filter leaves only the wrong one;
    - the page text never contains `TRI`, `proficiente` or `nota estimada`;
    - the fixed notice `gabarito preliminar do INEP` is present.

- [ ] **Step 2: Write the failing `QuestaoRevisao` test.** With resposta `B` and correta `C`:
  - the alternative B is marked as the student's (text `Sua resposta`) and shown as wrong;
  - C is shown as `Gabarito preliminar do INEP`;
  - `comentario` renders inside a collapsible titled `Comentário do professor`;
  - when `resposta` is null, the text `Em branco` appears.

- [ ] **Step 3: Run both tests.** Expected: FAIL.

- [ ] **Step 4: Implement the components**

  **`QuestaoRevisao({ questao, caderno }: { questao: QuestaoProvaOficial; caderno: number })`:**
  - Header: `Caderno {caderno} · Questão {posicao}` plus a `grandeArea` badge, then a small muted line "no Caderno 1 era a questão {numeroCaderno1}" when `caderno !== 1`.
  - Body: `enunciado` (whitespace-pre-line), then `imagem` / `imagem2` via `ImageLightbox` from `src/components/simulados/ImageLightbox.tsx` (`{src, alt}`).
  - Alternatives A–D, each showing the letter and text:
    - green style plus the tag "Gabarito preliminar do INEP" on `correta`;
    - red style plus the tag "Sua resposta" on `resposta` when it's wrong;
    - green plus "Sua resposta" when it's right.
  - "Em branco" when `resposta` is null; "Questão anulada" when `anulada`.
  - `comentario` (and `imagemComentario`) inside a shadcn `Collapsible` titled "Comentário do professor".

  **`DesempenhoPorArea({ areas })`:** one row per area, with the name, `acertos/total` and a shadcn `Progress` bar at the percentage. Use `destaquesPorArea` to show "Seu melhor desempenho: X" and "Para reforçar: Y".

  **`TrajetoriaProva({ pontos })`:** a small recharts `LineChart` of `acertoPct` over `nome`, with the prova point highlighted (a star, or a larger dot in brand color). With fewer than 2 points it shows only the prova percentage. It carries the caption "Os simulados são provas diferentes; o que vale ler aqui é a tendência." Copy the recharts setup style from `src/pages/SimuladoDesempenho.tsx` (its EvolutionChart ~L509).

  **`ListaQuestoes({ questoes, caderno })`:**
  - Filter chips `Todas` / `Erradas` / `Em branco`, plus an area `Select`.
  - Filtering goes through `filtrarQuestoes`. Show a counter: "{n} questões".
  - Render `QuestaoRevisao` per item.
  - For 100 items, render them all; no virtualization.

  **`ProvaOficialPage`:**
  - Reads `id` from `useParams()` and calls `useProvaOficialAluno(id)`.
  - Loading → skeleton. `null` → "Resultado ainda não disponível" + link. Error → message + retry.
  - Otherwise, in order:
    1. header (`nome`, date, `Caderno {caderno}`, big `Você acertou {acertos} de {totalValidas}`, small "{emBranco} em branco");
    2. `DesempenhoPorArea`;
    3. `TrajetoriaProva`;
    4. `ListaQuestoes`;
    5. the fixed notice `Correção pelo gabarito preliminar do INEP. Se o gabarito definitivo mudar alguma questão, atualizamos aqui.`
  - Mobile-first, same page chrome as `src/pages/SimuladoCorrecao.tsx`.

- [ ] **Step 5: Add the route in `alunoRoutes.tsx`**

```tsx
const ProvaOficialPage = lazy(() => import('@/features/prova-oficial/pages/ProvaOficialPage'));
// ...inside the routes array, next to '/simulados/:id/prova':
gated(
  accessRules.simulados,
  '/simulados/:id/prova-oficial',
  <ExperiencePage loadingMessage="Carregando sua prova...">
    <ProvaOficialPage />
  </ExperiencePage>,
  fallback,
),
```

- [ ] **Step 6: Run the tests.** Run `npx vitest run src/features/prova-oficial`. Expected: all PASS. Then run the type check (`npx tsc --noEmit -p tsconfig.app.json`, or the script in package.json) and confirm no new errors.

---

### Task 4: Gestor — hook, block on Visão Geral, ★ point on the evolution chart (agent B)

**Files:**
- Modify: `src/features/gestor/api/types.ts`. Add `ProvaOficialGestor` and `ProvaOficialGestorPayload` (from Shared contracts).
- Modify: `src/features/gestor/api/queries.ts`:
  - add `useProvaOficial(filtros: FiltrosGestor): ResultadoGestor<ProvaOficialGestorPayload>` with `useEnvelope(['gestor','prova-oficial', filtros.iesId, filtros.semestre], 'get_gestor_prova_oficial', { p_ies_id: filtros.iesId, p_semestre: filtros.semestre }, filtros.iesId !== null)`;
  - add `useEhProvaOficial(iesId: string | null): (simuladoId: string) => boolean`, which calls the same RPC with `p_semestre: 'geral'` (key `['gestor','prova-oficial', iesId, 'geral']`) and builds a Set from `idsProvasOficiais`.
- Create: `src/features/gestor/components/BlocoProvaOficial.tsx` + `src/features/gestor/__tests__/BlocoProvaOficial.test.tsx`.
- Modify: `src/features/gestor/routes/VisaoGeral.tsx`. Render the block above `<KpisVisaoGeral …/>` (~L513) and pass `marcos` to `GraficoProtagonista`.
- Modify: `src/features/gestor/components/GraficoProtagonista.tsx`. Accept an optional `marcosProvaOficial?: MarcoProvaOficial[]` and forward it to `EvolucaoChart` in the 'geral' mode (~L247).
- Modify: `src/features/gestor/charts/EvolucaoChart.tsx`. Add the optional prop `marcos?: MarcoProvaOficial[]` and render each one as a distinct ★ point to the right of the series. It is not connected to the line; use a dashed connector or a separate category, with its own tooltip "ENAMED 2026 · Prova oficial · {proficientesPct}% proficientes". Export `interface MarcoProvaOficial { rotulo: string; nome: string; proficientesPct: number | null }`.
- Modify: `src/features/gestor/__tests__/VisaoGeral.test.tsx`. Add `useProvaOficial` to the `vi.mock('@/features/gestor/api/queries', …)` factory, defaulting to `{ data: { provas: [], idsProvasOficiais: [] }, meta: metaFake, isLoading: false, isError: false, refetch: vi.fn() }`, and add one test.

**Interfaces:**
- Consumes: the `get_gestor_prova_oficial` contract.
- Produces: `useProvaOficial`, `useEhProvaOficial` (used by Task 5), `MarcoProvaOficial`.

- [ ] **Step 1: Write the failing `BlocoProvaOficial` test.** Render with the props `{ prova: ProvaOficialGestor, onVerDetalhamento }`:
  - it shows `ENAMED 2026` (from `nome`), `124 participantes`, `conceito estimado 4`, `72% proficientes` and `média de 66,9 acertos` (pt-BR decimal comma via the existing `lib/formatters`);
  - it shows the notice `Estimativa Sanar (TRI) com gabarito preliminar. O conceito oficial é divulgado pelo INEP.`;
  - clicking `Ver detalhamento` calls `onVerDetalhamento(simuladoId)`;
  - with `participantes: 0`, it shows `Sem participantes neste recorte`;
  - with `amostraPequena: true`, it shows the same small-sample warning copy the portal already uses (grep `lowSample` / `amostra` in `src/features/gestor` and reuse that exact text);
  - with `comTri: 0`, it shows `Aguardando cálculo da nota` in place of the conceito and proficientes values.

- [ ] **Step 2: Add a failing test in `VisaoGeral.test.tsx`.** With `useProvaOficial` returning one prova, `screen.getByText(/ENAMED 2026/)` is present, and the contract KPI text is unchanged versus the no-prova case (e.g. the `realizados` value from `visaoGeralFake`).

- [ ] **Step 3: Run.** Run `npx vitest run src/features/gestor/__tests__/BlocoProvaOficial.test.tsx src/features/gestor/__tests__/VisaoGeral.test.tsx`. Expected: FAIL.

- [ ] **Step 4: Implement**
  - **`BlocoProvaOficial`:** use `BlocoGestor` as the container if its API fits; otherwise match the card styling of `KpiCard` via the `--gp-*` tokens in `gestor-theme.css`. Put `<Tag variant="selo">★ Prova oficial</Tag>` in the header. No new Tag variants (the Tag file restricts anatomies).
  - **Hooks** as specified.
  - **`VisaoGeral`:**
    - `const provaOficial = useProvaOficial(filtrosGestor)`;
    - render `provaOficial.data?.provas.map((p) => <BlocoProvaOficial key={p.simuladoId} prova={p} onVerDetalhamento={irParaDetalhamento} />)` above the KPIs;
    - `irParaDetalhamento` navigates to the Detalhamento route with that simulado selected. Find how `useFiltrosGestor().setSimulados` / the URL param works in `routes/Detalhamento.tsx` and reuse it;
    - build `marcos` from `provas` (`{ rotulo: '★ ENAMED', nome: p.nome, proficientesPct: p.proficientesPct }`) and pass them down.
  - **`EvolucaoChart`:** without `marcos`, the output must be unchanged. Existing chart tests must still pass.

- [ ] **Step 5: Run the gestor test suite.** Run `npx vitest run src/features/gestor`. Expected: all PASS, with no changes to existing snapshots. If a snapshot changes, investigate; don't update it blindly.

---

### Task 5: Gestor — "★ Prova oficial" badge in lists and Caderno 2 numbering in Questões (agent B, after Task 4)

**Files:**
- Modify: `src/features/gestor/components/SeletorSimulados.tsx` (list row ~L240, chip ~L325).
- Modify: `src/features/gestor/components/CronogramaSimulados.tsx` (~L395, L466, L512).
- Modify: `src/features/gestor/components/ComparativoSimulados.tsx` (~L194, L288, L346).
- Modify: `src/features/gestor/components/KpisDetalhamento.tsx` (~L151).
- Modify: `src/features/gestor/components/DrawerAluno.tsx` (list row ~L392).
- Modify: `src/features/gestor/components/TabelaQuestoes.tsx`. When the selected simulado is a prova oficial, show `Q{n}` plus a smaller muted `· C2 {numeracaoCaderno2[n]}`.
- Tests: extend the existing tests of these components where they exist; otherwise add `src/features/gestor/__tests__/SeloProvaOficial.test.tsx`.

**Interfaces:**
- Consumes: `useEhProvaOficial(iesId)` and `useProvaOficial` (for `numeracaoCaderno2`) from Task 4.

- [ ] **Step 1: Write a failing test.** `SeletorSimulados` with two items, one of them an official prova (mock `useEhProvaOficial` to return `(id) => id === 'p1'`), renders `★ Prova oficial` exactly once, next to that item. Do the same for `CronogramaSimulados` if a test file exists for it.

- [ ] **Step 2: Write a failing test for `TabelaQuestoes`.** With the prova selected and `numeracaoCaderno2 = { '1': 30 }`, row 1 shows `C2 30`.

- [ ] **Step 3: Run.** Expected: FAIL.

- [ ] **Step 4: Implement.** In each file, next to the simulado name, add `{ehProvaOficial(item.id) && <Tag variant="selo">★ Prova oficial</Tag>}` using the file's local id field. Get `iesId` the way the component already does, from `useFiltrosGestor()` or props. Keep the aria labels coherent: append ", prova oficial" in `rotuloItem()`.

- [ ] **Step 5: Run.** Run `npx vitest run src/features/gestor`. Expected: all PASS. Then run the type check.

---

### Task 6: Integration, verification and commit (orchestrator)

- [ ] **Step 1:** Review each agent's diff against the spec and the Global Constraints: no TRI on the student side, caderno order, no new `type`, rollback files present.
- [ ] **Step 2:** Run `npx vitest run src/features/prova-oficial src/features/gestor` and the type check. Paste the summary.
- [ ] **Step 3:** Run `npm run build`. Expected: success.
- [ ] **Step 4: Visual check in the local preview.** The prova is unreleased, so real data won't show. Check the student card and page with the component tests' fixtures by temporarily rendering the page in a dev-only harness, or skip it and rely on the component tests. Screenshot the gestor Visão Geral for a non-UniAtenas IES and confirm nothing changed.
- [ ] **Step 5:** Commit per area (DB, student, gestor), with the attribution line. Push the branch and open the PR. **Publishing and merging stay with Felipe.**
- [ ] **Step 6: Release checklist, run when Felipe decides:**
  - front published;
  - `09_verificacao.sql` = 0 divergences;
  - 16 images uploaded;
  - TRI rows present (324 + 4);
  - duplicates decided.

  Then run `UPDATE public.simulados_admin SET liberacao_desempenho = 'imediato', data_liberacao_desempenho = now() WHERE id = '97d67578-4204-4009-8056-fd0df28aa30d';` and re-run the Step 6 checks of Task 1 without ROLLBACK.

## Known deviation from the spec

Spec §5 says the prova shows up with a badge in the student's existing Desempenho lists. For speed, this plan **removes** it from those lists instead (`get_user_simulados` filter). The student's entry point is the dedicated card at the top of `/simulados`. The per-simulado ranking is also removed as a result (it isn't shown for the prova). This can be revisited after release.
