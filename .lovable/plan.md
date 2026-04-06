

# Alterações na Página "Desempenho Institucional"

## 1. Gráfico "Evolução entre Simulados" — Alterar toggle

**Arquivo**: `src/components/analytics/v2/EvolucaoChart.tsx`

O toggle atual mostra "Proficiência" e "Nota". Será alterado para **"% Acertos"** e **"% Proficientes"**.

**Limitação técnica**: A RPC `get_institutional_evolution` retorna apenas agregados por área (total/acertos), sem dados por aluno por simulado histórico. Isso significa que **não é possível calcular "% de alunos proficientes" por simulado passado** a partir dos dados atuais. Para contornar:

- Adicionar o campo `percentProficientes` à interface `EvolucaoSimulado` (`src/mocks/desempenhoInstitucionalV2.ts`)
- No mapper (`src/utils/mapInstitutionalData.ts`), estimar o `percentProficientes` por simulado histórico usando a heurística: contar quantas áreas têm `percentual >= 60` como proxy, ou usar a accuracy geral como base para uma estimativa. Alternativa mais precisa: o simulado **atual** (o selecionado) tem dados de student scores — para esse, o cálculo é exato. Para históricos, usaremos a nota/conceito como proxy.
- Toggle: "% Acertos" (usa campo `proficiencia` que já é accuracy%) | "% Proficientes" (novo campo estimado)
- Domínio do YAxis: `[0, 100]` para ambos

## 2. Gráfico "Distribuição por Faixa" — Cor única + legenda explicativa

**Arquivo**: `src/components/analytics/v2/FaixaDistribuicaoChart.tsx`

- Trocar todas as cores das barras para uma única cor vermelha do design system (a cor `destructive` / primary-red)
- Adicionar na legenda ou abaixo do título uma explicação das faixas com os ranges:
  - Insuficiente: 0–30%
  - Regular: 30–50%
  - Intermediário: 50–60%
  - Bom: 60–80%
  - Excelente: 80–100%
- Formatar a legenda para mostrar `"Faixa (X%–Y%): N alunos (Z%)"` para cada faixa

## 3. "Quick Wins" → "Ganhos Rápidos"

**Arquivo**: `src/components/analytics/v2/modules/InsightsPedagogicosModule.tsx`

- Substituir todas as ocorrências de "Quick Win" / "Quick Wins" por **"Ganhos Rápidos"** / **"Ganho Rápido"**
- Atualizar o label no chip de filtro, no título do insight e na descrição

## 4. Gap com casas decimais — Arredondamento

**Arquivo**: `src/components/analytics/v2/shared/StudentAnalyticsDrawer.tsx`

- Linha 145: mudar `Math.max(0, PROFICIENCY_THRESHOLD - student.percentual)` para `Math.round(Math.max(0, PROFICIENCY_THRESHOLD - student.percentual) * 10) / 10` (1 casa decimal)
- Linha 181: atualizar o template para usar `gap.toFixed(1)` em vez de `${gap}`

**Arquivo**: `src/components/analytics/v2/modules/VisaoAlunosModule.tsx` — verificar se há exibição de gap com decimais e aplicar o mesmo arredondamento

## Arquivos modificados

1. `src/components/analytics/v2/EvolucaoChart.tsx` — toggle % Acertos / % Proficientes
2. `src/mocks/desempenhoInstitucionalV2.ts` — campo `percentProficientes` em `EvolucaoSimulado`
3. `src/utils/mapInstitutionalData.ts` — calcular `percentProficientes` na evolução
4. `src/components/analytics/v2/FaixaDistribuicaoChart.tsx` — cor única vermelha + legenda com ranges
5. `src/components/analytics/v2/modules/InsightsPedagogicosModule.tsx` — "Ganhos Rápidos"
6. `src/components/analytics/v2/shared/StudentAnalyticsDrawer.tsx` — arredondamento do gap
7. `src/components/analytics/v2/modules/VisaoAlunosModule.tsx` — arredondamento do gap (se aplicável)

