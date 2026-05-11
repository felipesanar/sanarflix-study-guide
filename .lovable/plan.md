## Objetivo

Garantir que, na tela "Visão Institucional" (`/desempenho-institucional-v2?modulo=visao-institucional`), todas as métricas relacionadas a **Proficiência Média (TRI)**, **Alunos Proficientes**, **número de proficientes**, **TRI médio** e **Conceito** venham exclusivamente da tabela `resultados_ies_tri` (via RPC `get_institutional_tri`), com arredondamento para 0 casas decimais.

## Estado atual

`src/utils/mapInstitutionalData.ts` já consome o snapshot TRI quando disponível (`hasTri`), mas:
- Usa fallback de acurácia quando o snapshot é ausente, podendo exibir valores que **não** vêm da tabela TRI.
- Arredonda `pcp` e `mean_score` com 1 casa decimal (`Math.round(x * 10) / 10`), em vez de 0.
- O label "Alunos Abaixo do Esperado" usa contagem por acurácia (`abaixo.length`), não `num_students - num_proficient` da tabela TRI.
- "Distância Próxima Faixa" e meta usam `percentProficientes` arredondado em 1 casa.

## Mudanças (apenas `src/utils/mapInstitutionalData.ts`)

1. **Proficiência Média (TRI)**
   - Valor: `Math.round(triSnapshot.mean_score)` (0 casas).
   - Quando `mean_score` ausente → exibir `'—'` e status `neutral`. Descrição mantida: "Score TRI médio da IES (0 a 100)…".
   - Não usar mais `overallAccuracy` como fallback nesse KPI.

2. **Alunos Proficientes**
   - Percentual: `Math.round(pcp%)` (0 casas) → ex.: `48%`.
   - Quantitativo (descrição inferior): `${num_proficient} de ${num_students} alunos`, ambos da `resultados_ies_tri`.
   - Sem TRI → valor `'—'` e descrição "Dados TRI indisponíveis".

3. **Nota Prevista da IES (Conceito)**
   - Já vem de `triSnapshot.concept`. Sem TRI → valor `'—'`.
   - Remover o cálculo `getConceito(percentProficientes)` como fallback nesse KPI.

4. **Distância Próxima Faixa**
   - `percentProficientes` passa a ser inteiro (`Math.round(pcp%)`).
   - Distância em p.p. arredondada a 0 casas: `Math.round(nextConceitoTarget - pct)`.

5. **Alunos Abaixo do Esperado**
   - Valor: `num_students - num_proficient` (da tabela TRI), quando disponível.
   - Sem TRI → manter contagem atual baseada em acurácia (compatibilidade).

6. **Header summary / Meta**
   - `headerSummary.percentProficientes` e `meta.percentProficientes` passam a ser inteiros vindos de `pcp`.
   - `meta.proficienciaAtual` = `Math.round(mean_score)`.
   - `meta.notaAtual` = `triSnapshot.concept`.
   - `meta.totalStudentsSimulado` segue o `num_students` do TRI quando disponível.
   - `alunosFaltamMeta` calculado com `num_proficient`/`num_students` do TRI.

7. **Sanção regulatória**
   - Mantém-se a lógica atual (derivada do `concept`). Sem alteração.

## Fora de escopo

- Faixas de distribuição, evolução, breakdown curricular, tabelas de alunos: continuam vindo das RPCs atuais (`get_institutional_performance` / `get_institutional_student_scores`) — o usuário pediu somente as métricas de TRI/conceito/proficientes.
- Nenhuma mudança de schema, RPC, RLS ou backend.
- Nenhuma alteração visual além do número de casas decimais e do texto da descrição quando TRI estiver ausente.

## Validação

- Conferir KPI cards na tela com a IES atual (`2c458bcb-…`) e simulado `f2621d1e-…`: valores devem coincidir com `SELECT mean_score, pcp, num_proficient, num_students, concept FROM resultados_ies_tri WHERE college_id=… AND simulado_id=…`.
- Testar IES/simulado sem linha em `resultados_ies_tri` → KPIs TRI mostram `'—'` sem quebrar layout.
- `rg "overallAccuracy|percentProficientesAccuracy"` confirma que esses fallbacks não são mais usados nos KPIs TRI.
