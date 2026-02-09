
# Plano de Melhoria Visual — Header e Navbar Mobile (Dark Mode)

## Problema Identificado

No modo escuro (dark mode) do mobile, tanto o **MobileHeader** quanto a **MobileBottomNav** utilizam fundos escuros opacos que:

1. **Reduzem a sensação de tela maior** — o fundo escuro cria barreiras visuais
2. **Header sempre com glassmorphism** — deveria ser transparente até o usuário rolar a página
3. **Navbar muito opaca** — `bg-background/90` no dark resulta em preto sólido, bloqueando visualmente o conteúdo

---

## Solução Proposta

### 1. Header Dinâmico (Transparente → Glassmorphism)

O header mobile deve seguir o mesmo padrão já implementado no desktop:
- **Sem scroll**: totalmente transparente, sem borda
- **Com scroll (>10px)**: ativa glassmorphism sutil + borda leve

```typescript
// MobileHeader.tsx - Receber prop hasScrolled
interface MobileHeaderProps {
  hasScrolled: boolean;
}

<header className={`sticky top-0 z-30 h-14 flex items-center justify-between px-4 md:hidden transition-all duration-300 ${
  hasScrolled 
    ? 'bg-background/60 backdrop-blur-lg border-b border-border/20' 
    : 'bg-transparent border-b border-transparent'
}`}>
```

### 2. Navbar com Glassmorphism Sutil

Reduzir opacidade do fundo e adicionar transparência especial para dark mode:

```typescript
// MobileBottomNav.tsx - Background mais sutil
<div className="absolute inset-0 
  bg-background/70 backdrop-blur-xl 
  dark:bg-background/50 dark:backdrop-blur-2xl
  border-t border-border/30 dark:border-white/5
  shadow-lg dark:shadow-none" 
/>
```

**Mudanças específicas:**
- Light: `bg-background/70` (era 90%)
- Dark: `bg-background/50` (mais transparente)
- Border: `border-white/5` no dark (sutil, quase invisível)
- Blur: `backdrop-blur-2xl` no dark (mais blur compensa transparência)

### 3. Ajustar CSS Variables (Dark Mode)

O dark mode tem `--background: 0 0% 0%` (preto puro). Isso é bom para o fundo geral, mas com transparência aplicada, precisamos garantir que o blur funcione bem:

**Nenhuma mudança necessária no CSS** — a solução é usar classes condicionais `dark:` no Tailwind.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/Layout.tsx` | Passar `hasScrolled` para MobileHeader |
| `src/components/navigation/MobileHeader.tsx` | Receber prop e aplicar estilos condicionais |
| `src/components/navigation/MobileBottomNav.tsx` | Reduzir opacidade, adicionar variantes dark |

---

## Detalhamento Técnico

### Layout.tsx (linha 66)

```typescript
// Passar hasScrolled para o MobileHeader
{!isModoProva && <MobileHeader hasScrolled={hasScrolled} />}
```

### MobileHeader.tsx (linhas 19, 38-39)

```typescript
// Interface com prop
interface MobileHeaderProps {
  hasScrolled?: boolean;
}

export function MobileHeader({ hasScrolled = false }: MobileHeaderProps) {
  // ...
  
  return (
    <header className={`sticky top-0 z-30 h-14 flex items-center justify-between px-4 md:hidden transition-all duration-300 ${
      hasScrolled 
        ? 'bg-background/60 dark:bg-background/40 backdrop-blur-lg border-b border-border/20 dark:border-white/10' 
        : 'bg-transparent border-b border-transparent'
    }`}>
```

### MobileBottomNav.tsx (linha 197)

```typescript
// Background mais transparente e sutil
<div className="absolute inset-0 
  bg-background/70 dark:bg-background/40 
  backdrop-blur-xl dark:backdrop-blur-2xl 
  border-t border-border/30 dark:border-white/[0.06]
  shadow-lg dark:shadow-none" 
/>
```

---

## Comparação Visual

### Antes (Dark Mode)
```
┌──────────────────────────────┐
│ ███ HEADER OPACO ESCURO ███ │ ← Barreira visual
├──────────────────────────────┤
│                              │
│      Conteúdo da página      │
│                              │
├──────────────────────────────┤
│ ███ NAVBAR OPACA ESCURA ███ │ ← Barreira visual
└──────────────────────────────┘
```

### Depois (Dark Mode)
```
┌──────────────────────────────┐
│     (transparente)           │ ← Header some no topo
├──────────────────────────────┤
│                              │
│      Conteúdo da página      │
│       (visualmente maior)    │
│                              │
├──────────────────────────────┤
│ ░░░░ navbar translúcida ░░░░ │ ← Vê conteúdo por baixo
└──────────────────────────────┘
```

---

## Especificações de Transparência

| Elemento | Light Mode | Dark Mode |
|----------|------------|-----------|
| Header (sem scroll) | `transparent` | `transparent` |
| Header (com scroll) | `bg-background/60` | `bg-background/40` |
| Navbar | `bg-background/70` | `bg-background/40` |
| Blur header | `backdrop-blur-lg` | `backdrop-blur-lg` |
| Blur navbar | `backdrop-blur-xl` | `backdrop-blur-2xl` |
| Border header | `border-border/20` | `border-white/10` |
| Border navbar | `border-border/30` | `border-white/[0.06]` |

---

## Checklist de Validação

- [ ] Header transparente quando no topo da página
- [ ] Header com glassmorphism sutil ao rolar
- [ ] Transição suave (300ms) entre estados do header
- [ ] Navbar com fundo translúcido no dark mode
- [ ] Conteúdo visível "por baixo" da navbar (blur effect)
- [ ] Bordas quase invisíveis no dark mode
- [ ] Sensação de tela maior e mais fluida
- [ ] Light mode mantém boa legibilidade
- [ ] Zero erros no console
