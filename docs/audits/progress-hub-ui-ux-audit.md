# Auditoria UI/UX — Central de Progresso

**Data**: 2026-02-08  
**Versão**: 1.0  
**Status**: Completo

---

## 1. INTERACTION MAP (Mapa de Interações)

### A) Navegação e Contexto

| Interação | Estado Inicial | Ação | Resposta Visual | Resposta de Dados | Estados Alternativos | Fallback |
|-----------|---------------|------|-----------------|-------------------|---------------------|----------|
| Entrar na página (com cache) | Cache válido no localStorage | Navigate | Conteúdo imediato, syncing spinner | Background fetch + merge | Cache expirado → skeleton | Mostrar cache mesmo se stale |
| Entrar na página (sem cache) | Nenhum dado | Navigate | Skeleton animado | Fetch inicial | Erro de rede | Error state com retry |
| Voltar da página (history) | Página anterior | Voltar | Transição fade | Cache preservado | Cache invalidado | Refetch silencioso |
| Abrir via URL params | URL com ?mode=preprova | Navigate | Ativar modo pré-prova | Filtrar checklist | Param inválido | Ignorar param |
| Navegar para Guia (deep link) | Card/tema/gráfico | Click | Transição + loading | Params na URL | Link quebrado | Toast de erro |
| Retorno do Guia | Progresso atualizado | Navigate | Atualizar contadores | SWR revalidate | Race condition | Debounce revalidation |

### B) Filtros

| Interação | Estado Inicial | Ação | Resposta Visual | Resposta de Dados | Acessibilidade |
|-----------|---------------|------|-----------------|-------------------|----------------|
| Abrir filtro (desktop) | Botão Filtros | Click | Drawer abre com animação | Carregar opções | aria-expanded |
| Abrir filtro (mobile) | Botão Filtros | Tap | Drawer bottom sheet | Carregar opções | Focus trap |
| Selecionar status | Nenhum selecionado | Click | Highlight + check | Atualizar tempFilters | aria-pressed |
| Selecionar matéria | Todas selecionadas | Click | Highlight + check | Atualizar tempFilters | aria-pressed |
| Aplicar filtros | Mudanças pendentes | Click | Fechar drawer + chips | Filtrar data | Botão disabled se sem mudanças |
| Limpar filtros | Filtros ativos | Click | Remover chips | Reset filteredData | aria-label descritivo |
| Estado "sem resultados" | Filtros aplicados | Auto | EmptyState card | Nenhum dado | role="status" |

### C) Ações Primárias

| Interação | Estado Inicial | Ação | Resposta Visual | Resposta de Dados | Desfazer | Analytics |
|-----------|---------------|------|-----------------|-------------------|----------|-----------|
| "Continuar de onde parei" | Hero card | Click | Navegar | Buscar lastActivity | N/A | navigate_to_guide_from_hub |
| "Organizar minha semana" | Hero card | Click | Navegar para calendar | N/A | N/A | calendar_edit_from_hub |
| "Próximo passo" (ver) | NextActionsCard | Click | Deep link para Guia | N/A | N/A | click_next_action |
| "Assistir" (vídeo) | NextActionsCard | Click | Abrir nova aba | N/A | N/A | click_next_action |
| "PDF" | NextActionsCard | Click | Abrir nova aba | N/A | N/A | click_next_action |
| "Quiz" | NextActionsCard | Click | Abrir nova aba | N/A | N/A | click_next_action |
| Marcar tema concluído | TemaItem/Botão | Click | Optimistic update | RPC complete_theme | Toast com Desfazer (8s) | mark_theme_complete |
| Desfazer conclusão | Toast action | Click | Reverter UI | RPC uncomplete_theme | N/A | N/A |
| Alterar meta semanal | Popover slider | Drag/Click | Atualizar número | Local state + cache | N/A | streak_goal_changed |

### D) Cards e Listas

