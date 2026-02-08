
# Plano de Evolução Premium da Central de Progresso

## ✅ Status: Implementado

### Componentes Criados
- `FiltersDesktop.tsx` — Filtros inline premium para desktop com Combobox de busca
- `DiagnosticsCard.tsx` — Insights objetivos (maior backlog, tema negligenciado, vitória rápida)
- `CoverageRankingCard.tsx` — Ranking menos/mais estudado com barras de progresso
- `WeekDetailSheet.tsx` — Detalhes ao clicar no gráfico semanal

### Componentes Refinados
- `FiltersDrawerMobile.tsx` — Adicionado filtro por Tema + Ordenação + Contador
- `FilterChips.tsx` — Suporte a Tema e Ordenação
- `WeeklyEvolutionCard.tsx` — Toggle count/% + clique para drill-down
- `Dashboard.tsx` — Novo layout com cards de diagnóstico e cobertura

### Tipos Atualizados
- `ProgressFilters`: Adicionado `tema: string | null` e `sortBy: SortOption`
- `SortOption`: `'alphabetical' | 'backlog' | 'percentage' | 'inactive'`

---

1. **Arquitetura de componentes** — bem separados, cada um com responsabilidade clara
2. **Hero Card** — visual premium com círculo de progresso animado
3. **Mapa do Semestre** — drill-down hierárquico matéria→tema→subtema
4. **Busca no Mapa** — `SemesterMapSearch` já funcional
5. **Consistency Card** — visual dos dias da semana
6. **Weekly Evolution Chart** — Area chart limpo
7. **Risk Alerts** — sistema de alertas para temas inativos
8. **Spaced Revision** — sugestões de revisão inteligentes
9. **Pre-Prova Mode** — funcionalidade diferenciada
10. **Acessibilidade** — já tem aria-labels, focus states, sr-only
11. **Animações** — Framer Motion com `shouldReduceMotion`

### O Que Está Faltando (Evoluir)

| Gap | Impacto | Prioridade |
|-----|---------|------------|
| Filtros desktop não tem Select com busca | Fricção para IES com muitas matérias | P1 |
| Filtros não incluem Tema (dependente de matéria) | Granularidade limitada | P1 |
| Sem ordenação (ex: mais atrasados primeiro) | Difícil priorizar ação | P1 |
| Sem indicador de "X itens filtrados" | Feedback incompleto | P2 |
| Gráficos não são clicáveis (drill-down) | Oportunidade perdida | P1 |
| Sem bloco "Menos vs Mais" / Diagnóstico | Insight objetivos ausentes | P1 |
| Sem alternância de visualização no gráfico (% vs count) | Flexibilidade limitada | P2 |
| FilterChips sem contagem de resultados | Feedback incompleto | P2 |
| Desktop usa mesmo `FiltersDrawerMobile` | UX subótima no desktop | P2 |

---

## Fase 1 — O Que Permanece vs O Que Será Refinado

### Permanece (sem mudanças estruturais)
- `ProgressHeroCard` — apenas micro-refinamentos
- `ConsistencyCard` — manter como está
- `WeeklyEvolutionCard` — adicionar toggle de visualização
- `RiskAlertBanner` — manter
- `SpacedRevisionCard` — manter
- `PreProvaMode` — manter
- `ExamCountdownCard` — manter
- `TemaItem` — manter

### Será Refinado
- **Filtros Desktop** — novo componente `FiltersDesktop` com Select/Combobox
- **Filtros Mobile** — evoluir `FiltersDrawerMobile` para incluir Tema
- **SemesterMapCard** — adicionar contador de resultados + integração com gráficos
- **Novo Bloco: DiagnosticsCard** — insights objetivos
- **Novo Bloco: CoverageRankingCard** — ranking menos/mais estudado
- **WeeklyEvolutionCard** — toggle % acumulado vs contagem

---

## Fase 2 — Upgrade dos Filtros

