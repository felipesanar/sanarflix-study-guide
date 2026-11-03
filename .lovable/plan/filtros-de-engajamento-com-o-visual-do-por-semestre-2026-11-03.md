# Filtros de Engajamento com o visual do "Por semestre"

## O que muda para o gestor
Os filtros **Período** e **Semestre do aluno**, no topo da página de Engajamento, passam a ter o mesmo visual da lista "Por semestre" do Desempenho Institucional:
- Botão com borda suave, ícone de calendário à esquerda e seta à direita.
- Texto no formato "Período: **Últimos 6 meses**" e "Semestre: **8º semestre · clínico**", com o valor em negrito.
- A lista abre como um menu flutuante, com marca de seleção na opção escolhida e destaque ao passar o mouse, igual ao print.
- Continuam sendo listas suspensas, com as mesmas opções e o mesmo comportamento. "Personalizado…" continua abrindo os campos De / Até e o botão Aplicar.
- O rótulo pequeno acima do filtro ("Período", "Semestre do aluno") sai, porque o nome já aparece dentro do botão, como no Desempenho Institucional.

## Detalhes técnicos
- Criar um gatilho reutilizável `GatilhoFiltroGestor` (ou extrair do `FiltroSemestre.tsx`) com o mesmo `SelectTrigger`/`SelectContent`/`SelectItem` e estilos (`--gp-surface-1`, `--gp-border-input`, `--gp-radius-sm`, padding 6px 11px, 12.5px, ícones `calendar_month` / `expand_more` / `check`, portal via `useGestorPortalContainer`). O `FiltroSemestre` passa a usá-lo, sem mudança visual.
- `FiltroPeriodo.tsx` e `FiltroSemestreEngajamento.tsx`: trocar o `<select>` nativo pelo Select do Radix com esse gatilho. Valor "Todos" do semestre vira `'todos'` internamente (o Radix não aceita valor vazio) e é convertido de volta para `null`.
- Campos De/Até e o botão Aplicar ganham a mesma borda, raio e altura do novo gatilho.
- `aria-label` "Período" e "Semestre do aluno" nos gatilhos, para manter a acessibilidade.
- Atualizar `EngajamentoLayout.test.tsx` (e outros testes que usam `fireEvent.change` nesses selects) para abrir o menu e clicar na opção. Rodar os testes de engajamento e o typecheck.
