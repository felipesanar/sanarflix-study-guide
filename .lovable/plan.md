## Problema

No dashboard institucional V2 (FAI):
- "Total de Alunos" mostra **100** (numerador atual = `COUNT(DISTINCT user_id)` em `answer_progress` para o simulado, pelo IES, excluindo apenas `gestor_formal`).
- "Alunos Proficientes" mostra **63% (62 de 99)** — esse 99 vem de `resultados_ies_tri.num_students`, que já trata corretamente apenas alunos.
- "Taxa de Adesão" mostra **100% (100/100)** — incongruente com o 99 do TRI.

A causa: as RPCs `get_institutional_performance` e `get_institutional_student_scores` filtram apenas `gestor_formal`, mas contam usuários como Sérgio (`1f618ac7-…`), que tem role `gestor`. Pela convenção do projeto, **aluno = usuário sem nenhuma entrada em `user_roles`** (mesma regra já usada em `get_ies_student_count`).

## Mudança

Migration única alterando as duas RPCs para trocar o filtro:

```text
- AND NOT has_role(u.id, 'gestor_formal')
+ AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
```

Aplicado em:
1. `get_institutional_performance` — CTE `ies_answers` (afeta `overallStats.totalStudents`, `overallStats.total/acertos`, `bySemester`, `byArea`, `bySpecialty`, `bySubspecialty`).
2. `get_institutional_student_scores` — bloco `students` (afeta a lista de alunos retornada e portanto `studentScores.students.length`).

## Resultado esperado

- "Total de Alunos" passa a contar apenas alunos com registro em `answer_progress` (Sérgio e quaisquer outros admin/professor/gestor/b2b/gestor_formal são excluídos) → **99** para FAI.
- "Taxa de Adesão" → **99/100 = 99%**.
- "Percentual de Acertos", `byArea/Especialidade/Tema` e tabelas de alunos passam a refletir somente alunos.
- Alinha com `resultados_ies_tri.num_students` (99) e com `get_ies_student_count` (100).

## Não muda

- Nenhuma alteração de código frontend.
- TRI (numerador/denominador de proficiência) já estava correto.
- `get_ies_student_count` permanece como está (denominador da Taxa de Adesão).