| Componente | Interações | Estados |
|------------|-----------|---------|
| ProgressHeroCard | Continue, Calendar | Normal, syncing |
| NextActionsCard | Ver, Assistir, PDF, Quiz | Normal, empty, loading |
| ConsistencyCard | Ajustar meta | Normal, goal met, goal pending |
| WeeklyEvolutionCard | Hover tooltip no gráfico | Normal, empty (sem dados) |
| SemesterMapCard | Expand/collapse matéria, busca, complete | Normal, filtered, empty, syncing |
| TemaItem | Expand, Ver, Concluir | Normal, complete, syncing |
| RiskAlertBanner | Estudar, Dispensar | Visible, dismissed |
| SpacedRevisionCard | Revisar | Normal, empty |
| ExamCountdownCard | Definir data | Normal, no date, counting |
| PreProvaMode | Toggle, Expand, Check, Estudar | Inactive, active, expanded |

### E) Gráficos

| Interação | Estado Inicial | Ação | Resposta Visual | Fallback |
|-----------|---------------|------|-----------------|----------|
| Hover em ponto | Gráfico normal | Hover | Tooltip com valor | Touch: tap |
| Estado sem dados | Sem evolução | Auto | EmptyState com emoji | CTA para começar |
| Responsividade | Desktop | Resize | Reflow suave | Labels truncados |

### F) Scroll e Layout

| Interação | Comportamento Esperado | Status Atual |
|-----------|----------------------|--------------|
| Scroll geral | Smooth scroll | ✅ OK |
| Sticky header | Não implementado | ⚠️ Avaliar necessidade |
| Scroll chips | Horizontal scroll | ✅ OK |
| Overflow-x | Zero overflow | ✅ OK com min-w-0 |
| Layout shift | Minimizado | ✅ OK com skeletons |

### G) Estados Críticos

| Estado | Trigger | Resposta Visual | Resposta de Dados |
|--------|---------|-----------------|-------------------|
| Sem acesso (sem IES) | User sem id_ies | Redirect ou empty | N/A |
| Erro de rede | Fetch falha | Error state + retry | Cache stale |
| Loading inicial | Sem cache | ProgressHubSkeleton | Fetch em andamento |
| Syncing | Após ação | Spinner no header | Background update |
| Offline | navigator.onLine false | Toast warning | Cache local |

---

## 2. LISTA DE PROBLEMAS

### P0 — Críticos (Quebra/Bug)
Nenhum encontrado.

### P1 — Fricção Grande

| ID | Problema | Arquivo | Impacto | Solução |
|----|----------|---------|---------|---------|
| P1-01 | Cards sem hover/press states consistentes | Vários | Usuário não sabe que é clicável | Adicionar hover scale + shadow + cursor |
| P1-02 | Skeleton não tem shimmer premium | ProgressHubSkeleton.tsx | Parecer genérico | Adicionar gradient shimmer animado |
| P1-03 | Botões de ação em TemaItem muito pequenos no mobile | TemaItem.tsx | Dificuldade de toque | Aumentar para min 44px |
| P1-04 | Falta loading state no botão "Concluir" | TemaItem.tsx | Usuário não sabe se clicou | Adicionar spinner durante syncing |

### P2 — Qualidade

| ID | Problema | Arquivo | Impacto | Solução |
|----|----------|---------|---------|---------|
| P2-01 | Transições entre estados sem motion | Vários | Experiência abrupta | Adicionar AnimatePresence |
| P2-02 | Tooltips faltando em ícones | Vários | Usuário não entende ícones | Adicionar Tooltip wrapper |
| P2-03 | Dark mode com contraste baixo em badges | Vários | Legibilidade | Ajustar cores dark |
| P2-04 | Falta feedback visual ao marcar conclusão | TemaItem.tsx | Ação não celebrada | Micro-animation de check |
| P2-05 | Cards não têm sombra consistente | Vários | Visual flat | Padronizar shadow-sm |
| P2-06 | Gráfico sem fallback textual | WeeklyEvolutionCard.tsx | Acessibilidade | Adicionar sr-only summary |
| P2-07 | Falta indicador de "hoje" no calendário visual | ConsistencyCard.tsx | Contexto temporal | Highlight mais visível |

### P3 — Polimento

| ID | Problema | Arquivo | Impacto | Solução |
|----|----------|---------|---------|---------|
| P3-01 | Emoji em estados vazios pode parecer juvenil | Vários | Tom profissional | Usar ícones Lucide |
| P3-02 | Stagger animation muito lento | Dashboard.tsx | Delay perceptível | Reduzir para 0.05s |
| P3-03 | Falta progress indicator no auto-close do milestone | MilestoneCelebration.tsx | Urgência de fechar | Já implementado ✅ |
| P3-04 | Search input sem ícone de clear | SemesterMapSearch.tsx | Friccão ao limpar | Adicionar X button |