### A) Filtros Desktop — Novo Componente `FiltersDesktop`

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ [🔍 Matéria ▾] [📚 Tema ▾] [Status ▾] [Ordenar ▾] [Limpar]            │
│                                                                         │
│ Chips ativos: [Anatomia ✕] [Pendentes ✕]  ──  48 de 120 itens          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Comportamento:**
- **Matéria**: Combobox com busca (Radix Command/Popover)
- **Tema**: Dependente da matéria selecionada (disabled se nenhuma matéria)
- **Status**: Todos | Pendentes | Concluídos
- **Ordenar**: Alfabético | Maior backlog | Menor % | Mais atrasado
- **Chips ativos**: Removíveis individualmente
- **Contador**: "X de Y itens" (muda ao filtrar)

**Estados:**
- Loading durante recálculo (opacity 50% + spinner discreto)
- Transição suave ao aplicar (fade 200ms)
- Tema resetado se matéria mudar

### B) Filtros Mobile — Evoluir `FiltersDrawerMobile`

**Adicionar seções:**
1. Status (manter)
2. Matéria (manter)
3. **Novo: Tema** (aparece após selecionar matéria)
4. **Novo: Ordenação** (chips inline)

**Melhorias:**
- Badge no botão com contagem de filtros ativos (já existe)
- Preview de contagem no Drawer: "Mostrando X itens"
- Animação ao aplicar (fechar com slide + update suave)

### C) Tipos Atualizados

```typescript
export interface ProgressFilters {
  status: 'all' | 'pending' | 'completed';
  materia: string | null;
  tema: string | null; // NOVO
  sortBy: 'alphabetical' | 'backlog' | 'percentage' | 'inactive'; // NOVO
}
```

---

## Fase 3 — Granularidade: Drill-Down de Gráficos

### A) Clique no Gráfico de Evolução Semanal

Ao clicar em uma barra/ponto do `WeeklyEvolutionCard`:
- Abre Sheet/Drawer "Detalhes da Semana X"
- Lista aulas concluídas naquela semana
- CTA: "Ver todas as aulas" (navega para Guia filtrado)

**Implementação:**
- Adicionar `onClick` ao `<Area>` do Recharts
- Novo componente `WeekDetailSheet`

### B) Toggle de Visualização no Gráfico

Adicionar toggle no header do `WeeklyEvolutionCard`:
- "Aulas" (contagem absoluta) — padrão
- "Progresso" (% acumulado)

```typescript
const [viewMode, setViewMode] = useState<'count' | 'percentage'>('count');
```

---

## Fase 4 — Novo Bloco: DiagnosticsCard

**Objetivo:** Responder "onde eu devo focar?" de forma objetiva.

### UI Proposta

```text
┌─────────────────────────────────────────────────┐
│ 🔍 Diagnóstico Rápido                          │
├─────────────────────────────────────────────────┤
│ ⚠️ Maior backlog                               │
│    Anatomia • 45 aulas pendentes               │
│    [Ver pendências →]                          │
│─────────────────────────────────────────────────│
│ 🔴 Tema mais negligenciado                     │
│    Sistema Cardiovascular • 23 dias sem atividade│
│    [Retomar →]                                 │
│─────────────────────────────────────────────────│
│ 📊 Matéria mais avançada                       │
│    Farmacologia • 92% concluído                │
│    [Finalizar →]                               │
└─────────────────────────────────────────────────┘
```

### Dados (calculados no frontend a partir de `data`)

```typescript
interface DiagnosticInsight {
  type: 'backlog' | 'neglected' | 'advanced' | 'quick_win';
  title: string;
  description: string;
  materia: string;
  tema?: string;
  value: number; // aulas pendentes, dias inativos, ou %
  cta: string;
}

const insights = useMemo(() => {
  const results: DiagnosticInsight[] = [];
  
  // Maior backlog (matéria com mais pendências)
  const maxBacklog = data.by_materia
    .map(m => ({ ...m, pending: m.total - m.completed }))
    .sort((a, b) => b.pending - a.pending)[0];
  
  if (maxBacklog && maxBacklog.pending > 5) {
    results.push({
      type: 'backlog',
      title: 'Maior backlog',
      description: `${maxBacklog.pending} aulas pendentes`,
      materia: maxBacklog.materia,
      value: maxBacklog.pending,
      cta: 'Ver pendências'
    });
  }
  
  // Tema mais negligenciado (maior days_inactive com < 80%)
  const neglected = data.by_tema
    .filter(t => t.days_inactive && t.days_inactive > 7 && t.percentage < 80)
    .sort((a, b) => (b.days_inactive || 0) - (a.days_inactive || 0))[0];
  
  // Matéria mais avançada (para incentivar finalizar)
  const advanced = data.by_materia
    .filter(m => m.percentage >= 70 && m.percentage < 100)
    .sort((a, b) => b.percentage - a.percentage)[0];
  
  return results;
}, [data]);
```

