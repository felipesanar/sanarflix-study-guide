# Prompts prontos para o Claude Code

Uma fase por PR, na ordem. Cole o conteúdo do arquivo como mensagem inicial, com o repositório aberto.

| Arquivo | Fase |
|---|---|
| `00-bootstrap.md` | Leitura do handoff + diagnóstico do repositório (sem código) |
| `01-fundacao.md` | Tokens, tipos, cliente de API, MSW, layout, rotas |
| `02-inicio.md` | Tela Início (cronograma, avisos, direcionadores) |
| `03-visao-geral.md` | KPIs, filtro, gráfico protagonista |
| `04-diagnostico.md` | Resumo por nível, cascata, drawer de temas |
| `05-alunos.md` | Distribuição, dispersão, tabela, visão detalhada |
| `06-detalhamento.md` | Seletor, KPIs, área×semestre, alunos, questões |
| `07-comparativo.md` | Comparativo 2+ (colapsado e expandido) |
| `08-acabamento.md` | Motion, a11y, dark, performance, telemetria |

Regras válidas para todas as fases:

- Leia `CLAUDE.md` e `docs/02-regras-de-negocio.md` antes de qualquer código.
- Use os componentes/tokens que já existem no repositório e no Dendê; só crie o que não existir.
- Implemente **todos os estados** do componente (`docs/12-qa-e-definicao-de-pronto.md`).
- Não copie HTML do protótipo. Ele é referência visual.
- Ao terminar: `lint`, `typecheck`, `test`, `build` verdes + screenshots claro/escuro no PR.
