# 07 · Movimento e interação

Objetivo: **máxima sensação de fluidez**. Fluidez é *resposta imediata + continuidade*, não animação longa.

## Tokens de duração

| Token | Tempo | Uso |
|---|---|---|
| `motion-1` | 80ms | Cor de texto/ícone, tint de hover |
| `motion-2` | 140ms | Hover de card, foco, press |
| `motion-3` | 200ms | Toggle, expandir linha, tooltip, troca de valor |
| `motion-4` | 320ms | Drawer, cascata, painel lateral |
| `motion-5` | 560ms | Desenho de gráfico, count-up de KPI |

## Curvas

- Padrão: `cubic-bezier(0.2, 0, 0, 1)`
- Entrada (algo aparece): `cubic-bezier(0, 0, 0, 1)`
- Saída (algo some): `cubic-bezier(0.4, 0, 1, 1)`
- `linear` só no spinner.

## Regras de ouro

1. Animar **apenas `transform` e `opacity`**. Nunca `width`, `height`, `top`, `left`.
2. Toda transição tem começo e fim — nada de loop fora de loading.
3. **Interromper é permitido**: nova ação cancela a anterior na hora, sem esperar terminar.
4. 60 fps como piso. Se não sustentar, encurte a duração antes de cortar o gesto.
5. Honrar `prefers-reduced-motion: reduce` → quase instantâneo, sem deslocamento (só opacidade).
6. Nada anima na primeira pintura além do reveal em cascata (máx. 3 níveis, 40ms de defasagem).

## Comportamentos por interação

| Interação | Comportamento |
|---|---|
| **Hover (card)** | Sobe 1px (`translateY(-1px)`), sombra sobe um degrau, borda vira marca — `motion-2` |
| **Hover (linha de tabela)** | Tint da superfície 2; no escuro, clareia — `motion-1` |
| **Press** | Comprime para 97% e clareia um passo; solta com o mesmo tempo — `motion-2` |
| **Foco** | Anel de 3px da marca a 16% aparece em `motion-2`, sem deslocar layout |
| **Toggle / segmented** | O indicador **desliza** por transform; rótulos e valores fazem cross-fade em `motion-3` |
| **Expandir linha (questão)** | Altura por `grid-template-rows` ou `scaleY` do conteúdo + fade — `motion-3` |
| **Cascata** | O ramo antigo colapsa enquanto o novo abre; nunca dois abertos — `motion-4` |
| **Drawer** | Entra com `translateX(16px)` + fade; scrim escurece em paralelo — `motion-4`; ESC e clique no scrim fecham com a curva de saída |
| **Gráfico** | Linhas se desenham L→R; barras crescem da base; números contam até o valor — `motion-5` |
| **Tooltip do gráfico** | Segue o cursor com guia vertical; aparece em `motion-1`, some em `motion-2` |
| **Troca de filtro** | Valores fazem cross-fade em `motion-3`; skeleton só se a resposta passar de 400ms |
| **Reordenar tabela** | Linhas transitam por transform (FLIP), não re-renderizam piscando |

## Implementação sugerida

- **CSS transitions** para hover, press, foco e toggle (barato e interrompível).
- **Framer Motion** para reveal, drawer, reorder (FLIP) e listas.
- Contadores: `requestAnimationFrame` com easing padrão; nunca `setInterval`.
- Evite `layout` animation do Framer em tabelas grandes — use `layoutId` só nos itens visíveis.