### Arquivo Novo

- `src/components/progress-hub/DiagnosticsCard.tsx`

---

## Fase 5 — Novo Bloco: CoverageRankingCard

**Objetivo:** Responder "o que estou vendo menos vs mais?"

### UI Proposta

```text
┌─────────────────────────────────────────────────┐
│ 📊 Sua Cobertura                               │
│                                                │
│ ┌─ Menos estudado ────────────────────────────┐│
│ │ 1. Neurologia        ▓▓░░░░░░░░░░ 18%      ││
│ │ 2. Psiquiatria       ▓▓▓░░░░░░░░░ 25%      ││
│ │ 3. Dermatologia      ▓▓▓▓░░░░░░░░ 32%      ││
│ └─────────────────────────────────────────────┘│
│                                                │
│ ┌─ Mais avançado ─────────────────────────────┐│
│ │ 1. Farmacologia      ▓▓▓▓▓▓▓▓▓▓░░ 92%      ││
│ │ 2. Anatomia          ▓▓▓▓▓▓▓▓▓░░░ 85%      ││
│ │ 3. Fisiologia        ▓▓▓▓▓▓▓▓░░░░ 78%      ││
│ └─────────────────────────────────────────────┘│
│                                                │
│ [Focar no menos estudado →]                    │
└─────────────────────────────────────────────────┘
```

### Dados

```typescript
const leastStudied = useMemo(() => 
  data.by_materia
    .filter(m => m.percentage < 50)
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 3),
  [data.by_materia]
);

const mostAdvanced = useMemo(() =>
  data.by_materia
    .filter(m => m.percentage >= 50)
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3),
  [data.by_materia]
);
```

### Arquivo Novo

- `src/components/progress-hub/CoverageRankingCard.tsx`

---

## Fase 6 — Ajustes nos Gráficos Existentes

### WeeklyEvolutionCard

| Mudança | Descrição |
|---------|-----------|
| Toggle view | Botão "Aulas / %" no header |
| Clique na barra | Abre Sheet com detalhes da semana |
| Tooltip melhorado | Mostrar data completa + contexto |
| Empty state | Já existe, manter |

### Recharts Clicável

```typescript
<Area
  type="monotone"
  dataKey="count"
  onClick={(data) => handleWeekClick(data.payload)}
  style={{ cursor: 'pointer' }}
  // ...
/>
```

---

## Fase 7 — Mudanças Técnicas

### Arquivos a Criar

