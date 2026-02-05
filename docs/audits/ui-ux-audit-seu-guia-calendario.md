# Auditoria UI/UX — Seu Guia e Calendário de Estudos

**Data:** 04/02/2026  
**Escopo:** `/guia-estudos` (Seu Guia), modo Lista, modo Calendário (viewer), Editor fullscreen/modal do Calendário (modo premium)  
**Status:** Auditoria concluída — Implementação em andamento

---

## 1. Sumário Executivo

Foi realizada auditoria minuciosa das telas do **Guia de Estudos** ("Seu Guia") e do **Calendário de Estudos** (visualização + editor premium). O mapeamento cobriu: página `StudyGuide.tsx`, componentes em `guia-estudos/` (GuideHeader, GuideToolbar, GuideSearchBar, SubjectChips, TodayStudyCard, SubjectCard, LessonRow, GuideSkeletons, GuideEmptyStates) e componentes em `calendar/` (CalendarViewDesktop, CalendarViewMobile, CalendarEditorDesktop, CalendarEditorMobile, FloatingActionBar, DropZone, DayColumnCard, SubjectBankCard).

**Conclusão:** A base é sólida (hierarquia Semestre → Matéria → Tema → Subtema → Aula preservada, persistência study-progress/calendar_subjects, deep linking, useCalendarSync). Foram identificados **bugs P0** (botão remover no editor mobile desconectado, console.log em produção), **inconsistências P1** (a11y em botões de ícone, navegação por teclado na busca, aria-labels) e **oportunidades P2** (depth/glass sutil, microinterações, contraste texto secundário). As melhorias propostas elevam o "premium feel" sem alterar regras de negócio ou dados.

---

## 2. Checklist por Tela e Modo

### 2.1 Seu Guia (`/guia-estudos`)

| Item | Lista | Calendário | Observação |
|------|--------|------------|------------|
| Header (Guia de Estudos + busca) | ✓ | ✓ | Ok |
| Seletor de semestre | ✓ | ✓ | Select sem aria-label no trigger |
| Busca inteligente | ✓ | N/A | Falta ↑↓ Enter nas sugestões; ícone relógio (histórico) ok |
| Chips de matérias | ✓ (só lista) | — | Overflow com fade ok; falta aria-label "Todas as Matérias" descritivo |
| Toggle Lista/Calendário | ✓ | ✓ | aria-pressed ok; falta aria-label em cada botão |
| Cards de matéria (accordion Tema/Subtema) | ✓ | — | Accordions ok; LessonRow com ações Aula/PDF/Quiz ok |
| Empty states (sem conteúdo, busca vazia) | ✓ | — | GuideEmptyStates usado corretamente |
| Loading skeleton | ✓ | ✓ | GuideSkeletons.Page; risco de CLS se dimensões divergirem |
| Deep link ?materia=&tema=&aula= | ✓ | — | Scroll + highlight implementado |
| TodayStudyCard ("O que estudar hoje") | ✓ | ✓ | Hero + empty state ok |

### 2.2 Calendário — Viewer (modo visualização)

| Item | Desktop | Mobile | Observação |
|------|---------|--------|------------|
| Título "Calendário de Estudos" | ✓ | ✓ | Ok |
| Botão "Editar Agenda" / "Editar" | ✓ | ✓ | Sem aria-label (P1) |
| Navegação por dia | ✓ | ✓ | Tabs/dots ok; aria-label nos dias ok |
| Clique em evento abre Sheet | ✓ | ✓ | Ok |
| Empty state (dia sem matérias) | ✓ | ✓ | Mensagem clara |
| Console.log em produção | ✗ | ✗ | P0: remover |

### 2.3 Calendário — Editor (modo premium fullscreen/modal)

| Item | Desktop | Mobile | Observação |
|------|---------|--------|------------|
| Header (Voltar, Título, Salvar) | ✓ | ✓ | Voltar/Editar Agenda sem aria-label |
| Banco de matérias (drag desktop / drawer mobile) | ✓ | ✓ | SubjectBankCard draggable ok |
| Drag & drop (desktop) / Adicionar (mobile) | ✓ | ✓ | DropZone com feedback ok |
| Remover evento | ✓ | ✗ **BUG** | Mobile: botão do MobileEventCard não chama onRemove — P0 |
| Desfazer / Resetar semana | ✓ | ✓ (só Desfazer) | FloatingActionBar/MobileFooterActions; botões sem aria-label |
| Sync status (Sincronizando.../Salvo) | ✓ | ✓ | Texto ok |
| Skeleton de loading do editor | ✓ | ✓ | Ok |

