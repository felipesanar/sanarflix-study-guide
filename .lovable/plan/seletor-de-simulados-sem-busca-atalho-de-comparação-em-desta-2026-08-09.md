# Seletor de simulados: sem busca, atalho de comparação em destaque

## O que muda

1. **Sai a busca.** O campo "Buscar simulado" e o ícone de lupa no topo do painel deixam de existir. A lista de simulados do cronograma é curta e já vem agrupada em "Disponíveis" e "Ainda sem resultado" — filtrar por texto só adicionava um passo. Sai junto o estado "Nenhum simulado com esse nome", que só existia por causa do filtro.

2. **"Comparar os 2 mais recentes" vira um atalho bonito de um clique.** Deixa de ser um link discreto ao lado da lupa e passa a ser a primeira faixa do painel: um botão de largura total com ícone de comparação, o título do atalho e, embaixo, os dois simulados que ele vai marcar (nome + data), para o gestor saber o que vai acontecer antes de clicar. Fundo em tom de marca suave, hover e foco visíveis, e um separador entre ele e a lista.

O atalho continua aparecendo apenas quando faz sentido: existem 2+ simulados com resultado e a seleção atual ainda não é exatamente esses dois. Ao clicar, ele marca os dois e mantém o painel aberto, como hoje.

Nada mais muda: os chips removíveis, o contador, "Limpar seleção", o aviso de legibilidade acima de 5, os agrupamentos, o rodapé com "Concluir" e o fechamento por ESC/clique fora seguem iguais.

## Detalhes técnicos

Arquivo único: `src/features/gestor/components/SeletorSimulados.tsx`.

- Remover o estado `busca`, a ref `campoBusca`, o helper `normalizar`, a função `filtrar`, as listas `disponiveisVisiveis`/`indisponiveisVisiveis` (a lista passa a renderizar `disponiveis` e `indisponiveis` direto) e a flag `nadaEncontrado`.
- O efeito que hoje focava o campo ao abrir passa a mover o foco para o primeiro item selecionável da lista, para o teclado não ficar sem ponto de entrada ao abrir o painel.
- O atalho usa `doisMaisRecentes`/`podeCompararRecentes` já existentes, agora renderizando também os rótulos dos dois itens (`rotuloItem` reduzido a nome + data).
- Estilos apenas com tokens `--gp-*` já disponíveis no tema (`--gp-brand-surface`, `--gp-border-strong`, `--gp-text-*`, `--gp-radius-*`); nenhum hex solto, nenhum token novo.
- Verificação: `bunx vitest run src/features/gestor/__tests__` (inclui `Detalhamento`, `a11y` e `regras-criticas`) e `bunx tsgo --noEmit`.
