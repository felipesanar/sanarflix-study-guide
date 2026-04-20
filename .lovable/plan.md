

# Layout Adaptativo para Poucos Insights (Insights Pedagógicos)

## Objetivo
Quando a lista filtrada tem poucos insights (1, 2 ou 3), o layout deve preencher melhor o espaço disponível para reforçar a percepção de valor — em vez de exibir cards minúsculos com muito espaço vazio. Para 4+ insights, mantém o layout atual.

## Arquivo afetado
- `src/components/analytics/v2/modules/InsightsPedagogicosModule.tsx` (único)

## Escopo
A lógica adaptativa é aplicada à **lista principal** (`filtered.map(...)`, atualmente `space-y-2` com botões em linha). O bloco "Top priority highlights" (Top 3) é **removido na prática** quando há ≤3 insights, porque ele duplicaria o conteúdo da lista. Quando há ≥4, o Top 3 destacado continua aparecendo como hoje.

Lógica de modo:
```ts
const mode =
  filtered.length === 1 ? 'single-highlight' :
  filtered.length <= 3  ? 'compact-grid'      :
                          'default';
```
Log: `console.log('[Insights] Layout adaptativo', { totalInsights: filtered.length, mode });`

## Comportamento por modo

### `default` (≥4 insights) — sem mudanças
- Mantém Top 3 destacado (`grid-cols-1 md:grid-cols-3 gap-3`) e a lista vertical (`space-y-2`) como hoje.

### `compact-grid` (2 ou 3 insights)
- **Não renderizar** o bloco "Top priority highlights" (evita duplicação).
- Microcopy acima: `"{N} insights identificados nesta categoria"` em `text-xs text-muted-foreground`.
- Lista vira grid de cards mais largos:
  - Container: `grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto`
  - Card individual: `p-5` (mobile `p-4`), mantém ícone + título + badge + descrição completa (sem `line-clamp-1`), e linha de métricas (`% acerto` • `% prevalência` • `N alunos afetados` quando aplicável).
- Para 3 insights: o terceiro card ocupa `md:col-span-2` se ficar sozinho na segunda linha? Não — fica `md:col-span-1` simples; layout 2+1 é aceito.

### `single-highlight` (exatamente 1 insight) — Insight Destaque Expandido
- **Não renderizar** o bloco "Top priority highlights".
- Microcopy acima do card: `"Apenas 1 insight {categoria} identificado"` (categoria = "crítico"/"ganho rápido"/"ponto forte" conforme `cfg.label` em minúsculas).
- Card único centralizado:
  - Container: `max-w-3xl mx-auto`
  - Estilo: `bg-muted/40`, `border-l-4` na cor da categoria (já existe pattern), `p-6 sm:p-8`, `rounded-2xl`, animação `motion.div` com `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}`.
  - Estrutura interna (vertical, `space-y-5`):
    1. **Header**: ícone grande (`h-6 w-6`) + título (`text-xl font-semibold`) + badge da categoria.
    2. **Métricas em linha** (`grid grid-cols-1 sm:grid-cols-3 gap-4`): cada bloco com label pequena + valor grande (`text-2xl font-bold`):
       - "Percentual de acerto" → `{percentual}%`
       - "Prevalência" → `{prevalencia.toFixed(1)}%`
       - "Alunos afetados" → `{alunosAfetados}` (oculto se `0`, ex.: pontos fortes — nesse caso mostra apenas 2 colunas em sm)
    3. **🔍 Interpretação do Insight**: bloco com fundo `bg-background/60`, padding `p-4`, `rounded-lg`. Texto gerado dinamicamente:
       - Crítico: `"Este tema apresenta baixo desempenho ({P}% de acerto) e alta incidência no simulado ({V}%), indicando forte impacto no resultado institucional."`
       - Ganho Rápido: `"Os alunos estão próximos da proficiência ({P}% de acerto) em um tema relevante ({V}% de prevalência) — um pequeno reforço pode gerar grande impacto."`
       - Ponto Forte: `"A turma demonstra domínio consistente neste tema ({P}% de acerto, {V}% de prevalência). Manter a abordagem atual."`
       - Área Crítica: `"A área {areaName} concentra {V}% das questões do simulado e está com desempenho médio de {P}%, abaixo da proficiência institucional."`
    4. **🎯 Recomendação prática**: bloco igual ao anterior. Texto:
       - Crítico/Área Crítica: `"Priorizar revisão dirigida em {temaName ?? areaName} para alunos abaixo da proficiência, com foco nos subtemas de maior incidência."`
       - Ganho Rápido: `"Disponibilizar lista de exercícios direcionada em {temaName} para consolidar a proficiência da turma."`
       - Ponto Forte: `"Manter a estratégia atual de ensino em {temaName} e usá-lo como referência para outros temas."`
    5. **Footer**: botão `"Ver detalhes completos"` (variant `outline`, `size="sm"`, `w-full sm:w-auto`) que abre o `InsightDetailSheet` existente — preserva a funcionalidade do drawer sem duplicar conteúdo.

## Helpers novos (no mesmo arquivo)
```ts
function getInterpretation(insight: PrioritizedInsight): string { ... }
function getRecommendationText(insight: PrioritizedInsight): string { ... }
```
Colocados próximos a `getCategoryReason`.

## Estados preservados (sem mudança)
- `loading`, `error`, `!data`, `insights.length === 0` — tudo igual.
- Filtro de chips, contadores, drawer lateral, card explicador inferior — tudo igual.
- Lógica `classify`, `buildInsights`, ordenação — intocada.

## Responsividade
- Mobile (375px):
  - `single-highlight`: card 100% width, `p-4`, métricas empilham (`grid-cols-1`), título cai para `text-lg`.
  - `compact-grid`: 1 coluna (`grid-cols-1`), padding `p-4`.
- Desktop:
  - `single-highlight`: `max-w-3xl mx-auto`.
  - `compact-grid`: 2 colunas centralizadas (`max-w-5xl mx-auto`).

## Critérios de aceite
- [ ] `filtered.length === 1` → renderiza card único expandido com Interpretação + Recomendação; sem Top 3 acima.
- [ ] `filtered.length` em {2,3} → grid 2 colunas centralizado, cards mais largos, sem Top 3 acima.
- [ ] `filtered.length >= 4` → layout idêntico ao atual (Top 3 + lista vertical).
- [ ] Botão "Ver detalhes completos" no card único abre o drawer já existente sem duplicar dados.
- [ ] Microcopy correto em cada modo.
- [ ] Console mostra `[Insights] Layout adaptativo` com `totalInsights` e `mode` corretos a cada render.
- [ ] Sem alteração em backend, tipos, lógica de classificação ou outras abas.
- [ ] Funciona em viewport 375px sem quebra; sem `NaN`/`undefined` na UI.

