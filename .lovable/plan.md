
# Plano: Corrigir Responsividade do ProgressHeroCard

## Problema Identificado

Na screenshot, o card Hero está cortado à direita, com o botão "Organizar" truncado. O layout flex atual não está quebrando corretamente em telas intermediárias.

### Análise do Código Atual (linha 183):

```tsx
<div className="flex-1 flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-4 lg:items-end xl:items-center lg:justify-end">
```

**Problemas:**
1. `sm:flex-row` força elementos lado a lado muito cedo (640px+)
2. Botões com texto longo não cabem no espaço
3. O container `flex-1` tenta ocupar todo espaço restante mas não quebra linha
4. Os botões têm `size="lg"` que ocupa muito espaço horizontal

## Solução Proposta

### Mudanças no `ProgressHeroCard.tsx`:

#### 1. Layout Principal (linha 85)
```tsx
// ANTES
<div className="flex flex-col lg:flex-row lg:items-center gap-6">

// DEPOIS - Permitir wrap quando necessário
<div className="flex flex-col lg:flex-row lg:items-center gap-4 sm:gap-6">
```

#### 2. Container Direito - Streak + CTAs (linha 183)
```tsx
// ANTES
<div className="flex-1 flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-4 lg:items-end xl:items-center lg:justify-end">

// DEPOIS - Permitir flex-wrap e melhor distribuição
<div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 lg:flex-1 lg:justify-end">
```

#### 3. Container dos Botões (linhas 215-250)
```tsx
// ANTES
<motion.div className="flex flex-col sm:flex-row gap-2">

// DEPOIS - Sempre wrap e usar sm:flex-nowrap apenas em telas maiores
<motion.div className="flex flex-col xs:flex-row flex-wrap gap-2 w-full sm:w-auto">
```

#### 4. Botões - Reduzir size e melhorar texto responsivo (linhas 223-249)
```tsx
// ANTES
<Button size="lg" className="gap-2 ...">
  <span className="hidden sm:inline">Continuar de onde parei</span>
  <span className="sm:hidden">Continuar</span>
</Button>

// DEPOIS - Usar size default e texto mais curto em telas médias
<Button 
  size="default" 
  className="gap-2 flex-1 sm:flex-initial min-w-[140px] justify-center ..."
>
  <Play className="h-4 w-4 shrink-0" />
  <span className="hidden md:inline">Continuar de onde parei</span>
  <span className="md:hidden">Continuar</span>
</Button>

<Button 
  variant="outline"
  size="default"
  className="gap-2 flex-1 sm:flex-initial min-w-[120px] justify-center ..."
>
  <Calendar className="h-4 w-4 shrink-0" />
  <span className="hidden md:inline">Organizar semana</span>
  <span className="md:hidden">Organizar</span>
</Button>
```

#### 5. Streak Mini Card - Garantir que não estica demais (linhas 185-212)
```tsx
// ANTES
<motion.div className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">

// DEPOIS - Limitar largura e shrink
<motion.div className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3 shrink-0 w-full sm:w-auto">
```

## Layout Visual Esperado

### Desktop (>1024px):
```text
┌──────────────────────────────────────────────────────────────────┐
│ ┌──────┐  ⚡ Acelerando           ○○○○○●●  4/5 dias              │
│ │ 12%  │  15 de 124 aulas        ┌────────────────┐ ┌──────────┐ │
│ │concl.│  6 matérias • 29 temas  │▶ Continuar ... │ │📅Organiz.│ │
│ └──────┘                         └────────────────┘ └──────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Tablet (768-1024px):
```text
┌───────────────────────────────────────────────────┐
│ ┌──────┐  ⚡ Acelerando                           │
│ │ 12%  │  15 de 124 aulas                        │
│ │concl.│  6 matérias • 29 temas                  │
│ └──────┘                                          │
│ ┌─────────────────────────────────────────────────┤
│ │ ○○○○○●● 4/5 dias                               │
│ │ ┌─────────────────┐  ┌──────────────────────┐  │
│ │ │ ▶ Continuar     │  │ 📅 Organizar         │  │
│ │ └─────────────────┘  └──────────────────────┘  │
│ └─────────────────────────────────────────────────┤
└───────────────────────────────────────────────────┘
```

### Mobile (<768px):
```text
┌────────────────────────────┐
│ ┌──────┐  ⚡ Acelerando    │
│ │ 12%  │  15 de 124 aulas │
│ │concl.│  6 mat. • 29 tem │
│ └──────┘                   │
│                            │
│ ○○○○○●● 4/5 dias          │
│                            │
│ ┌────────────────────────┐ │
│ │    ▶ Continuar         │ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │    📅 Organizar        │ │
│ └────────────────────────┘ │
└────────────────────────────┘
```

## Arquivo a Modificar

| Arquivo | Linhas | Mudança |
|---------|--------|---------|
| `src/components/progress-hub/ProgressHeroCard.tsx` | 85 | Ajustar gap responsivo |
| | 183 | Adicionar flex-wrap e melhor distribuição |
| | 186 | Streak card com largura controlada |
| | 216 | Container CTAs com wrap |
| | 223-235 | Botão "Continuar" menor e responsivo |
| | 236-249 | Botão "Organizar" menor e responsivo |

## Resultado Esperado

- ✅ Botões nunca são cortados em nenhum breakpoint
- ✅ Texto se adapta (curto em telas médias, completo em grandes)
- ✅ Layout quebra linha quando necessário
- ✅ Streak card não força overflow horizontal
- ✅ Experiência consistente em todos os tamanhos de tela
