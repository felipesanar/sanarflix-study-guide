## Problema

Na aba **Visão de Alunos**, os cards de resumo (Proficientes / Próximos / Abaixo) estão contando **todos os alunos** — inclusive os que não têm nota TRI calculada — usando o percentual de acertos como fallback para classificar proficiência. Isso gera divergência com a **Visão Institucional**, que só classifica alunos com TRI.

Exemplo real observado:
- Visão Institucional: 8 proficientes / 20 alunos (6º ano).
- Visão de Alunos: 23 proficientes (contando alunos sem TRI via %).

## Causa

Em `src/components/analytics/v2/modules/VisaoAlunosModule.tsx`:

- `getScoreFor(s)` retorna `triScore` quando existe, senão `percentual` (fallback).
- Os contadores `proficientes / proximos / abaixo` (linhas 195–197) e o `count` dos chips de segmento (linha 254) aplicam `computeProficiencyStatus(getScoreFor(s))` sobre **todos** os alunos, incluindo os sem TRI.

Regra correta (confirmada pelo usuário): **classificação de proficiência só se aplica a alunos com `triScore` calculado**. Alunos sem TRI não entram em nenhum bucket de proficiência.

## Mudanças (somente front, escopo restrito ao módulo)

Arquivo único: `src/components/analytics/v2/modules/VisaoAlunosModule.tsx`.

1. Criar um subconjunto `studentsWithTri = data.allStudents.filter(s => s.triScore != null)` uma única vez (via `useMemo`).
2. Recalcular os cards de resumo sobre esse subconjunto:
   - `proficientes = studentsWithTri.filter(s => computeProficiencyStatus(s.triScore) === 'proficiente').length`
   - idem para `proximos` e `abaixo`.
   - `Total Alunos` continua `data.allStudents.length` (mantém a leitura de "quantos alunos participaram"), mas adicionar um subtítulo/hint discreto no card indicando quantos têm TRI calculado quando houver diferença — ex.: `"41 · 20 com TRI"`. Isso mantém coerência visual com a Institucional (que trabalha sobre a base com TRI) sem esconder a base total de participantes.
3. Ajustar os chips de segmento (`SEGMENT_OPTIONS`) na linha ~254:
   - `count` dos chips `proficiente / proximo / abaixo` passa a considerar somente `studentsWithTri`.
   - `count` do chip `todos` continua `data.allStudents.length`.
   - Ao aplicar um filtro de segmento de proficiência, a lista filtrada (`sortedStudents`, linha 127) também exclui alunos sem TRI. O chip `todos` mantém o comportamento atual (mostra todos, incluindo os sem TRI, que já ficam em cinza pela alteração anterior).
4. Log `[VisaoAlunos] Render do módulo` passa a incluir `studentsWithTri.length` para facilitar auditoria futura.

Nenhuma alteração em RPC, tipos, `computeProficiencyStatus`, `VisaoInstitucionalModule`, badges dos alunos individuais (o comportamento neutro em cinza para alunos sem TRI, adicionado no item anterior, permanece inalterado) ou lógica de "TRI em Calibração / Amostra Insuficiente".

## Validação

Após aplicar, com o simulado atual (Funepe / Simulado FUNEPE / 6º ano):
- Card **Proficientes** da Visão de Alunos deve bater com o número da Visão Institucional (ex.: 8).
- Soma `Proficientes + Próximos + Abaixo` = total de alunos com TRI (nunca inclui alunos sem TRI).
- Chips de segmento de proficiência refletem os mesmos números dos cards.
- Filtro `todos` continua listando todos os alunos, com os sem TRI em cinza.
