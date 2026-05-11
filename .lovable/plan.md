## Objetivo

Trocar a fonte do score do aluno de `resultados_alunos_tri.score_enamed` para `resultados_alunos_tri.score_proprio` em todos os pontos do frontend que alimentam "Visão Institucional" e "Visão de Alunos".

## Alterações

1. **`src/services/institutional.ts`** — `fetchStudentTriScores`
   - Trocar o `.select('student_id, score_enamed, is_proficient_enamed')` por `.select('student_id, score_proprio')`.
   - Atualizar a interface `StudentTriScore` para expor `score_proprio` (remover `score_enamed`/`is_proficient_enamed`, que não são consumidos a jusante).

2. **`src/utils/mapInstitutionalData.ts`**
   - Ajustar a assinatura do parâmetro `studentTriScores` para `{ student_id: string; score_proprio: number | null }[]`.
   - Trocar `row.score_enamed` por `row.score_proprio` ao montar o `triScoreById`.
   - Atualizar os comentários que mencionam `score_enamed` para `score_proprio` (linhas 190 e 329). Toda a lógica derivada (`triScore`, `alunosAbaixoStrict`, KPIs, ordenação, "Distância p/ Proficiência" = 60 − score) continua igual, apenas a fonte do número muda.

3. **`src/types/desempenhoV2.ts`**
   - Atualizar o comentário do campo `triScore` para referir-se a `score_proprio`.

## Fora de escopo

- RPCs institucionais (`get_institutional_tri`, `get_institutional_evolution_tri`, `get_institutional_longitudinal_tri`, `get_student_growth_tri`) e a migração `20260508194716_*.sql` continuam usando `score_enamed`/`mean_score` da `resultados_ies_tri`. O usuário pediu para alterar onde consultamos o **score do aluno** — essas RPCs agregam métricas institucionais (média/PCP/conceito) e não são a fonte por aluno. Mantemos como estão para não quebrar a Visão Institucional, que já lê `mean_score` via TRI snapshot.
- Nenhuma migração de banco é necessária (a coluna `score_proprio` já existe em `resultados_alunos_tri`).
- Indicadores de percentual de acerto não são tocados.

## Validação

- Abrir Visão de Alunos: card "Alunos abaixo do esperado" e tabela expandida devem refletir `score_proprio < 60`; coluna "Proficiência (TRI)" e "Distância" devem usar `score_proprio`.
- Abrir Visão Institucional: KPIs derivados de `triScore` por aluno (proficientes/abaixo) devem refletir `score_proprio`.
