# 11 · Acessibilidade (WCAG 2.1 AA)

## Contraste

- Texto normal ≥ 4.5:1; texto grande (≥ 24px ou 19px bold) ≥ 3:1; bordas e ícones informativos ≥ 3:1.
- No tema escuro: **nunca** `#B81414` como cor de texto (use `#F0817D`); nunca branco puro em bloco longo (use `#ECEFEF`).
- Cor jamais é a única informação: todo status tem rótulo textual (`Proficiente`, `Não participou`, `Crítico`).

## Teclado

| Elemento | Comportamento |
|---|---|
| Navegação da sidebar | Tab; `aria-current="page"` no item ativo |
| Segmented (semestre) | Setas ← → movem, Espaço/Enter selecionam (`role="radiogroup"`) |
| Seletor de simulados | Checkbox nativo; Espaço marca; grupo com `aria-describedby` para o aviso de 5+ |
| Cascata | Enter/Espaço expande; `aria-expanded`; setas ↑ ↓ entre nós |
| Linha expansível (questão) | `<button>` na célula do número; `aria-expanded` + `aria-controls` |
| Drawer | Foco vai para o título ao abrir, fica **preso** dentro, ESC fecha, foco volta ao gatilho |
| Tabela | Cabeçalho ordenável como `<button>` com `aria-sort` |
| Tooltip | Abre no foco, não só no hover; conteúdo em `role="tooltip"` referenciado por `aria-describedby` |

Foco visível sempre (também no clique): anel de 3px de marca a 16% — nunca `outline: none` sem substituto.

## Estrutura semântica

- Um `<h1>` por rota; seções com `<section aria-labelledby>`.
- Tabelas reais (`<table>`, `<th scope>`), não grids de `<div>`, sempre que houver dado tabular.
- Skeleton com `aria-busy="true"` no bloco e `aria-live="polite"` para anunciar a chegada do dado.
- Estados vazio/erro anunciados por `role="status"` / `role="alert"`.

## Gráficos

- `role="img"` + `<title>` e `<desc>` com a leitura resumida.
- Alternativa tabular sempre disponível ("Ver como tabela").
- Pontos navegáveis por teclado com anúncio do valor.

## Movimento

`prefers-reduced-motion: reduce` → transições quase instantâneas, sem deslocamento, sem count-up, sem desenho de linha.

## Idioma e formatação

`<html lang="pt-BR">`; números e datas em `pt-BR`; abreviações com `<abbr title>` na primeira ocorrência (TRI, ENAMED).

## Teste

- Automatizado: `axe-core` no CI (falha em violação séria/crítica).
- Manual: percorrer cada tela só com teclado; leitor de tela (NVDA/VoiceOver) na Visão Geral e no Detalhamento; zoom de 200% sem perda de conteúdo.
