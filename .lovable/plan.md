

# Correções: Casas decimais nos Insights + Ordem do gráfico de Evolução

## Problema 1: Gap com muitas casas decimais nos Insights Pedagógicos

No arquivo `src/components/analytics/v2/modules/InsightsPedagogicosModule.tsx`, os valores de `gap` são calculados como `PROFICIENCY_THRESHOLD - tema.percentual` mas não arredondados antes de serem exibidos. Isso gera valores como `4.399999999999999pts` e `1.2000000000000028pts`.

**Locais afetados:**
- Linha 105: `{ label: 'Gap', value: \`${gap}pts\` }` (critical-tema priorityFactors)
- Linha 125: `\`A apenas ${gap}pts da proficiência\`` (quick-win description)
- Linha 128: `{ label: 'Gap', value: \`${gap}pts\` }` (quick-win priorityFactors)
- Linha 285: `${insight.gap}pts gap` (top priority highlight cards)

**Correção:** Arredondar `gap` para 1 casa decimal com `Math.round(gap * 10) / 10` no momento do cálculo (linhas 65, 91), e usar `.toFixed(1)` nas exibições de texto.

## Problema 2: Gráfico "Evolução entre Simulados" com ordem incorreta

No mapper (`src/utils/mapInstitutionalData.ts`, linhas 180-196), a evolução é mapeada na ordem em que a RPC retorna, sem ordenação por data. O `RpcEvolutionEntry` possui o campo `created_at` (definido em `src/types/desempenhoV2.ts` linha 147).

**Correção:** Ordenar o array `evolution` por `created_at` antes de mapear para `EvolucaoSimulado[]`, garantindo que os simulados apareçam na ordem cronológica correta no eixo X do gráfico.

## Arquivos modificados

1. `src/components/analytics/v2/modules/InsightsPedagogicosModule.tsx` — arredondar gap para 1 casa decimal em todas as exibições
2. `src/utils/mapInstitutionalData.ts` — ordenar evolution por `created_at` antes de mapear

