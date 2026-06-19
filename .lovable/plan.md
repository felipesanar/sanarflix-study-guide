## Problema
O `AIInsightsCard` renderiza o texto da IA como string plana com `whitespace-pre-line`. Como o modelo retorna markdown (negritos `**texto**`, listas numeradas, etc.), os asteriscos aparecem crus e a hierarquia visual se perde.

## Solução
Renderizar a resposta com `react-markdown` (já é dependência usada em outros pontos da stack de chat) e aplicar tipografia consistente com o design tokens do projeto — sem mudar o backend nem a lógica de cache/fetch.

### Alterações
**`src/components/caderno-erros/AIInsightsCard.tsx`**
- Importar `ReactMarkdown` (e `remark-gfm` se já estiver disponível; senão só `react-markdown`).
- Substituir o `<p ... whitespace-pre-line>{insight}</p>` por um wrapper estilizado que renderize markdown com componentes customizados:
  - `strong` → `font-semibold text-foreground`
  - `p` → `text-sm text-muted-foreground leading-relaxed` + espaçamento entre parágrafos
  - `ol`/`ul` → listas com `space-y-1.5`, `pl-5`, marcadores discretos
  - `li` → `text-sm text-muted-foreground leading-relaxed`
  - `code` → estilo monoespaçado sutil
- Manter o container `Card` atual e o estado de loading/skeleton inalterados.

### Não muda
- Cache em sessionStorage, fetch da edge function, prompt no backend, condições de exibição (`entries.length >= 3`).
- Layout do card (header com ícone Sparkles + botão refresh).

### Verificação
- Smoke visual: abrir Caderno de Erros com ≥3 entradas e conferir que negritos viram bold real, listas numeradas renderizam como lista, sem `**` visíveis.
- `tsc` continua passando.
