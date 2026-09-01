# Visão de alunos (Detalhamento por Simulados): busca por nome + export detalhado

## 1. Barra de busca por nome

No topo do bloco "Visão de alunos" do Detalhamento, ao lado do cabeçalho (acima dos chips
"Todos / Proficiente / Próximo da proficiência / Não proficiente"), entra um campo de busca
por nome do aluno.

- Filtro client-side, sobre a lista de alunos já carregada — nenhuma requisição nova.
- Acento-insensível e sem diferenciar maiúsculas ("jose" acha "JOSÉ"), casando por trecho
  em qualquer parte do nome.
- Combina com os filtros existentes (faixa de proficiência e "Ocultar não participantes")
  e volta para a página 1 a cada nova busca.
- Sem resultado: estado vazio já existente, com texto explicando que a busca escondeu as
  linhas e ação para limpar.
- Contadores do cabeçalho continuam falando da população do recorte, não do texto digitado —
  a busca não altera nenhum número calculado.
- Visual e acessibilidade idênticos ao campo de busca já usado na tabela da Visão Geral
  (mesma borda, ícone de lupa, `aria-label` "Buscar aluno").

## 2. "Exportar recorte" do drawer do aluno com detalhamento por área

Hoje o CSV tem uma linha por simulado, só com os indicadores macro (proficiência, acertos,
situação). Passa a sair um arquivo com duas partes:

1. **Resumo por simulado** — exatamente o que sai hoje (simulado, data, participou,
   proficiência, acertos, situação).
2. **Detalhamento por área** — uma linha por tema, com as colunas:
   Simulado · Grande área · Especialidade · Tema · Questões respondidas · Questões totais ·
   % de acerto · Tema crítico (sim/não).

Regras mantidas:
- Uma linha por simulado — nada fundido entre simulados. Quando o drawer está na visão
  consolidada ("Todos"), também sai um bloco consolidado, marcado como "Todos os simulados"
  na coluna Simulado, com o % ponderado pelas questões respondidas (o mesmo número que a
  tela mostra, sem cálculo novo).
- Célula vazia onde não há dado — nunca zero.
- Decimal com vírgula, sem sufixo de unidade, `;` como separador e BOM de UTF-8 (padrão do
  export atual, para abrir certo no Excel pt-BR).
- Se o detalhamento por área ainda não carregou ou não existe para nenhum simulado, o
  arquivo sai só com o resumo e o toast avisa que o detalhamento por área não estava
  disponível.
- O gate de permissão de exportar continua onde está (`AcoesRecorte`), sem mudança.

## Detalhes técnicos

- `src/features/gestor/components/TabelaAlunosSimulado.tsx`: novo estado `busca`, aplicado
  dentro do `useMemo` de `visiveis`, com normalização NFD para remover acento; reset de
  página; textos dos estados vazios cobrindo a combinação com os filtros já existentes.
- `src/features/gestor/lib/exportarCsv.ts`: helper para concatenar seções (título de bloco +
  cabeçalho + linhas) num único CSV, reaproveitando `montarCsv`/`baixarCsv`.
- `src/features/gestor/components/DrawerAluno.tsx`: `exportar()` passa a montar as duas
  seções a partir de `useAlunoDesempenhoPorArea` (contrato `AreaDesempenhoAluno`) e do
  consolidado já calculado por `consolidarAreas`.
- Testes: casos de busca (acento, trecho, combinação com filtros, vazio) em
  `TabelaAlunosSimulado`, e casos do CSV (seções, célula vazia, linha de tema, ausência de
  detalhamento) em `exportarCsv` / `DrawerAluno`.
