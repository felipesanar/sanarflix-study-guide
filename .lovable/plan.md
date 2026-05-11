## Problema

Os 3 cards "Próximos de avançar / Distância moderada / Muito abaixo" continuam sendo calculados a partir do **percentual de acertos** dos alunos, e não do **score TRI (`resultados_alunos_tri.score_proprio`)**. Por isso, mesmo após termos corrigido a contagem do KPI "Alunos Abaixo do Esperado", o total dos 3 cards (28 + 12 + 12 = 52) não bate com os 37 alunos abaixo do esperado da FAI, e a distribuição entre faixas está incorreta.

A causa está em dois lugares:

1. `src/utils/mapInstitutionalData.ts` — bloco `distanciaFaixa` (linhas ~298–318) faz `s.percentual >= PROFICIENCY_THRESHOLD - 10` etc. usando o `percentual` de acertos, não o `triScore`.
2. `src/utils/desempenhoV2Filters.ts` — função `computeDistanciaFaixa` (linhas ~119–149) refaz o mesmo cálculo por `student.percentual` quando os filtros são aplicados.

Como a fonte verdadeira é `resultados_alunos_tri.score_proprio` (já carregado em `StudentScore.triScore`), as faixas devem ser derivadas dele, e alunos sem TRI devem ser ignorados — exatamente como já fizemos para o card "Alunos Abaixo do Esperado".

## Regra de classificação acordada

Universo: apenas alunos com `triScore != null` **e** `triScore < 60` (mesma base do card "Alunos Abaixo do Esperado", garantindo soma consistente).

Distância até a proficiência = `60 - score_proprio` (arredondada como inteiro, conforme já é feito no drawer).

Faixas (intervalos `0–10`, `11–20`, `>20`):

- **Próximos de avançar (até 10 pts)**: `distancia <= 10`
- **Distância moderada (10–20 pts)**: `distancia >= 11 && distancia <= 20`
- **Muito abaixo (>20 pts)**: `distancia > 20`

Garantia: a soma das 3 faixas == total do card "Alunos Abaixo do Esperado".

## Mudanças

### 1. `src/utils/mapInstitutionalData.ts`

Substituir o bloco `distanciaFaixa` (linhas 298–318) para classificar a partir de `alunosAbaixoStrict` (já filtrado por `triScore < 60`), usando `Math.round(60 - triScore)` como distância e os limites `<=10`, `11–20`, `>20`.

### 2. `src/utils/desempenhoV2Filters.ts`

Reescrever `computeDistanciaFaixa(students)` para:

- Filtrar `students` com `triScore != null && triScore < 60`.
- Calcular `distancia = Math.round(60 - triScore)` por aluno.
- Aplicar os mesmos cortes `<=10`, `11–20`, `>20`.
- Atualizar a chamada em `applyDesempenhoV2Filters` para passar o conjunto correto (continua sendo `filteredAllStudents`, pois os filtros de semestre/área devem afetar essas faixas também).

### 3. Verificação

- Abrir `/desempenho-institucional-v2` na FAI no simulado atual e confirmar:
  - Soma dos 3 cards == 37 (mesmo número de "Alunos Abaixo do Esperado").
  - "Muito abaixo" = 7 (contagem manual do usuário).
- Conferir no console do navegador (`[DesempenhoV2:Mapper]`) que não há regressão em outros KPIs.

## Fora de escopo

- Não alterar `KpiCardsGrid` nem o KPI "Alunos Abaixo do Esperado" (já corrigido).
- Não mudar `FaixaDistribuicaoChart` (faixas Insuficiente/Regular/.../Excelente, baseadas em % de acertos por design — confirmado em memória).
- Não tocar em RPCs nem em backend; toda a correção é frontend.
