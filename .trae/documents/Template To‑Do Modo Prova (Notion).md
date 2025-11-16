## Epic
- Modo Prova: experiência em tela cheia, foco total e navegação eficiente
- KPI: tempo médio por questão, taxa de conclusão, saídas de aba, erros por questão

## Entregues (Concluído)
- Navegação lateral sem scroll, ordem horizontal e itens compactos
- Largura dinâmica da navegação; conteúdo com mais área útil
- Ocultar sidebar e cabeçalho durante a prova (full‑screen)
- Alternativas em grid responsivo com separação e alinhamento
- Acessibilidade das alternativas (button, foco, aria‑pressed)
- Restauração de alternativa eliminada por clique e ícone
- Persistência de estado e respostas com barra de progresso
- Navegação anterior/próxima e salto para questão específica
- Fluxo de finalização com envio e proteção de rota

## Backlog Próximo (Planejado)
- Atalhos de teclado: 1–4 para alternativas, setas para navegação
- Filtro na navegação: mostrar apenas “marcadas para revisão”
- Confirmação ao sair do modo tela cheia no meio da prova
- Feedback visual dedicado para eliminar/restaurar alternativa
- Auto‑save com debounce para reduzir I/O de storage
- Indicador de progresso por tema/seção (se metadados disponíveis)
- Modo alto contraste específico do modo prova

## Testes (Adicionar)
- Unitário — Alternativas
  - Seleção aplica estado/estilo correto
  - Clique em alternativa eliminada restaura e seleciona
  - Ícone/rótulo alternam entre eliminar e restaurar
- Unitário — Navegação
  - Ordem horizontal e estados (atual, respondida, revisão)
  - Largura dinâmica sem overflow interno
- Integração — Fluxo Modo Prova
  - Carregar → responder → marcar revisão → navegar → enviar
  - Persistência mantém estado e posição ao reabrir
  - Cronômetro pausa/retoma em saída/retorno de aba e tela cheia
- E2E (Playwright)
  - Simulado extenso com navegação lateral e finalização
  - Restauração de alternativas eliminadas com verificação de estado final

## Critérios de Aceite
- Navegação exibe todas as questões sem scroll interno
- Conteúdo com legibilidade e alinhamento consistentes
- Restauração de alternativa eliminada em um único passo
- Fluxo completo finaliza e registra resultados sem erros
- Atalhos de teclado funcionam e não conflitam com foco/acessibilidade

## Riscos e Dependências
- Metadados de tema/seção podem não existir
- Alto contraste requer revisão de paleta/tokens
- Atalhos precisam respeitar acessibilidade e foco

## Roadmap
- Iteração 1: atalhos de teclado + testes unitários de alternativas/navegação
- Iteração 2: filtro “revisão” + auto‑save com debounce
- Iteração 3: alto contraste + indicador por tema + E2E completos