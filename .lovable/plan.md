

# Topo de Destaques (até 3) + Lista Inferior Linear

## Objetivo
1. **Topo**: sempre exibir até 3 cards de destaque, ordenados por prioridade (Críticos → Ganhos Rápidos → Pontos Fortes), em grid responsivo (1/2/3 colunas).
2. **Lista inferior**: reverter para layout linear simples — sem modos `single-highlight` / `compact-grid`. Filtros e estrutura dos cards permanecem intactos.

## Arquivo afetado
- `src/components/analytics/v2/modules/InsightsPedagogicosModule.tsx` (único)

## Mudanças

### 1. Cálculo dos destaques (`featuredInsights`)
Substituir o atual:
```ts
const topPriority = filtered.filter(i => i.type !== 'strength').slice(0, 3);
```
Por:
```ts
const featuredInsights = insights.slice(0, 3); // já vem ordenado por buildInsights:
                                               // critical → quick-win → strength
console.log('[Insights] total:', insights.length);
console.log('[Insights] featured:', featuredInsights.length);
```
Observação: `buildInsights` já ordena por `groupOrder` (críticos = 0, quick-win = 1, strength = 2) e dentro de cada grupo por `impacto` desc. Logo, `slice(0, 3)` cumpre exatamente a regra pedida (críticos primeiro, depois ganhos rápidos, depois pontos fortes). O destaque usa `insights` (lista global), **não** `filtered` — assim os cards do topo independem do chip ativo, refletindo as prioridades reais.

### 2. Renderização do topo (sempre que houver insights)
Remover o gating `mode === 'default'`. O bloco passa a aparecer sempre que `featuredInsights.length > 0`:

```tsx
{featuredInsights.length > 0 && (
  <motion.div
    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
  >
    {featuredInsights.map(insight => /* mesmo card existente */)}
  </motion.div>
)}
```
- Card visual **idêntico** ao atual (mesma estrutura de `Card` com `border-l-4`, ícone, título, badge e linha de métricas).
- Cor da borda lateral: vermelho se crítico, azul se quick-win, verde-escuro se strength (consistente com `getInsightConfig`).
- `gap-4`, breakpoints: `grid-cols-1` (mobile) → `md:grid-cols-2` (tablet) → `lg:grid-cols-3` (desktop).

### 3. Lista inferior — voltar para linear simples
Remover toda a lógica adaptativa `mode === 'single-highlight' | 'compact-grid'` e o componente `SingleHighlightCard` deixa de ser referenciado aqui (manter o componente no arquivo caso seja reaproveitado depois — sem impacto). 

A renderização da lista vira sempre o bloco linear que já existe hoje (linhas 442–471: `<div className="space-y-2">` com `filtered.map(...)`):
```tsx
{filtered.length === 0 ? (
  <p className="text-sm text-muted-foreground text-center py-8">Nenhum insight nesta categoria.</p>
) : (
  <div className="space-y-2">
    {filtered.map(insight => /* mesmo botão linear existente */)}
  </div>
)}
```
- Filtros (`Todos / Críticos / Ganhos Rápidos / Pontos Fortes`) seguem inalterados.
- Microcopies "Apenas 1 insight..." e "X insights identificados nesta categoria" são removidas (não fazem mais sentido sem os modos adaptativos).

### 4. Card explicador inferior
Mantido sem alterações.

### 5. Drawer (`InsightDetailSheet`)
Mantido sem alterações — clique em qualquer card (topo ou lista) continua abrindo o mesmo drawer.

## Comportamento esperado
| Cenário | Topo | Lista inferior |
|---|---|---|
| 1 Crítico, 0 Ganho, 7 Fortes | [Crítico] [Forte] [Forte] | 8 itens lineares com filtros |
| 0 Crítico, 2 Ganhos, 5 Fortes | [Ganho] [Ganho] [Forte] | 7 itens lineares |
| 5 Críticos, 3 Ganhos, 0 Fortes | [Crítico] [Crítico] [Crítico] | 8 itens lineares |
| 1 insight total | [único card] | 1 item linear |

## Responsividade
- `grid-cols-1` em < 768px (mobile)
- `md:grid-cols-2` em 768–1023px (tablet)
- `lg:grid-cols-3` em ≥ 1024px (desktop)
- Mesmo `gap-4` em todos os breakpoints.

## Critérios de aceite
- [ ] Topo sempre exibe entre 1 e 3 cards (nunca 0 quando há insights).
- [ ] Ordem do topo respeita: críticos → ganhos rápidos → pontos fortes.
- [ ] Lista inferior permanece linear (vertical), com filtros funcionando.
- [ ] Sem duplicação visual entre topo e lista (aceito que itens do topo apareçam também na lista — comportamento esperado).
- [ ] Console mostra `[Insights] total:` e `[Insights] featured:` a cada render.
- [ ] Layout responsivo verificado em 375px (1 col), 768px (2 col), 1280px (3 col).
- [ ] Sem erros no console; sem mudanças em backend, tipos, classify ou demais abas.

