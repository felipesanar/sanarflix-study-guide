## Objetivo

Substituir os controles atuais ("Semestres" multi-select + toggle "Conceito Geral") por **3 modos mutuamente exclusivos** na aba Visão Institucional, mantendo uma única fonte de dados por modo e refletindo o modo ativo na barra de contexto.

## Os 3 modos

1. **Padrão (6º ano)** — modo inicial. Base = semestres `[11, 12]`. Conceito = previsto (projeção a partir do pcp).
2. **Geral** — base = todos os alunos que fizeram a prova. Conceito = oficial (`concept` do TRI).
3. **Por semestre** — usuário seleciona 1+ semestres. Conceito = previsto.

A precedência antiga (semestres > toggle > 6º ano) deixa de existir: os 3 modos são exclusivos e controlados por um único seletor.

## UI

**`GlobalFilterBar.tsx`** — remover o `MultiSelectFilter` de "Semestres" e o botão "Conceito Geral". Adicionar um seletor segmentado (3 botões em um `ToggleGroup` / `Tabs` compactos) com os rótulos:

- `Padrão (6º ano)` · `Geral` · `Por semestre`

Quando o modo for "Por semestre", renderizar ao lado o `MultiSelectFilter` existente (lista de semestres). Nos outros modos, esse multi-select fica oculto. Se o usuário entrar no modo "Por semestre" sem nenhum semestre escolhido, abrimos automaticamente o popover; até ele escolher, tratamos como vazio (sem fetch / placeholder "Selecione ao menos um semestre").

**`VisaoInstitucionalModule.tsx`** — a barra de contexto já mostra base/conceito; só ajustar o texto do modo Geral para "Conceito oficial: Conceito X" (em vez de "previsto") e manter "Conceito previsto" nos modos 1 e 3.

## Estado / tipos

**`src/types/desempenhoV2.ts`**
- Adicionar `baseMode: 'sixth-year' | 'general' | 'semestres'` em `DesempenhoV2Filters` (default `'sixth-year'`).
- Marcar `conceitoGeral` como deprecado (manter por compat até o próximo passo). Atualizar `countActiveFilters` para considerar `baseMode !== 'sixth-year'` como filtro ativo, e `semestres` só conta se `baseMode === 'semestres'`.

**`src/utils/activeBase.ts`** — `resolveActiveBase(filters)` passa a usar `filters.baseMode` diretamente:
- `'sixth-year'` → `{ semestres: [11,12], mode: 'sixth-year', label: '6º ano (11º e 12º semestres)' }`
- `'general'` → `{ semestres: null, mode: 'general', label: 'Geral — todos os alunos que fizeram a prova' }`
- `'semestres'` → array selecionado; se vazio, retornar `mode: 'semestres'` com `semestres: []` e um flag para o hook pular o fetch.

**`useDesempenhoV2State.ts`** — incluir `baseMode` na inicialização (`DEFAULT_FILTERS`), na persistência por query-string e no `clearFilters` (volta para `'sixth-year'`). Quando o usuário mudar `baseMode` para algo diferente de `'semestres'`, limpar `filters.semestres`.

## Dados

**`useInstitutionalPerformanceData.ts`** — uma única consulta por modo, conforme pedido:

- `fetchInstitutionalTri(simuladoId, iesId, p_semestres)` onde `p_semestres` é:
  - `[11,12]` no modo 1
  - `null` no modo 2
  - `filters.semestres` no modo 3 (pular fetch se vazio)
- `fetchIesStudentCount(iesId, p_semestres)` com a mesma regra (`null` no modo 2).
- `fetchInstitutionalPerformance(simuladoId, iesId)` continua igual; **% e total de acertos** passam a vir do `bySemester` somando apenas os semestres da base ativa (no modo geral, somar todos). Essa soma já existe em `mapInstitutionalRpcToViewModel` (`baseAcertos`/`baseTotal` via `inBase`) — manter.

**Fallback do 6º ano**: hoje, se `num_students === 0` em `[11,12]`, caímos para geral. Manter esse comportamento (marcando `sixthYearFallback = true` para a barra de contexto seguir avisando "Sem alunos do 6º ano — exibindo base geral").

## Conceito previsto vs oficial

**`mapInstitutionalData.ts`** já distingue: `useGeneralConceptColumn = activeBase.mode === 'general' || sixthYearFallback` usa `triSnapshot.concept` (oficial); demais derivam de `getConceito(pcp)` (previsto). Manter como está.

**`VisaoInstitucionalModule.tsx`** — ajustar o rótulo da barra de contexto:
- modo `general` (ou fallback) → `Conceito oficial: Conceito X`
- modos `sixth-year` / `semestres` → `Conceito previsto: Conceito X`

## Fora de escopo

- RPCs (assinaturas já aceitam `p_semestres`).
- Outras abas (Diagnóstico Curricular, Visão de Alunos, etc.) — continuam usando os filtros legados via `applyDesempenhoV2Filters`. A remoção do `conceitoGeral` na UI não afeta essas abas.
- Lógica de cálculo TRI, sanções, KPI grid (apenas leitura dos novos `headerSummary`).

## Arquivos a editar

- `src/types/desempenhoV2.ts`
- `src/utils/activeBase.ts`
- `src/hooks/useDesempenhoV2State.ts`
- `src/components/analytics/v2/shell/GlobalFilterBar.tsx`
- `src/components/analytics/v2/modules/VisaoInstitucionalModule.tsx`
- `src/utils/desempenhoV2Filters.ts` (ajustar `hasActiveSecondaryFilters` para considerar `baseMode`)

`useInstitutionalPerformanceData.ts` e `mapInstitutionalData.ts` não precisam mudar — já consomem `resolveActiveBase` e fazem o fetch único conforme `activeBase.semestres`.