---

## 3. Issues por Prioridade

### P0 — Bug / UX quebrada / Erros console / A11y crítica

| ID | Local | Passos para reproduzir | Atual | Esperado | Proposta de solução | Status |
|----|--------|------------------------|--------|----------|----------------------|--------|
| **P0-01** | `CalendarEditorMobile.tsx` — `MobileEventCard` | Abrir Guia → Calendário → Editar → adicionar matéria ao dia → tocar no ícone de menu (três linhas) do card. | Nada acontece; botão sem `onClick`. | Ao tocar, remover a matéria do dia. | Conectar `onClick` do `Button` a `(e) => { e.stopPropagation(); onRemove(event.id); }`. | **Implementado** |
| **P0-02** | `CalendarViewDesktop.tsx` (linha ~30) | Abrir /guia-estudos → modo Calendário (desktop). | `console.log('[StudyCalendarView] render desktop', ...)` no console. | Zero logs em produção. | Remover ou envolver em `if (import.meta.env.DEV)`. | **Implementado** |
| **P0-03** | `CalendarViewMobile.tsx` (linha ~39) | Abrir /guia-estudos → modo Calendário (mobile). | `console.log('[StudyCalendarView] render mobile', ...)` no console. | Zero logs em produção. | Remover ou envolver em `if (import.meta.env.DEV)`. | **Implementado** |
| **P0-04** | `CalendarEditorDesktop.tsx` (linhas ~78, 84, 95) | Abrir editor do calendário (desktop) e arrastar/soltar matéria. | Vários `console.log('[StudyCalendarEditor] ...')` no console. | Zero logs em produção. | Remover ou prefixar com `[UIUX-AUDIT]` apenas em DEV. | **Implementado** |
| **P0-05** | `CalendarEditorMobile.tsx` (linha ~69) | Abrir editor do calendário (mobile) e adicionar matéria. | `console.log('[StudyCalendarEditor] Mobile add:', ...)` no console. | Zero logs em produção. | Remover ou usar apenas em DEV. | **Implementado** |

### P1 — Polish alto impacto / Inconsistência evidente / Responsividade

| ID | Local | Passos para reproduzir | Atual | Esperado | Proposta de solução | Status |
|----|--------|------------------------|--------|----------|----------------------|--------|
| **P1-01** | `GuideSearchBar.tsx` | Focar no campo de busca e digitar; abrir dropdown de sugestões. | Não é possível navegar com ↑↓ nem selecionar com Enter. | Navegação por setas e Enter; Esc fecha. | Controlar índice de sugestão com estado; onKeyDown (ArrowDown/ArrowUp/Enter/Escape); scroll into view do item focado. | **Implementado** |
| **P1-02** | `GuideToolbar.tsx` | Toggle Lista/Calendário. | Botões só com `aria-pressed`. | Leitores de tela identificam ação. | `aria-label="Ver como lista"` e `aria-label="Ver como calendário"` nos botões. | **Implementado** |
| **P1-03** | `CalendarViewDesktop.tsx` / `CalendarViewMobile.tsx` | Botão "Editar Agenda" / "Editar". | Botão sem texto acessível para ícone. | `aria-label="Editar calendário"` ou equivalente. | Adicionar `aria-label` ao `Button`. | **Implementado** |
| **P1-04** | `CalendarEditorDesktop.tsx` | Header: botões Voltar e Salvar. | Sem aria-label. | "Voltar ao calendário", "Salvar alterações". | `aria-label` em ambos. | **Implementado** |
| **P1-05** | `CalendarEditorMobile.tsx` | Header: botão voltar e ícone MoreVertical. | Sem aria-label. | "Fechar editor", "Mais opções". | `aria-label` nos dois botões. | **Implementado** |
| **P1-06** | `FloatingActionBar.tsx` | Botões Desfazer e Resetar semana. | Apenas texto visível. | `aria-label` para reforçar ação. | "Desfazer última alteração", "Resetar semana". | **Implementado** |
| **P1-07** | `DayColumnCard.tsx` | Botão de lixeira (remover evento). | Só ícone. | "Remover matéria do dia". | `aria-label="Remover matéria do dia"`. | **Implementado** |
| **P1-08** | `SubjectChips.tsx` | Botões de scroll (ChevronLeft/Right). | `aria-label="Scroll left"` (inglês). | Consistência em PT. | "Rolar chips para a esquerda" / "direita". | **Implementado** |
| **P1-09** | `DropZone.tsx` | Botão "+" (showAddButton) no mobile. | Sem aria-label. | "Adicionar matéria ao dia". | `aria-label` no botão. | **Implementado** |
| **P1-10** | Identidade visual | Cards e bordas em dark. | Mistura `border-border/40`, `dark:border-white/5`. | Padrão único: dark `border-white/10`, light `border-black/5`. | Revisar cards (SubjectCard, TodayStudyCard) e alinhar tokens. | **Implementado** (SubjectCard, TodayStudyCard) |
| **P1-11** | Responsividade | Touch targets no mobile. | Alguns botões/áreas < 44px. | Áreas de toque ≥ 44px. | Ajustar min-height/min-width ou padding em SubjectChips, LessonRow. | **Implementado** |

