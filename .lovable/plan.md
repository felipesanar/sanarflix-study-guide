
# Plano: Melhorar Responsividade do WelcomeCard e Botão "Continuar Estudos"

## Problema

Na imagem enviada, o botão "Continuar estudos" aparece cortado em telas de tamanho intermediário (~900-1000px). Isso ocorre devido a uma combinação de fatores:

| Problema | Causa | Local |
|----------|-------|-------|
| Botão cortado | Grid 1.5fr + 1fr comprime demais o card | `Home.tsx` linha 124 |
| Flexbox não quebra | `lg:flex-row` só ativa em ≥1024px | `WelcomeCard.tsx` linha 108 |
| Botão não adapta | `whitespace-nowrap` impede quebra | `Button` component |
| Texto longo | "Continuar estudos" é largo para espaço limitado | `WelcomeCard.tsx` |

---

## Solução Proposta

### Mudança 1: Ajustar proporções do grid na Home (tablet)

**Arquivo:** `src/pages/Home.tsx`

Alterar o grid do tablet layout para dar mais espaço ao WelcomeCard:

```tsx
// Antes (linha 124)
<div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-5">

// Depois - Aumentar proporção do WelcomeCard
<div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-4 md:gap-5">
```

### Mudança 2: Tornar o layout do WelcomeCard mais adaptativo

**Arquivo:** `src/components/home/WelcomeCard.tsx`

Aplicar as seguintes melhorias:

#### 2a. Breakpoint intermediário para flex-row
```tsx
// Antes (linha 108)
<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-5 lg:gap-8">

// Depois - Adicionar breakpoint xl para flex-row, manter coluna em telas menores
<div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 sm:gap-5 xl:gap-8">
```

#### 2b. Botão adaptativo que quebra em duas linhas se necessário
```tsx
// Antes (linha 160-167)
<Button 
  onClick={handleContinueStudy}
  size="lg"
  className="relative group h-10 sm:h-11 md:h-12 px-4 sm:px-5 md:px-6 rounded-lg sm:rounded-xl bg-gradient-to-r from-primary/90 to-primary/80 hover:from-primary hover:to-primary/90 text-primary-foreground font-medium shadow-md hover:shadow-lg transition-all duration-300 text-xs sm:text-sm md:text-base"
>
  <span>Continuar estudos</span>
  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform duration-200" />
</Button>

// Depois - Botão com largura responsiva e whitespace normal em telas pequenas
<Button 
  onClick={handleContinueStudy}
  size="lg"
  className="relative group h-auto min-h-[2.5rem] sm:min-h-[2.75rem] md:min-h-[3rem] px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-primary/90 to-primary/80 hover:from-primary hover:to-primary/90 text-primary-foreground font-medium shadow-md hover:shadow-lg transition-all duration-300 text-xs sm:text-sm md:text-base w-full sm:w-auto"
>
  <span className="whitespace-normal sm:whitespace-nowrap">Continuar estudos</span>
  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 group-hover:translate-x-1 transition-transform duration-200" />
</Button>
```

#### 2c. Container do botão com alinhamento adequado
```tsx
// Antes (linha 146-150)
<motion.div 
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ delay: 0.3, duration: 0.4 }}
  className="flex-shrink-0"
>

// Depois - Largura total em mobile/tablet, auto em desktop grande
<motion.div 
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ delay: 0.3, duration: 0.4 }}
  className="flex-shrink-0 w-full sm:w-auto"
>
```

---

## Comportamento Esperado por Breakpoint

| Breakpoint | Largura | Layout | Botão |
|------------|---------|--------|-------|
| xs-sm | < 640px | Coluna, botão full-width | Largura 100%, pode quebrar texto |
| sm-md | 640-768px | Coluna, botão auto-width | Largura auto, texto inline |
| md-lg | 768-1024px | Grid 2 cols, WelcomeCard em coluna | Largura auto, alinhado à esquerda |
| lg-xl | 1024-1280px | Grid 2 cols, WelcomeCard em coluna | Largura auto, alinhado à esquerda |
| xl+ | ≥ 1280px | Grid 2 cols, flex-row dentro do card | Botão alinhado à direita |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Home.tsx` | Ajustar proporções do grid tablet |
| `src/components/home/WelcomeCard.tsx` | Flexbox responsivo + botão adaptativo |

---

## Resultado Visual

- **Mobile**: Botão ocupa largura total, fácil de tocar
- **Tablet/Desktop pequeno**: Botão com largura automática, alinhado à esquerda abaixo do nome
- **Desktop grande (xl+)**: Botão ao lado direito do conteúdo textual (layout atual do desktop)

Isso garante que o botão "Continuar estudos" nunca seja cortado, mantendo a estética premium.
