## Plano

1. Corrigir a regra de classificação de “Alunos abaixo do esperado” na Visão Institucional para considerar exclusivamente alunos com `resultados_alunos_tri.score_enamed < 60`.
2. Remover os fallbacks atuais para `percentual de acerto` nos pontos que alimentam o card e a tabela expandida, para que alunos com TRI acima de 60 nunca apareçam nesse recorte.
3. Ajustar o pós-filtro da tela para preservar essa mesma regra quando houver filtros adicionais ativos, mantendo `Acerto` e `Sem.` como estão.
4. Validar no preview que:
   - o número do card corresponde apenas aos alunos com TRI abaixo de 60;
   - ao expandir o card, a tabela lista somente esses alunos;
   - nenhum aluno com `Proficiência (TRI) >= 60` aparece na tabela.

## Detalhes técnicos

- Atualizar o mapper institucional para montar `alunosAbaixo` somente a partir de `triScore` válido e abaixo de 60.
- Ajustar a contagem do KPI para não depender de percentual nem de combinação indireta que possa divergir da lista exibida.
- Corrigir `applyDesempenhoV2Filters` para filtrar `alunosAbaixo` por `triScore < 60` em vez de `percentual < 60`.
- Manter intactas as colunas `Acerto` e `Sem.` da tabela, alterando apenas a origem do critério de inclusão.