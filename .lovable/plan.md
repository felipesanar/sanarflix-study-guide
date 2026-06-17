## Objetivo

Transformar o controle "Conceito Geral" em um interruptor de **base ativa** que afeta TODOS os cards/banners da aba "Visão Institucional", não apenas Nota Prevista. Uma única chamada TRI por base, com fallback automático quando o 6º ano não tem alunos.

## Regra da Base Ativa (precedência)

1. **Semestres selecionados no filtro** → usa eles.
2. **Senão, "Conceito Geral" ON** → base geral (todos os semestres, `p_semestres = null`).
3. **Senão (padrão)** → 6º ano = `[11, 12]`.

Helper novo `resolveActiveBase(filters)` retorna `{ semestres: number[] | null, mode: 'semestres' | 'general' | 'sixth-year' }`. `null` = "todos" (RPC recebe `null`); array = lista explícita.

## Mudanças por arquivo

### `src/services/institutional.ts`
- `fetchInstitutionalTri(simuladoId, iesId, semestres: number[] | null)`: aceitar `null` e enviar `p_semestres: null` quando for o caso. Remover dependência de `pcp_sixth_year`/`num_students_sixth_year` (não usados mais; o cálculo do 6º ano será uma chamada normal com `[11,12]`).
- Nova função `fetchIesStudentCount(iesId, semestres: number[] | null)` chamando `get_ies_student_count(p_ies_id, p_semestres)`.

### `src/hooks/useInstitutionalPerformanceData.ts`
- Calcular `activeBase = resolveActiveBase(filters)`.
- Substituir a contagem de adesão atual por `fetchIesStudentCount(targetIesId, activeBase.semestres)`.
- Chamar `fetchInstitutionalTri(simuladoId, ies, activeBase.semestres)` uma única vez.
- **Fallback 6º ano**: se `activeBase.mode === 'sixth-year'` e o snapshot voltar `num_students === 0`:
  - Re-fetch TRI com `null` (geral) e re-fetch adesão com `null`.
  - Marcar `sixthYearFallback = true` para o ViewModel.
- Passar `activeBase` resolvida + flag de fallback para o mapper.

### `src/utils/mapInstitutionalData.ts`
- Nova assinatura: `mapInstitutionalRpcToViewModel(perf, evo, scores, totalIesUsers, triSnapshot, triEvo, studentTri, activeBase, sixthYearFallback)`.
- **Todos os cards reagentes** (Total, Proficiência Média, Proficientes, Abaixo do Esperado, Nota Prevista, Distância, Sanção) usam o MESMO `triSnapshot` da base ativa.
- **% Acertos / Total questões**: somar `performance.bySemester` apenas para semestres da base ativa (geral = soma todos; 6º ano = soma 11 e 12; multisseleção = soma os selecionados).
- **Conceito**:
  - Geral (ou fallback): usa `triSnapshot.concept` (coluna numérica) → `conceitoFromNota`.
  - Demais: deriva via `getConceito(pcp da base)` com a mesma régua de faixas.
- **Sanção / Distância**: derivam do `pcp` da base ativa (já é o `pcp` único do snapshot).
- **Taxa de Adesão**: `triSnapshot.num_students / totalIesUsers` (denominador escopo da base).
- **Header `conceitoMode`**: `'general' | 'sixth-year' | 'semestres'`. Adicionar `baseLabel` ("IES inteira", "6º ano", "Semestres 9, 10").
- Lista "Alunos abaixo do esperado": filtrar `students` por `s.semestre ∈ activeBase.semestres` (quando `null` = todos).

### `src/types/desempenhoV2.ts`
- `HeaderSummary.conceitoMode`: adicionar `'semestres'`.
- `HeaderSummary.baseLabel: string` (ex.: "Base: 6º ano").
- Adicionar `KpiData.baseLabel?: string` opcional (para selo por card).

### `src/components/analytics/v2/KpiCardsGrid.tsx`
- Substituir o badge fixo "Institucional" por um selo dinâmico `Base: {kpi.baseLabel}` quando presente, em TODOS os cards (não só institucionais). Prop `showInstitutionalBadge` vira `showBaseBadge`.

### `src/components/analytics/v2/modules/VisaoInstitucionalModule.tsx`
- "Analisando N alunos" usa `headerSummary.totalAlunos` + `baseLabel` ("18 alunos · Base: 6º ano (11º e 12º semestres)").
- Quando `sixthYearFallback`, exibir nota inline: "Sem alunos do 6º ano — exibindo base geral".
- Passar `baseLabel` para cada KPI via `kpis[i].baseLabel`.

### `src/components/analytics/v2/shell/GlobalFilterBar.tsx`
- Quando `filters.semestres.length > 0`, desabilitar o botão "Conceito Geral" (semestres têm precedência) e exibir tooltip explicativo. Mantém clicável quando vazio.

### `src/hooks/useDesempenhoV2State.ts`
- Sem mudanças de URL/state (`conceitoGeral` já persistido).

## Resultado esperado (Funepe)

| Cenário | Base | Total | % Profic. | Conceito | Adesão |
|---|---|---|---|---|---|
| Padrão | 6º ano `[11,12]` | 18 | 50% | 2 | 18/80 |
| "Conceito Geral" ON | Geral (`null`) | 76 | 35% | 1 | 76/450 |
| Filtro 10º | `[10]` | reage ao filtro | — | — | n/450 do 10º |

## Fora de escopo
- Mudanças nas RPCs do Postgres (`get_institutional_tri` e `get_ies_student_count` já aceitam `p_semestres` conforme indicado pelo usuário).
- Evolução/Diagnóstico Curricular/outras abas (não solicitado).
