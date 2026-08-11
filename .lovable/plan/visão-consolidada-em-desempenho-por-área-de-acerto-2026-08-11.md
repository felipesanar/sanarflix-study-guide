# Visão consolidada em "Desempenho por área · % de acerto"

Alteração restrita a esse bloco do drawer do aluno (Visão Geral → Alunos).

## Comportamento

- **Padrão: "Todos os simulados"** — uma visão que junta os simulados que o aluno realmente fez e mostra o % de acerto médio por grande área → especialidade → tema, na mesma cascata de hoje.
- Os chips de simulado continuam: passa a existir um chip "Todos" (primeiro, ativo por padrão) seguido de "1º sim.", "2º sim."… A visão individual segue igual à atual.
- O rótulo de procedência muda conforme a escolha:
  - Consolidado: "Todos os simulados · 2 simulados considerados" e, quando algum simulado feito não tem classificação por área, uma linha dizendo quantos ficaram fora.
  - Individual: nome + data do simulado, com a tag "resultado em processamento" e o aviso de divergência de proficiência exatamente como hoje.
- O aviso "as barras abaixo são do 3º Simulado… a proficiência é do 1º" só aparece na visão individual — no consolidado ele não se aplica.

## Como o % médio é calculado

Média **ponderada pelas questões respondidas**, nunca média de percentuais: para cada tema, somam-se os acertos (`acertoPct/100 × questoesRespondidas`) e as questões respondidas de todos os simulados; o % do tema é a divisão. Especialidade e grande área agregam da mesma forma a partir dos temas — é a mesma regra de `acertoPonderado` já usada no drill-down.

Regras respeitadas:
- Tema/simulado com 0 questões respondidas fica fora (não entra como zero).
- Um tema que só aparece em um dos simulados continua aparecendo, com o dado que existe — sem inventar valor para o simulado em que não foi cobrado.
- No consolidado não se usa o `acertoPorArea` de um simulado como número "oficial" da grande área (ele é de um simulado só); o valor vem da agregação ponderada. Na visão individual, o número oficial da RPC continua prevalecendo como hoje.
- "Área crítica" no consolidado: um tema é marcado como crítico se estava crítico em algum dos simulados agregados — sem inventar baseline novo.

## Detalhes técnicos

- `src/features/gestor/components/DrawerAluno.tsx`: estado `areaEscolhida` passa a aceitar o valor `'todos'`; nova função pura `consolidarAreas(entradas: DesempenhoPorAreaSimulado[]): AreaDesempenhoAluno[]` que funde as linhas por `grandeArea|especialidade|tema` com ponderação; `entradaAreaDetalhada` passa a ser a lista consolidada quando o modo é "todos"; `InsightArea` recebe as áreas consolidadas apenas na visão individual (ele é por simulado).
- Escopo: só a agregação por área. Nada muda no contador de participação, na sparkline, nas notas por simulado, nas RPCs ou no baseline de área crítica da IES.
- Testes em `src/features/gestor/__tests__/DrawerAluno.test.tsx`: padrão abre em "Todos"; ponderação correta com dois simulados de tamanhos diferentes; tema presente em só um simulado; troca para chip individual restaura o comportamento atual; chips não aparecem quando há um único simulado com dados.
