# Relatório de Auditoria de UI/UX - Calendário de Estudos

**Data:** 04/02/2026
**Status:** Em análise
**Responsável:** Antigravity Agent

---

## 1. Visão Geral

A auditoria foi realizada através de análise estática do código (componentes React + Tailwind) focando em estrutura, consistência visual, acessibilidade e qualidade de UX (microinterações e feedback).

> **Nota Geral:** A base do código é sólida, bem estruturada com separação clara de responsabilidades (`useCalendarSync`, components desktop vs mobile). O visual atual é funcional ("Clean"), mas carece do refinamento "Premium" solicitado (profundidade, glassmorphism, feedback rico).

---

## 2. Lista de Issues e Melhorias

### Prioridade P0 (Crítico / Quebra de UX)
*Nenhum problema funcional crítico (quebra de regra de negócio ou erro de runtime óbvio) foi encontrado na análise estática. O hook `useCalendarSync` implementa corretamente a sincronização otimista.*

### Prioridade P1 (Polish Alto Impacto - UI/UX)

| ID | Local | Descrição | Impacto | Recomendação | Status |
|----|-------|-----------|---------|--------------|--------|
| **P1-01** | `CalendarViewDesktop` | Cards de matérias são "flat", usando apenas cor de fundo com baixa opacidade. A distinção entre eles é fraca no Dark mode. | Visual pouco atrativo, dificuldade de leitura rápida. | Adicionar profundidade, borda sutil (`white/5` ou `black/5`) e leve sombra. Usar gradiente sutil no background do card. | [ ] Pendente |
| **P1-02** | `CalendarEditorDesktop` | Drag & Drop usa API nativa HTML5 com feedback visual padrão do navegador (fantasma opaco). | Sensação de "app antigo", pouco fluido. | Melhorar feedback visual: criar "Ghost Image" customizada ou estilizar melhor o estado de `isDragging` e `DropZone` com animações de escala/cor. | [ ] Pendente |
| **P1-03** | `DropZone` | A zona de drop é apenas um retângulo tracejado básico. | Falta de feedback de "magnetismo" ou intenção. | Adicionar animação de "pulso" quando um item está sendo arrastado por cima. Melhorar o gradiente de fundo. | [ ] Pendente |
| **P1-04** | `CalendarViewMobile` | Lista de eventos é funcional mas simples. | Baixo engajamento visual no mobile. | Adicionar gestos (swipe?) ou ao menos feedback de toque mais "tátil" (scale press). Melhorar separação visual entre itens. | [ ] Pendente |
| **P1-05** | Geral (Dark Mode) | Uso excessivo de cinzas escuros chapados (`bg-zinc-900`) sem variação de superfície. | Sensação de "caixa preta" sem hierarquia de profundidade. | Implementar sistema de elevação com `white/alpha` overlays ou sombras coloridas sutis (glow). | [ ] Pendente |
| **P1-06** | `SubjectBankCard` | Chips de matérias no banco são muito simples. | Parecem botões genéricos. | Adicionar ícone da matéria, indicador de cor mais vibrante e leve efeito de relevo. | [ ] Pendente |

### Prioridade P2 (Refino e Detalhes)

| ID | Local | Descrição | Impacto | Recomendação | Status |
|----|-------|-----------|---------|--------------|--------|
| **P2-01** | Headers (Desktop) | Glassmorphism (`backdrop-blur`) presente mas com border padrão. | Falta de integração "premium" com o fundo. | Ajustar opacidade do border (`border-white/10`) e aumentar o blur para efeito "frosted glass" mais moderno. | [ ] Pendente |
| **P2-02** | `EmptyStates` | Ícones e textos genéricos. | Perda de oportunidade de encantar. | Usar ilustrações ou ícones com mais personalidade (duotone/coloridos). Texto mais convidativo. | [ ] Pendente |
| **P2-03** | Loading Skeleton | Skeletons padrão cinza pulsante. | Funcional, mas básico. | Ajustar cor do skeleton para casar com o tema (mais escuro no dark) e layout exato dos cards finais. | [ ] Pendente |
| **P2-04** | Sombras | Sombras padrão do Tailwind (`shadow-lg`) são pretas/cinzas. | Sujam o visual em fundos coloridos/dark. | Usar "colored shadows" (sombras com a cor da matéria ou do tema primário) com baixíssima opacidade para "glow". | [ ] Pendente |

---

## 3. Plano de Ação (Implementação)

1.  **Fundação Visual Premium:**
    *   Criar classes utilitárias ou aplicar diretamente estilos para `glass-panel` (fundo translúcido + blur + borda sutil).
    *   Definir tokens de sombra "glow" para dark mode.

2.  **Refatoração de Componentes (Visual):**
    *   **Cards (View/Edit):** Aplicar novo estilo visual (profundidade + acento de cor refinado).
    *   **Containers:** Substituir fundos chapados por gradientes sutis ou glassmorphism onde apropriado (Topbars).

3.  **Refinamento de Interação (UX):**
    *   **Drag & Drop:** Melhorar `DropZone` com animações Framer Motion (`animate={{ scale: isActive ? 1.05 : 1 }}`).
    *   **Feedback:** Toast ou indicador visual sutil ao salvar/sincronizar (além do texto "Salvando").

4.  **Consistência Mobile:**
    *   Garantir que a "Bottom Sheet" ou Drawer tenha a mesma linguagem visual do desktop.
    *   Aumentar áreas de toque.

---

## checklist de Validação

- [ ] Light Mode: Contraste e sombras limpas.
- [ ] Dark Mode: Hierarquia por luminosidade (não apenas cinza).
- [ ] Drag & Drop: Claro onde soltar, feedback instantâneo.
- [ ] Responsividade: Layout não quebra em 375px.
- [ ] Performance: Sem lags perceptíveis em animações.
