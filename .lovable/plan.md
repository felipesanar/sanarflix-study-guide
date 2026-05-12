## Objetivo
Corrigir os números mostrados no drawer "Visão de Alunos" (`StudentAnalyticsDrawer`) para que **Desempenho por Área**, **Temas Críticos** e **Temas de Oportunidade** reflitam o desempenho **individual do aluno** no simulado selecionado, com as fórmulas e ordenações pedidas.

## Comportamento esperado

**Desempenho por Área** (uma barra por área)
- `% área = acertos do aluno na área ÷ total de questões da área no simulado × 100`
- "Total de questões da área" = nº de questões da área naquele simulado (constante para todos os alunos), **excluindo questões anuladas**.
- Ordenação: **decrescente** por percentual.

**Temas Críticos** (até 5 temas)
- `% tema = acertos do aluno no tema ÷ total de questões do tema no simulado × 100` (anuladas excluídas).
- Mostrar os **5 temas com menor %** do aluno.
- Ordenação final: **decrescente** por percentual (ou seja, do menos pior para o pior dentro do top 5 — conforme pedido).

**Temas de Oportunidade** (até 5 temas)
- Mesma fórmula por aluno/tema.
- Critério: temas com `% < 60` (ainda não proficientes) — top 5 **mais próximos de 60%**.
- Ordenação final: **decrescente** por percentual.

Apenas temas em que o aluno respondeu pelo menos 1 questão entram nos rankings de Críticos/Oportunidade.

## Mudanças técnicas

### 1) RPC `get_institutional_student_scores` (migração aditiva)
Estender o JSON retornado por aluno para incluir:
- `totals_by_area: { [area]: total_questoes_area_no_simulado }` — igual para todos os alunos, mas devolvido por aluno por simplicidade de consumo.
- `scores_by_tema: { [tema]: acertos_aluno_no_tema }`
- `totals_by_tema: { [tema]: total_questoes_tema_no_simulado }`

Filtros mantidos:
- `q.anulada = false` em todas as agregações (Áreas e Temas), conforme regra de "questões anuladas excluídas".
- Exclusão de `gestor_formal` mantida.
- `scores_by_area` (acertos) preservado por compatibilidade.

### 2) Tipos `src/types/desempenhoV2.ts`
- `RpcStudentScoresResponse.students[*]`: adicionar `totals_by_area`, `scores_by_tema`, `totals_by_tema` (todos `Record<string, number> | null`).
- `StudentScore`: adicionar `totalsByArea`, `scoresByTema`, `totalsByTema` (mesmos `Record<string, number>`).

### 3) `src/utils/mapInstitutionalData.ts`
- Mapear os novos campos do RPC para `StudentScore`.

### 4) `src/components/analytics/v2/shared/StudentAnalyticsDrawer.tsx`
Substituir as construções atuais de `areaPerformance`, `criticalTemas`, `opportunityTemas`:

- **Áreas**: iterar `student.totalsByArea`. Para cada `area`, `pct = round((scoresByArea[area] ?? 0) / total * 100)` quando `total > 0`. Ordenar **desc**.
- **Temas**: iterar `student.totalsByTema`. Calcular `pct` por tema (apenas onde `total > 0`).
  - `criticalTemas`: pegar os 5 menores → ordenar **desc** por `pct` para exibição.
  - `opportunityTemas`: filtrar `pct < 60`, pegar os 5 maiores → ordenar **desc**.
- A fonte do nome da área para temas pode usar um lookup auxiliar a partir de `data.curricular.areas` (procurar `tema.name → area.name`) só para o rótulo "área" exibido no item. Se não encontrado, omitir o subtítulo.

Indicadores pedagógicos (`buildPedagogicalIndicators`) que usam `student.scoresByArea` para "Área de menor desempenho" passam a usar o `pct` corrigido por área (mesma fórmula) — mantendo a consistência visual.

## Fora de escopo
- KPIs institucionais, cards de "Distância", `VisaoAlunosModule` (lista/tabela), `InsightsPedagogicosModule`.
- Mudanças em `get_institutional_performance` ou `get_institutional_evolution`.
- Lógica de proficiência / Score TRI (já usa `score_proprio`).

## Verificação
- Conferir manualmente para um aluno conhecido na IES FAI: somatório de acertos por área = `acertos` totais do aluno no simulado.
- `totals_by_area` somados = total de questões não-anuladas do simulado.
- Sanity: `criticalTemas` e `opportunityTemas` exibem percentuais entre 0–100, sem valores absurdos.
