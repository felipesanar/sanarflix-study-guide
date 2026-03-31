

# Auditoria e Correção das Fórmulas de Impacto Institucional

## Relatório da Auditoria (Fase 1-4)

### Todas as fórmulas localizadas

| # | Função / Local | Arquivo | Fórmula |
|---|---|---|---|
| 1 | `getConceito` | `mapInstitutionalData.ts:36` | 90→5, 75→4, 60→3, 40→2, else→1 |
| 2 | `getConceito` | `SimuladorImpactoModule.tsx:72` | **80→5, 60→4, 40→3, 20→2, else→1** |
| 3 | `simulateImpact` — weight | `SimuladorImpactoModule.tsx:140` | `weight = targetNode.total / totalQuestions` |
| 4 | `simulateImpact` — effective gain | `SimuladorImpactoModule.tsx:141` | `effectiveImprovement = improvement * weight` |
| 5 | `simulateImpact` — projection | `SimuladorImpactoModule.tsx:147` | `simulatedScore = student.percentual + effectiveImprovement` → count crossings over 60 |
| 6 | `simulateImpact` — bound | `SimuladorImpactoModule.tsx:155` | `Math.min(100, ...)` — bounded |
| 7 | `buildChartData` — alunosAfetados | `InteligenciaDecisoriModule.tsx:70` | `ceil(totalStudents * min(gap/40, 1) * 0.7)` |
| 8 | `buildChartData` — impacto | `InteligenciaDecisoriModule.tsx:71` | `prevalencia * alunosAfetados * gap / 100` |
| 9 | `buildInsights` — afetados (area) | `InsightsPedagogicosModule.tsx:65` | `ceil(totalStudents * (gap/100) * 1.5)` |
| 10 | `buildInsights` — afetados (tema) | `InsightsPedagogicosModule.tsx:91` | `ceil(totalStudents * min(gap/50, 1) * 0.8)` |
| 11 | `buildInsights` — priority (area) | `InsightsPedagogicosModule.tsx:66` | `gap*1.2 + prevalencia*0.8 + min(afetados,30)` |
| 12 | `buildInsights` — priority (critical) | `InsightsPedagogicosModule.tsx:95` | `gap*1.5 + prevalencia*1.2 + afetados*0.5` |
| 13 | `buildInsights` — priority (quick-win) | `InsightsPedagogicosModule.tsx:119` | `(60-percentual)*3 + prevalencia*2 + afetados` |

### Inconsistências Detectadas

**[CRITICAL] Conceito thresholds divergentes**
- `mapInstitutionalData.ts` (fonte de verdade): 90/75/60/40
- `SimuladorImpactoModule.tsx`: 80/60/40/20
- Resultado: o simulador mostra "Conceito 5" a partir de 80% proficientes, enquanto o dashboard real exige 90%. O coordenador vê um conceito simulado mais otimista que a realidade.

**[MODERATE] Fórmula de "alunos afetados" diverge entre módulos**
- Inteligência Decisória: `min(gap/40, 1) * 0.7`
- Insights Pedagógicos (tema): `min(gap/50, 1) * 0.8`
- Insights Pedagógicos (area): `(gap/100) * 1.5`
- Nenhuma delas usa dados reais de alunos por tema — todas são heurísticas com coeficientes arbitrários diferentes.

**[OK] Proficiência atual**: Todas as 3 fontes usam `data.headerSummary.percentProficientes` — consistente.

**[OK] Threshold**: Todas usam `PROFICIENCY_THRESHOLD = 60` — consistente.

**[OK] Projeção limitada**: `Math.min(100, ...)` presente no simulador — bounded.

**[OK] Sem sobreposição de ganhos**: Simulador opera um tema por vez, não soma ganhos independentes.

---

## Plano de Correção (Fase 5-6)

### Correção 1 — Alinhar `getConceito` no Simulador (CRÍTICO)

**Arquivo**: `SimuladorImpactoModule.tsx` (linha 72-78)

Substituir thresholds `80/60/40/20` por `90/75/60/40` para alinhar com `mapInstitutionalData.ts`.

### Correção 2 — Unificar heurística de "alunos afetados"

Criar uma função utilitária em `mapInstitutionalData.ts` para ser importada pelos 2 módulos:

```
estimateAffectedStudents(totalStudents, gap):
  return ceil(totalStudents * min(gap / 50, 1) * 0.8)
```

Aplicar em:
- `InteligenciaDecisoriModule.tsx` (linha 70)
- `InsightsPedagogicosModule.tsx` (linhas 65 e 91)

### Correção 3 — Logs de auditoria

Adicionar `console.log('[Impact Model] audit completed')` no mapper para confirmar execução.

### Nenhuma alteração em:
- Estrutura de tabelas, RPCs, interfaces de componentes
- Aba Insights Pedagógicos (a lógica de priorização interna permanece — apenas a heurística de `alunosAfetados` é unificada)
- Simulador de impacto (lógica de `weight` e `effectiveImprovement` está correta)

### Arquivos modificados:
1. `src/components/analytics/v2/modules/SimuladorImpactoModule.tsx` — fix `getConceito`, import helper
2. `src/components/analytics/v2/modules/InteligenciaDecisoriModule.tsx` — import helper
3. `src/components/analytics/v2/modules/InsightsPedagogicosModule.tsx` — import helper
4. `src/utils/mapInstitutionalData.ts` — export `estimateAffectedStudents` + audit log