---

## 3. PLANO DE ELEVAÇÃO UX/UI

### Prioridade 1 — Hover/Press States Premium

**Antes**: Cards com `hover:bg-muted/50` básico  
**Depois**: Cards com `hover:shadow-md hover:scale-[1.01] active:scale-[0.99]` + transition suave

**Critérios de aceitação**:
- Todos os cards interativos têm hover com elevação
- Press state com scale down sutil
- Transição de 200ms ease-out
- Respeita prefers-reduced-motion

### Prioridade 2 — Loading States Premium

**Antes**: Spinner básico ou nada  
**Depois**: Skeleton shimmer + inline spinners + optimistic UI

**Critérios de aceitação**:
- Skeleton com gradient shimmer animado
- Botão "Concluir" mostra spinner durante ação
- Optimistic update com revert visual se erro

### Prioridade 3 — Micro-celebrações

**Antes**: Toast simples ao concluir  
**Depois**: Check animation + counter increment + confetti sutil

**Critérios de aceitação**:
- Ícone de check anima ao marcar
- Contador de progresso incrementa visualmente
- Desfazer aparece com timer visual

### Prioridade 4 — Acessibilidade

**Antes**: Alguns aria-labels  
**Depois**: Navegação completa por teclado + screen reader friendly

**Critérios de aceitação**:
- Tab order lógico
- Focus visible em todos os interativos
- aria-live para updates dinâmicos
- Screen reader summary para gráficos

---

## 4. CHECKLIST DE QA

### Responsividade
- [ ] 360px (mobile small)
- [ ] 390px (iPhone 14)
- [ ] 430px (iPhone 14 Pro Max)
- [ ] 768px (tablet portrait)
- [ ] 1024px (tablet landscape)
- [ ] 1280px (laptop)
- [ ] 1440px (desktop)

### Teclado
- [ ] Tab navega todos os interativos
- [ ] Enter/Space ativa botões
- [ ] Escape fecha modals/drawers
- [ ] Arrow keys em sliders

### Dark Mode
- [ ] Contraste adequado em todos os badges
- [ ] Sombras visíveis
- [ ] Gradients não "somem"

### Performance
- [ ] Sem layout shift visível
- [ ] Animações a 60fps
- [ ] Re-renders minimizados (React DevTools)

### Regressão
- [ ] Deep links funcionam
- [ ] Filtros persistem corretamente
- [ ] Milestone celebrations disparam
- [ ] Desfazer funciona

---

## 5. EVENTOS DE ANALYTICS

| Evento | Categoria | Trigger | Dados |
|--------|-----------|---------|-------|
| progress_hub_view | navigation | Page load | percentage, streak, status_level |
| progress_hub_first_view | navigation | First visit (0%) | same |
| click_next_action | interaction | Click em ação | action_type, content_type, materia |
| mark_theme_complete | interaction | Concluir tema | materia, tema, aulas_count |
| navigate_to_guide_from_hub | navigation | Deep link | source, materia, tema |
| filter_applied | interaction | Aplicar filtro | filter_type, filter_value |
| streak_goal_changed | interaction | Alterar meta | old_goal, new_goal |
| milestone_achieved | interaction | Cruzar threshold | milestone, materia |
| preprova_mode_activated | interaction | Ativar modo | N/A |

---

## 6. IMPLEMENTAÇÕES REALIZADAS

### 6.1 Premium Hover States
- Cards com hover:shadow-md + hover:border-primary/30
- Scale micro-animation (1.01 hover, 0.99 active)
- Transições de 200ms ease-out

### 6.2 Skeleton Premium
- Gradient shimmer animado via CSS keyframes
- Skeleton pulse suave

### 6.3 Botões com Loading State
- Spinner inline no botão "Concluir"
- Disabled durante syncing

### 6.4 Touch Targets
- Botões mínimos de 44px no mobile
- Gap adequado entre ações

### 6.5 Acessibilidade
- Focus visible rings
- aria-labels descritivos
- Keyboard navigation completa
