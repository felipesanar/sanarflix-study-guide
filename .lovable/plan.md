

## Plano: Fase 0 — Fundação da V2 como plataforma multi-módulo

### Objetivo
Transformar a página atual (tela monolítica) em um shell modular com abas internas horizontais, estado global de filtros, e área de conteúdo dinâmica por módulo. O conteúdo existente da v2 vira o módulo "Visão Institucional". Os demais módulos nascem como placeholders com empty states.

### O que muda

**1. Nova estrutura de página (`DesempenhoInstitucionalV2.tsx`)**

A página passa a ter 3 blocos fixos + 1 dinâmico:

```text
┌─────────────────────────────────────────────┐
│ InstitutionalHeader (título + filtros)      │
│ InstitutionalAlertBanner (sanção)           │
│ GlobalFilterBar (IES, simulado, período)    │
├─────────────────────────────────────────────┤
│ Tabs: Visão | Diagnóstico | Alunos |       │
│       Insights | Inteligência               │
├─────────────────────────────────────────────┤
│ ModuleContent (dinâmico por aba ativa)      │
└─────────────────────────────────────────────┘
```

**2. Novos arquivos**

| Arquivo | Propósito |
|---|---|
| `src/components/analytics/v2/shell/InstitutionalHeader.tsx` | Header extraído (título, subtítulo, badge) |
| `src/components/analytics/v2/shell/InstitutionalAlertBanner.tsx` | Alert de sanção extraído |
| `src/components/analytics/v2/shell/GlobalFilterBar.tsx` | Barra de filtros (IES, simulado, período) — mockada |
| `src/components/analytics/v2/shell/PerformanceModuleTabs.tsx` | Abas horizontais com as 5 tabs |
| `src/components/analytics/v2/shell/ModuleEmptyState.tsx` | Placeholder genérico "Em construção" para módulos futuros |
| `src/components/analytics/v2/modules/VisaoInstitucionalModule.tsx` | Conteúdo atual (KPIs, meta, charts) extraído como módulo |
| `src/hooks/useDesempenhoV2State.ts` | Estado global: aba ativa, filtros, contexto de drill-down |
| `src/types/desempenhoV2.ts` | Tipos centralizados do estado global e filtros |

**3. Hook de estado global (`useDesempenhoV2State`)**

Estado mínimo gerenciado num único hook com `useState`:

- `activeTab`: qual módulo está ativo (default: `visao-institucional`)
- `filters`: `{ iesId, simuladoId, periodo, turmas }` — todos mockados
- `setActiveTab` / `setFilters`: setters

Trocar de aba preserva filtros. Trocar filtros não reseta aba.

**4. Módulo "Visão Institucional"**

O conteúdo atual da página (KPIs, Meta, Distância, Distribuição, Evolução) é movido para `VisaoInstitucionalModule.tsx` sem alteração visual. Recebe `filters` como prop (sem uso real ainda).

**5. Módulos placeholder**

Os 4 módulos restantes renderizam `ModuleEmptyState` com ícone, título e descrição contextual:
- Diagnóstico Curricular — "Análise por área, especialidade e tema"
- Visão de Alunos — "Ranking e acompanhamento individual"
- Insights Pedagógicos — "Recomendações baseadas em dados"
- Inteligência Decisória — "Simulação de impacto e priorização"

**6. Skeleton por módulo**

O skeleton da página continua para o loading inicial. Cada módulo terá capacidade de ter loading próprio (o VisaoInstitucionalModule já inclui o timer de 800ms).

### O que NÃO muda

- Nenhum backend, API ou hook existente
- Nenhuma outra página do sistema
- Design system, cores, tipografia
- Rota permanece `/desempenho-institucional-v2`
- Sidebar permanece igual

### Detalhes técnicos

- As abas usam o componente `Tabs/TabsList/TabsTrigger/TabsContent` do shadcn já existente
- O `GlobalFilterBar` renderiza os mesmos `Select` que já existem no header, mas agora em posição dedicada abaixo do alert
- Framer Motion mantido para animações de entrada
- Console logs: `[DesempenhoV2:Shell]`, `[DesempenhoV2:VisaoInstitucional]`, etc.
- Mobile: tabs com scroll horizontal (`overflow-x-auto`), filtros empilhados

### Critérios de aceitação

- Trocar de aba não perde filtros
- Módulo Visão Institucional renderiza exatamente igual ao que está hoje
- Abas restantes mostram empty state claro
- Loading skeleton funciona
- Responsivo em mobile (375px) e desktop
- Zero erros no console

