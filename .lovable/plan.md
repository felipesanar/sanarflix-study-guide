

# Alterações na Aba "Visão Institucional"

## Resumo

Corrigir 3 KPI cards existentes e adicionar 1 novo, além de redesenhar o card "Meta Institucional". Requer uma pequena query adicional no hook de dados para obter o total de alunos matriculados na IES (para calcular taxa de adesão).

## Mudanças

### 1. Dados: buscar total de alunos da IES

**Arquivo**: `src/hooks/useInstitutionalPerformanceData.ts`

Adicionar uma query `SELECT count(*) FROM users WHERE id_ies = ?` em paralelo com as RPCs existentes. Passar o resultado (`totalIesUsers`) para o mapper.

### 2. Mapper: ajustar KPIs e Meta

**Arquivo**: `src/utils/mapInstitutionalData.ts`

- **Aceitar `totalIesUsers`** como parâmetro adicional em `mapInstitutionalRpcToViewModel`
- **KPI "Distância Próxima Faixa"**: mudar de "distância média dos alunos abaixo" para distância em p.p. até o próximo conceito. Ex: se `percentProficientes = 25%`, conceito atual = 1, próximo threshold = 40%, distância = `15 p.p.`. Descrição: "Distância para alcançar a próxima faixa de conceito"
- **KPI "Taxa de Adesão"**: calcular `(totalStudents / totalIesUsers) * 100`. Descrição: "X alunos dos Y realizaram o simulado"
- **Novo KPI "Percentual de Acertos"**: `(overallStats.acertos / overallStats.total) * 100`. Descrição: "X acertos de Y questões aplicadas". Posicionar logo após "Total de Alunos"
- **Meta Institucional**: atualizar campos para refletir % proficientes vs próximo threshold de conceito, gap em p.p., e adesão real

### 3. Interface MetaInstitucional

**Arquivo**: `src/mocks/desempenhoInstitucionalV2.ts`

Adicionar campos opcionais à interface `MetaInstitucional`: `totalIesUsers`, `totalStudentsSimulado`, `sancaoRegulatoriaLabel`

### 4. Card Meta Institucional

**Arquivo**: `src/components/analytics/v2/MetaInstitucionalCard.tsx`

- **Barra de progresso**: mostrar `percentProficientes` atual vs próximo threshold de conceito (ex: 25% → meta 40%)
- **Percentual da meta**: calcular como proporção da distância percorrida. Se a IES está em conceito 1 (threshold anterior = 0%), meta = 40%, e tem 25% proficientes, então progresso = (25-0)/(40-0) = 62.5%
- **Gap de Proficiência**: mostrar distância em p.p. até próximo conceito
- **Taxa de Adesão**: mostrar % calculado real
- **Substituir "Percentil Médio"** por **"Sanção Regulatória"** com label da sanção atual ou "Nenhuma"

### 5. Filtros: propagar novos KPIs

**Arquivo**: `src/utils/desempenhoV2Filters.ts`

Atualizar `updateKpis` para recalcular os novos/alterados KPIs ao aplicar filtros secundários (semestre, área, etc.)

## Thresholds de Conceito (referência)

```text
Conceito 1: < 40% proficientes
Conceito 2: 40–59%
Conceito 3: 60–74%
Conceito 4: 75–89%
Conceito 5: ≥ 90%

Faixa anterior → Meta:
  0% → 40%  (Conceito 1 → 2)
 40% → 60%  (Conceito 2 → 3)
 60% → 75%  (Conceito 3 → 4)
 75% → 90%  (Conceito 4 → 5)
 90% → topo (já Conceito 5)
```

## Arquivos modificados

1. `src/hooks/useInstitutionalPerformanceData.ts` — query count users
2. `src/utils/mapInstitutionalData.ts` — novos KPIs + meta
3. `src/mocks/desempenhoInstitucionalV2.ts` — interface MetaInstitucional
4. `src/components/analytics/v2/MetaInstitucionalCard.tsx` — redesign
5. `src/utils/desempenhoV2Filters.ts` — updateKpis

