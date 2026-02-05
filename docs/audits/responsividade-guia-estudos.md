# Auditoria de Responsividade — Guia de Estudos (/guia-estudos)

**Data:** 04/02/2026  
**Escopo:** Rota `/guia-estudos` (Seu Guia), Layout (Sidebar + Header + Main), componentes da página  
**Status:** Auditoria concluída — Implementação P0/P1 aplicada (Layout + StudyGuide)

---

## 1. Sumário Executivo

Foi realizada auditoria de responsividade na tela **Guia de Estudos** ("Seu Guia"), incluindo o shell **Layout** (SidebarProvider → AppSidebar + SidebarInset → header + main) e o conteúdo da página StudyGuide (header da página, busca, toolbar, chips, lista/calendário).

**Causas raiz identificadas:**  
1) **Flex sem `min-w-0`:** SidebarInset e `main` no Layout são flex children com `min-width: auto` (padrão), impedindo que a área de conteúdo encolha abaixo do tamanho do conteúdo e gerando scroll horizontal quando o conteúdo interno (chips, grid, cards) tem largura mínima efetiva.  
2) **Z-index:** Header no Layout usa `z-50` e a Sidebar usa `z-40`, fazendo o header desenhar por cima da sidebar em certos contextos; o requisito é que a sidebar não fique “atrás” do header.  
3) **Conteúdo da página:** A página StudyGuide não define `min-w-0` no container raiz; chips e grids em linha podem contribuir para largura mínima maior que o viewport quando a cadeia de flex não encolhe.

**Correções propostas:** Adicionar `min-w-0` em SidebarInset e em `main` no Layout; garantir `min-w-0` no wrapper raiz da página StudyGuide; rebaixar z-index do header para abaixo da sidebar (ex.: `z-30`) para que a sidebar fique acima; opcionalmente `overflow-x-clip` no shell após correção da causa raiz.

---

## 2. Checklist por Breakpoint

| Breakpoint | Scroll horizontal? | Conteúdo atrás da sidebar? | Header sobre sidebar? | Observação |
|------------|--------------------|----------------------------|----------------------|------------|
| 375px      | A verificar        | N/A (sidebar overlay)     | N/A                  | Main sem min-w-0 pode estourar com chips/cards |
| 768px      | A verificar        | Possível (main flex)      | Possível (z-50 > z-40)| Sidebar fixa; main precisa min-w-0 |
| 1024px     | A verificar        | Possível                  | Possível             | Idem |
| 1280+      | A verificar        | Possível                  | Possível             | Idem |

---

## 3. Issues por Prioridade

### P0 — Overflow horizontal / Conteúdo atrás da sidebar / Header sobre sidebar

| ID   | Local | Passos para reproduzir | Atual | Esperado | Causa raiz | Solução proposta | Status |
|------|--------|------------------------|--------|----------|------------|-------------------|--------|
| P0-01 | `Layout.tsx` — SidebarInset | Abrir /guia-estudos com sidebar visível (desktop). Reduzir viewport ou usar conteúdo largo (muitos chips). | Scroll horizontal; conteúdo pode “vazar” para a direita. | Sem scroll horizontal; conteúdo confinado à área main. | SidebarInset é flex child com `flex-1` mas sem `min-w-0`; `min-width: auto` impede encolher abaixo do conteúdo. | Adicionar `min-w-0` ao `className` do SidebarInset em Layout. | **Implementado** |
| P0-02 | `Layout.tsx` — main | Idem. | Main pode crescer com o conteúdo e gerar overflow. | Main limita largura ao espaço disponível e faz scroll apenas vertical. | main é flex child com `flex-1` e sem `min-w-0`. | Adicionar `min-w-0` ao `<main>`. | **Implementado** |
| P0-03 | `Layout.tsx` — header | Desktop com sidebar aberta; comparar camadas. | Header (z-50) desenha por cima da sidebar (z-40). | Sidebar não fica atrás do header (sidebar à frente quando aplicável). | Header com z-50 e sidebar com z-40. | Reduzir z-index do header para abaixo da sidebar (ex.: z-30). | **Implementado** |
| P0-04 | `StudyGuide.tsx` — container raiz | Abrir /guia-estudos; muitos chips ou cards largos. | Container da página pode forçar largura mínima e contribuir para overflow. | Página respeita largura do main. | Div raiz da página sem `min-w-0` em contexto flex. | Adicionar `min-w-0` e `w-full` ao wrapper principal da página (div que envolve o conteúdo). | **Implementado** |

### P1 — Responsividade refinada

| ID   | Local | Descrição | Solução | Status |
|------|--------|-----------|---------|--------|
| P1-01 | Layout / Main | Garantir que main tenha overflow-x contido após correção. | Usar `overflow-x-clip` ou `overflow-x-hidden` no main apenas como proteção final após P0. | **Implementado** (overflow-x-clip em SidebarInset e main) |
| P1-02 | SubjectChips | Chips em linha com overflow-x-auto; garantir que o container não estoure o pai. | Pai (StudyGuide) com min-w-0; container de chips já usa overflow-x-auto. | **Implementado** (min-w-0 na página) |

### P2 — Polimento

| ID   | Local | Descrição | Status |
|------|--------|-----------|--------|
| P2-01 | Transição Lista ↔ Calendário | Evitar layout shift momentâneo que possa gerar overflow. | Não implementado |

---

## 4. Smoke Tests Manuais (Checklist)

- [ ] Desktop com sidebar aberta: sem conteúdo atrás da sidebar; header não sobrepõe sidebar.
- [ ] 375px / 768px / 1024px / 1280px: sem scroll horizontal.
- [ ] Toggle Lista ↔ Calendário: sem overflow momentâneo.
- [ ] Chips e accordions: não “vazam” largura (scroll interno nos chips é aceitável).
- [ ] Validação: `document.documentElement.scrollWidth === document.documentElement.clientWidth` após carregar a página.

---

## 5. Regras de Negócio (Não Modificadas)

- Hierarquia, persistências, rotas, autenticação e premium gating permanecem inalterados.
- Apenas layout (CSS/Tailwind) e estrutura de shell (min-w-0, z-index, overflow) foram alterados.

---

## 6. Histórico de Status (pós-implementação)

**Data da implementação:** 04/02/2026

| Issue  | Status final | Motivo (se não implementado) |
|--------|--------------|------------------------------|
| P0-01  | Implementado | SidebarInset com `min-w-0`, `overflow-x-clip`; header com `shrink-0`. |
| P0-02  | Implementado | main com `min-w-0`, `overflow-x-clip`. |
| P0-03  | Implementado | Header z-index alterado de z-50 para z-30 (sidebar permanece z-40). |
| P0-04  | Implementado | StudyGuide: wrapper raiz com `min-w-0 w-full overflow-x-clip`; container interno com `min-w-0`. |
| P1-01  | Implementado | overflow-x-clip aplicado em SidebarInset e main. |
| P1-02  | Implementado | Cadeia min-w-0 na página garante que chips não estourem o pai. |
