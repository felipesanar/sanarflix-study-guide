## Objetivo

Na aba "Visão Institucional", fazer os cards de **Proficiência Média (TRI)**, **Alunos Proficientes**, **Alunos Abaixo do Esperado**, **Total de Alunos** e **Taxa de Adesão** reagirem ao filtro de semestre, mantendo **Nota Prevista**, **Distância para a Próxima Faixa** e o **banner de Sanção** sempre no recorte institucional (IES inteira).

## Como o filtro vira parâmetro

`filters.semestres` é multi-select. Regra de envio para `p_semestre`:
- Exatamente **1** semestre selecionado → `p_semestre = Number(semestre)` (recorte ativo).
- **0** ou **>1** semestres selecionados → `p_semestre = null` (equivale a "Todos"). Quando >1, a aba volta a operar como institucional sem selo (sem recorte único possível).

Termo "semestre ativo" abaixo = `filters.semestres.length === 1 ? Number(filters.semestres[0]) : null`.

## Mudanças

### 1. `src/services/institutional.ts`
- Estender `InstitutionalTriSnapshot` com `num_below_expected: number | null`.
- `fetchInstitutionalTri(simuladoId, iesId, semestre?: number | null)` passa `p_semestre` (default `null`) para a RPC.

### 2. `src/hooks/useInstitutionalPerformanceData.ts`
- Calcular `activeSemestre` a partir de `filters.semestres`.
- Buscar **dois snapshots TRI** em paralelo:
  - `triInstitutional` = `fetchInstitutionalTri(simuladoId, ies, null)` — usado para Conceito, Distância, Sanção (banner) e como base institucional.
  - `triScoped` = quando `activeSemestre !== null`, `fetchInstitutionalTri(simuladoId, ies, activeSemestre)`; caso contrário reusa `triInstitutional`.
- Buscar **contagem de usuários da IES por semestre** para Taxa de Adesão:
  - Quando `activeSemestre !== null`: `SELECT count FROM users WHERE id_ies = ies AND semestre = activeSemestre` (via supabase client, head+count).
  - Caso contrário, mantém `get_ies_student_count` atual.
- Passar `triInstitutional`, `triScoped`, `iesUsersCount`, `activeSemestre` para o mapper.
- Refetch quando `filters.semestres` mudar (incluir no dep array do `useCallback`).

### 3. `src/utils/mapInstitutionalData.ts`
- Nova assinatura aceita `triScoped` (snapshot do recorte) e `triInstitutional` (sempre IES inteira) e `activeSemestre`.
- **KPIs reagentes ao recorte** (usam `triScoped`):
  - `Total de Alunos` ← `triScoped.num_students`.
  - `Proficiência Média (TRI)` ← `triScoped.mean_score`.
  - `Alunos Proficientes` ← `triScoped.num_proficient / triScoped.num_students` (label segue `"X de Y alunos"`).
  - `Alunos Abaixo do Esperado` ← `triScoped.num_below_expected` (substitui o cálculo atual baseado em `students.filter(...)` para o número do card).
- **KPIs fixos institucionais** (usam `triInstitutional`, nunca recorte):
  - `Nota Prevista da IES` ← `triInstitutional.concept`.
  - `Distância Próxima Faixa` ← derivada de `triInstitutional.pcp`.
  - `headerSummary.sancao` (banner) ← derivada de `triInstitutional.pcp`.
- `headerSummary.totalAlunos` ← `triScoped.num_students` (alimenta o novo "Analisando N alunos").
- `meta.taxaAdesao` ← `triScoped.num_students / iesUsersCount * 100`; label ajustado.
- Adicionar flag `isSemestreScoped: boolean` no `InstitutionalViewModel` (e no `headerSummary` ou em campo novo `scope`) para a UI saber quando exibir o selo.

### 4. `src/types/desempenhoV2.ts`
- Adicionar a `KpiData` (em `src/mocks/desempenhoInstitucionalV2.ts` onde está definido) um campo opcional `scope?: 'institutional' | 'scoped'` para marcar Conceito/Distância como `institutional`.
- Adicionar `isSemestreScoped?: boolean` em `InstitutionalViewModel` (ou `HeaderSummary`).

### 5. `src/components/analytics/v2/modules/VisaoInstitucionalModule.tsx`
- No topo da aba, acima de `KpiCardsGrid`, exibir linha discreta:
  ```
  Analisando {data.headerSummary.totalAlunos} aluno{plural} {scopeLabel}
  ```
  onde `scopeLabel = isSemestreScoped ? "do Nº semestre" : "da IES"`.
- Passar `isSemestreScoped` para `KpiCardsGrid`.

### 6. `src/components/analytics/v2/KpiCardsGrid.tsx`
- Aceitar prop `showInstitutionalBadge: boolean`.
- Quando `true` e `kpi.scope === 'institutional'` (Conceito, Distância), renderizar `Badge` pequeno "Institucional" no canto do card.

### 7. `src/components/analytics/v2/shell/InstitutionalAlertBanner.tsx`
- Aceitar prop `showInstitutionalBadge?: boolean`; quando `true`, anexar selo "Institucional" ao lado do título "Sanção regulatória" indicando que se refere à IES inteira, não ao recorte.
- Passar a prop a partir de `DesempenhoInstitucionalV2.tsx` (usa `filters.semestres.length === 1`).

### 8. `applyDesempenhoV2Filters` (`src/utils/desempenhoV2Filters.ts`)
- Continuar filtrando `allStudents`/curricular por semestre para as outras abas e gráficos.
- **Não** recalcular os KPIs TRI a partir dos `students` filtrados — eles agora vêm autoritativos da RPC. Verificar e remover qualquer mutação de `kpis`/`headerSummary` que dependa do recorte de semestre nessa função, para evitar conflito com os números vindos do `triScoped`.

## O que NÃO muda

- Outras abas (Diagnóstico Curricular, Visão de Alunos, etc.) continuam usando o pipeline atual.
- Evolução, Faixas de Distribuição e Curricular continuam baseados nos dados existentes (não afetados pelo recorte TRI por semestre nesta entrega).
- Quando `>1` semestre selecionado: tratamos como "Todos" para fins de TRI (`p_semestre = null`), sem selo "Institucional" — o recorte deixa de existir formalmente.

## Critérios de aceite

1. Selecionar 1 semestre atualiza Total/Proficiência/Proficientes/Abaixo/Taxa de Adesão (números mudam), enquanto Conceito, Distância e banner de Sanção permanecem iguais ao "Todos".
2. Linha "Analisando N alunos" reflete `triScoped.num_students` em tempo real.
3. Selo "Institucional" aparece em Conceito, Distância e no banner de Sanção somente com 1 semestre filtrado.
4. Em "Todos" (ou múltiplos semestres), nenhum selo aparece e os números voltam ao agregado IES.
5. Taxa de Adesão com semestre filtrado: numerador `num_students` da RPC, denominador `count(users where id_ies=? and semestre=?)`.
