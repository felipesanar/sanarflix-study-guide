

# Redesign da Aba "Inteligência Decisória"

## Resumo

Substituir o conteúdo atual da aba (cards de temas prioritários + lista repetitiva) por um painel de priorização estratégica com dois gráficos analíticos e o simulador de impacto já existente embutido abaixo.

## O que muda

O arquivo `InteligenciaDecisoriModule.tsx` será **reescrito** com a seguinte estrutura:

### Seção 1 — Visualizações Estratégicas (topo, lado a lado)

**Gráfico A — Mapa de Prioridades (Scatter Plot)**
- Eixo X: Prevalência no exame (% de questões do tema no total)
- Eixo Y: Proficiência média (% acerto)
- Cada ponto = um tema abaixo da proficiência
- Linha de referência horizontal em 60pts (threshold)
- Quadrante inferior-direito destacado com fundo vermelho suave ("Prioridade de Intervenção": alta prevalência + baixa proficiência)
- Tooltip com nome do tema, área, prevalência e proficiência
- Usa Recharts `ScatterChart` (já disponível no projeto via `recharts`)

**Gráfico B — Índice de Impacto Curricular (Barras Horizontais)**
- Barras ordenadas por score de impacto (prevalência × alunos afetados × gap)
- Top 10 temas com maior índice
- Cor gradiente por intensidade do impacto
- Usa Recharts `BarChart` com `layout="vertical"`

### Seção 2 — Simulador de Impacto (abaixo dos gráficos)

- Reutiliza a lógica e UI já existentes em `SimuladorImpactoModule.tsx`
- Importa o componente diretamente (não duplica código)
- Remove loading/error/empty states redundantes (já tratados pelo wrapper)
- Passa `data`, `loading`, `error`, `onRetry` como props

### O que é removido
- Resumo Executivo (card com Sparkles)
- Top 3 decision cards
- Filter chips (Todos / Prioridade Máxima / Quick Wins / Prevalentes)
- Lista completa de itens com drawer de detalhe
- Card de metodologia do score composto
- `DecisionDetailSheet`

## Arquivos modificados

1. **`src/components/analytics/v2/modules/InteligenciaDecisoriModule.tsx`** — Reescrita completa do conteúdo. Mantém mesma interface (`Props`), mesma exportação. Internamente:
   - Reutiliza `buildDecisionItems()` (já existe) para gerar dados dos gráficos
   - Adiciona dois componentes internos: `PriorityScatterChart` e `ImpactBarChart`
   - Importa e renderiza `SimuladorImpactoModule` na seção inferior

2. **Nenhum outro arquivo é modificado** — rotas, tabs, outras abas, e `ModuleContentRenderer` permanecem intactos.

## Detalhes técnicos

- Recharts já é dependência do projeto (`recharts` usado em `chart.tsx` e outros)
- Os dados para os gráficos vêm de `data.curricular.areas` (mesmo source do módulo atual)
- Scatter plot: cada tema vira `{ name, prevalencia, proficiencia, area, gap, impacto }`
- Barras horizontais: top 10 por `impacto = prevalencia * alunosAfetados * gap`, normalizado 0-100
- Layout responsivo: gráficos em `grid-cols-1 lg:grid-cols-2` no topo, simulador full-width abaixo
- `ReferenceArea` do Recharts para destacar o quadrante de intervenção no scatter