| Arquivo | Propósito |
|---------|-----------|
| `src/components/progress-hub/FiltersDesktop.tsx` | Filtros inline para desktop |
| `src/components/progress-hub/DiagnosticsCard.tsx` | Insights objetivos |
| `src/components/progress-hub/CoverageRankingCard.tsx` | Ranking menos/mais |
| `src/components/progress-hub/WeekDetailSheet.tsx` | Detalhes ao clicar no gráfico |

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Dashboard.tsx` | Adicionar novos cards, filtros desktop, lógica de ordenação |
| `src/components/progress-hub/FiltersDrawerMobile.tsx` | Adicionar Tema + Ordenação |
| `src/components/progress-hub/FilterChips.tsx` | Adicionar Tema chip + contador |
| `src/components/progress-hub/WeeklyEvolutionCard.tsx` | Toggle view + onClick |
| `src/types/progressHub.ts` | Atualizar `ProgressFilters` |
| `src/components/progress-hub/index.ts` | Exportar novos componentes |

### Performance

- Todos os cálculos de insights ficam em `useMemo` (já padrão)
- Nenhuma mudança necessária no Edge Function
- Cache SWR mantido (15 min TTL)

---

## Fase 8 — Layout Atualizado

### Desktop (1280+)

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Header: Central de Progresso • IES • Semestre                       │
├─────────────────────────────────────────────────────────────────────┤
│ [Risk Alert Banner - se houver]                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Hero Card (100% width)                                              │
├────────────────────────────┬───────────────────┬────────────────────┤
│ NextActionsCard            │ ConsistencyCard   │ DiagnosticsCard    │
│ (1/3)                      │ (1/3)             │ (1/3) — NOVO       │
├────────────────────────────┼───────────────────┼────────────────────┤
│ WeeklyEvolutionCard        │ CoverageRankingCard│ SpacedRevision    │
│ (1/3)                      │ (1/3) — NOVO      │ (1/3)              │
├────────────────────────────┴───────────────────┴────────────────────┤
│ Filtros Desktop + Contador + Chips                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Mapa do Semestre (SemesterMapCard)                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Mobile

```text
┌─────────────────────────────┐
│ Header                      │
├─────────────────────────────┤
│ Risk Alert (se houver)      │
├─────────────────────────────┤
│ Hero Card                   │
├─────────────────────────────┤
│ NextActionsCard             │
├─────────────────────────────┤
│ ConsistencyCard             │
├─────────────────────────────┤
│ DiagnosticsCard — NOVO      │
├─────────────────────────────┤
│ WeeklyEvolutionCard         │
├─────────────────────────────┤
│ CoverageRankingCard — NOVO  │
├─────────────────────────────┤
│ SpacedRevisionCard          │
├─────────────────────────────┤
│ [Filtros] + Chips ativos    │
├─────────────────────────────┤
│ Mapa do Semestre            │
└─────────────────────────────┘
```

---

## Fase 9 — Checklist de QA

### Responsividade
- [ ] 360px — todos os cards em coluna única, sem overflow-x
- [ ] 768px — grids 2 colunas
- [ ] 1024px — grids 2-3 colunas
- [ ] 1280px+ — layout completo 3 colunas

### Acessibilidade
- [ ] Todos os novos componentes com aria-labels
- [ ] Focus states em todos elementos interativos
- [ ] Navegação por teclado nos filtros e cards
- [ ] Gráficos com resumo sr-only

### Light/Dark Mode
- [ ] DiagnosticsCard legível em ambos temas
- [ ] CoverageRankingCard barras com contraste adequado
- [ ] Filtros com cores consistentes

### Deep Links
- [ ] CTAs dos novos cards navegam corretamente para `/guia-estudos?...`
- [ ] Parâmetros de filtro preservados na URL

### Performance
- [ ] Nenhum re-render desnecessário (React DevTools)
- [ ] useMemo em todos os cálculos de insights
- [ ] Sem layout shift ao carregar

### Regressões
- [ ] Mapa do Semestre continua expandindo/colapsando
- [ ] Busca no mapa funciona
- [ ] Marcar tema como concluído funciona
- [ ] Risk Alerts dispensáveis
- [ ] Pre-Prova mode funciona via URL

---

## Resumo de Entregáveis

1. **4 novos componentes**: `FiltersDesktop`, `DiagnosticsCard`, `CoverageRankingCard`, `WeekDetailSheet`
2. **5 componentes refinados**: `FiltersDrawerMobile`, `FilterChips`, `WeeklyEvolutionCard`, `Dashboard`, `index.ts`
3. **1 tipo atualizado**: `ProgressFilters`
4. **0 mudanças no backend** — todos os dados necessários já existem

---

## Critérios de Aceitação

- [ ] Filtros desktop com Combobox funcional e bonito
- [ ] Filtros mobile incluem Tema dependente de Matéria
- [ ] Ordenação disponível (backlog, %, inatividade)
- [ ] Contador "X de Y itens" visível
- [ ] DiagnosticsCard mostra 2-3 insights objetivos com CTAs
- [ ] CoverageRankingCard mostra ranking menos/mais estudado
- [ ] Gráfico semanal tem toggle count/% e é clicável
- [ ] Todos os CTAs navegam corretamente com deep links
- [ ] Zero overflow em mobile
- [ ] Light/Dark impecável
- [ ] Performance suave (sem jank)
