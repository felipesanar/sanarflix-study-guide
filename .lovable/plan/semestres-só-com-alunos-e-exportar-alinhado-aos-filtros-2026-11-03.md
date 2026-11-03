# Semestres só com alunos e "Exportar" alinhado aos filtros

## O que muda para o gestor
1. **Lista "Semestre" do Engajamento** mostra só os semestres em que a instituição tem alunos, mais a opção "Todos". Ex.: uma IES só com 11º e 12º vê "Todos", "11º semestre · internato" e "12º semestre · internato".
   - A lista usa a mesma contagem de alunos da tabela "Comparativo entre semestres", que não muda ao filtrar semestre ou aluno. Então a lista fica estável quando você escolhe uma opção.
   - Se o semestre que está no link não tiver alunos, ele continua aparecendo para não sumir da tela.
   - Enquanto os dados carregam, a lista mostra só "Todos" (nada de opções inventadas).
2. **Botão "Exportar"** passa a ter a mesma altura, borda, cantos e tamanho de letra dos filtros Período e Semestre, alinhado na mesma linha.

## Detalhes técnicos
- `EngajamentoLayout.tsx`: calcular `semestresDisponiveis = dados?.semestres.filter(s => s.base > 0).map(s => s.semestre)` e passar para `FiltroSemestreEngajamento`; trocar `items-end` por `items-center` (os rótulos de cima já saíram).
- `FiltroSemestreEngajamento.tsx`: nova prop `semestresDisponiveis?: number[]`; opções = "Todos" + disponíveis (ordenados), incluindo o selecionado atual se faltar.
- `BotaoExportarAba.tsx`: usar `ESTILO_GATILHO_FILTRO` (de `SelectFiltroGestor.tsx`) em vez de `ESTILO_CONTROLE`, mantendo o peso 600 e o ícone.
- Testes: ajustar `EngajamentoLayout.test.tsx` (lista com 13 opções passa a depender dos semestres do mock) e adicionar um caso "IES só com 11º e 12º mostra só essas opções". Rodar os testes de engajamento e o typecheck.
