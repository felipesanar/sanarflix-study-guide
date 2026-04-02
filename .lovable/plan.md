

# Reformulação do Progresso em "Meta Institucional"

## O que muda

O card `MetaInstitucionalCard` já possui a função `getConceitoInfo` com a lógica correta de faixas e cálculo de progresso (`(covered / range) * 100`). A mudança é **apenas visual/UX**: destacar o Conceito atual e mostrar os limites inferior/superior nas extremidades da barra.

## Arquivo modificado

`src/components/analytics/v2/MetaInstitucionalCard.tsx`

### Alterações na UI (seção Progress, linhas 96-112)

1. **Conceito em destaque**: Adicionar um Badge ou texto proeminente mostrando "Conceito X" acima ou ao lado da barra
2. **Limites na barra**: Mostrar `{info.previousThreshold}%` no início (esquerda) e `{info.nextThreshold}%` no final (direita) da barra de progresso
3. **Label de progresso**: Manter `"{info.progressPercent}% do caminho para Conceito {info.currentConceito + 1}"` — a fórmula já é `((valor - limInf) / (limSup - limInf)) * 100`
4. **Caso Conceito 5**: Mostrar "Conceito 5 alcançado", barra cheia, limites 90%–100%

### Layout da seção de progresso (novo)

```text
┌─────────────────────────────────────────────┐
│  Conceito 2          25% do caminho p/ C3   │
│  [40%]  ████████░░░░░░░░░░░░░░░░░  [60%]   │
│         Proficientes: 45%                    │
└─────────────────────────────────────────────┘
```

### Lógica (sem mudança)

A função `getConceitoInfo` na linha 22 já calcula exatamente o que foi pedido:
- `previousThreshold` = limite inferior da faixa
- `nextThreshold` = limite superior
- `progressPercent = ((percent - previousThreshold) / (nextThreshold - previousThreshold)) * 100`

Exemplo: 45% proficientes → Conceito 2 → `((45-40)/(60-40))*100 = 25%` ✓

Nenhuma alteração no mapper ou na lógica de cálculo é necessária.

