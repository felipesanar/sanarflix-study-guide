

## Diagnóstico: Scroll e Interação Quebrados no Mobile

### Causa Raiz

O `ProgressHubMobile` cria um **scroll container interno** (`overflow-y-auto` na div wrapper, linha 219) que conflita com o scroll nativo da página gerenciado pelo `Layout.tsx`. No mobile, o Layout **não** aplica `overflow-auto` ao `<main>` (só no desktop via `md:overflow-auto`), então o scroll depende do scroll nativo do documento (`window.scrollY`).

O problema é duplo:
1. **Scroll preso**: O container interno com `overflow-y-auto` + `min-h-screen` captura todos os eventos de toque, mas não tem altura correta definida (o parent não restringe), criando um scroll fantasma
2. **Interação ruim**: O `touch-pan-y` no container interno compete com os gestos do `AnimatePresence`/`motion.div`, exigindo múltiplos toques para registrar cliques

### Plano de Correção

#### 1. `ProgressHubMobile.tsx` — Remover scroll container interno

- Remover `overflow-y-auto`, `overscroll-y-contain`, `touch-pan-y` da div wrapper
- Remover `min-h-screen` (o Layout já cuida disso)
- Remover `scrollContainerRef` e o `useEffect` que escuta scroll nele
- Trocar para escutar `window.scroll` para o sticky CTA bar
- Manter a estrutura do conteúdo intacta (header, tabs, content)

#### 2. `ProgressHubMobile.tsx` — Sticky tab bar via CSS nativo

- A tab bar já é `sticky top-0` — funciona corretamente com scroll nativo do documento
- Nenhuma mudança necessária na tab bar em si

#### 3. `ProgressHubMobile.tsx` — Sticky CTA via window scroll

- O `useEffect` que controla `showStickyBar` passa a escutar `window.addEventListener('scroll')` em vez de `container.scrollTop`
- Remover o `ref` do container

#### 4. `AgoraTab.tsx` — Melhorar touch no carousel

- Trocar `overflow-x-clip` no container pai por `overflow-x-hidden` (clip pode bloquear eventos de toque em alguns browsers)
- Garantir que os botões de ação têm `min-h-[44px]` (target de toque acessível)

### Resumo de Mudanças

| Arquivo | Mudança |
|---------|---------|
| `ProgressHubMobile.tsx` | Remover scroll container interno, usar window scroll para sticky CTA |
| `AgoraTab.tsx` | Trocar `overflow-x-clip` por `overflow-x-hidden` no carousel |

### Resultado

- Scroll nativo do documento funciona sem conflito
- Toques registram no primeiro toque
- Tab bar fica sticky corretamente
- CTA flutuante aparece/desaparece baseado no scroll real da página