### P2 — Refinamento fino / Microinterações / Premium feel

| ID | Local | Descrição | Proposta | Status |
|----|--------|-----------|----------|--------|
| **P2-01** | Cards (SubjectCard, TodayStudyCard, Calendar) | Aspecto "flat". | Borda premium (`border-white/10` dark, `border-black/5` light) aplicada em SubjectCard e TodayStudyCard. | **Parcial** (bordas; sombras/glow deixadas para iteração futura) |
| **P2-02** | Topbars (header editor, toolbar) | Glass leve. | `backdrop-blur` já presente nos headers; sem alteração. | Não implementado (já existente) |
| **P2-03** | Contraste dark | Texto secundário (muted-foreground). | Garantir AA; depende do design system global. | Não implementado |
| **P2-04** | Transição Lista ↔ Calendário | AnimatePresence já usado. | Evitar layout shift; manter duração 200–250ms. | Já adequado |
| **P2-05** | Skeleton → conteúdo | GuideSkeletons.Page. | Dimensões próximas ao layout final para evitar CLS. | Não implementado |

---

## 4. Smoke Tests Manuais (Checklist)

- [ ] Carregamento inicial (loading → conteúdo)
- [ ] Busca + sugestões + seleção
- [ ] Troca de semestre
- [ ] Filtro por matéria (chips)
- [ ] Expandir tema/subtema (accordion)
- [ ] Marcar aula concluída
- [ ] Deep linking `?materia=`, `?tema=`, `?aula=` (scroll + highlight)
- [ ] Toggle Lista ↔ Calendário
- [ ] Calendário Viewer: clique em evento abre Sheet
- [ ] Editor: drag/drop, remover (desktop e mobile), undo/reset, salvar, syncing
- [ ] Dark/Light
- [ ] Mobile / Tablet / Desktop
- [ ] Console: zero erros e zero warnings críticos

---

## 5. Regras de Negócio e Persistência (Não Modificadas)

- Hierarquia: Semestre → Matéria → Tema → Subtema → Aula  
- Persistência: `study-progress` (localStorage), `calendar_subjects` (Supabase), `get-study-contents` (edge function)  
- `useCalendarSync`, geração de horários (8h–20h), estrutura `{ name, dayOfWeek, startTime, endTime, color }`  
- Deep linking: `?materia=`, `?tema=`, `?aula=` (scroll/highlight)  
- Autenticação, billing/premium gating, Home/Meu Dia fora do escopo (exceto ajustes visuais localizados)

---

## 6. Histórico de Status (atualização pós-implementação)

**Data da implementação:** 04/02/2026

| Issue | Status final | Motivo (se não implementado) |
|-------|--------------|------------------------------|
| P0-01 a P0-05 | Implementado | Bug remover no mobile corrigido; console.log removidos. |
| P1-01 a P1-11 | Implementado | Busca com ↑↓ Enter Esc; aria-labels em toolbar, calendário, editor, FloatingActionBar, DayColumnCard, SubjectChips, DropZone; Select semestre com aria-label; bordas padronizadas; touch targets ≥ 44px em chips e LessonRow. |
| P2-01 | Parcial | Bordas premium em SubjectCard e TodayStudyCard. |
| P2-02 a P2-05 | Não implementado / Já adequado | P2-04 já ok; P2-03 e P2-05 deixados para iteração futura. |
