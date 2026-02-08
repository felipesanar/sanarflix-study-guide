

# Plano: Condensar DiagnosticsCard para Encaixar no Grid

## Problema

O card de Diagnóstico está ocupando ~280px de altura, e quando somado ao ConsistencyCard (~200px), ultrapassa a altura do NextActionsCard (~380px). A diferença é de ~100px que precisam ser economizados.

## Análise do Layout Atual

```text
NextActionsCard (~380px)     ConsistencyCard + DiagnosticsCard
┌────────────────────────┐   ┌────────────────────────────────┐
│ Header                 │   │ ConsistencyCard (~200px)       │
│                        │   │ - Header + dots + progress     │
│ Action 1               │   │ - Status message + streak      │
│ - 2 badges, text       │   ├────────────────────────────────┤
│ - 3 buttons            │   │ DiagnosticsCard (~280px) ❌    │
│                        │   │ - Header                       │
│ Action 2               │   │ - Item 1 (p-3, 2 linhas)       │
│ - 2 badges, text       │   │ - Item 2 (p-3, 2 linhas)       │
│ - 3 buttons            │   │ - Item 3 (p-3, 2 linhas)       │
│                        │   │                                │
│ Action 3               │   └────────────────────────────────┘
│ - 2 badges, text       │   
│ - 3 buttons            │   Meta: ~480px combinados → ~380px
└────────────────────────┘
```

## Estratégia de Condensação

Economizar ~100px no DiagnosticsCard através de:

1. **Header mais compacto**: `pb-2` ao invés de `pb-3`
2. **Padding interno menor**: `p-2` ao invés de `p-3` nos items
3. **Layout em linha única**: Título, descrição e badge na mesma linha
4. **Ícones menores**: `h-3.5 w-3.5` e wrapper `p-1.5`
5. **Espaçamento entre items reduzido**: `space-y-2` ao invés de `space-y-3`
6. **Remover CardContent padding extra**: `pt-0` otimizado

## Design Compacto Proposto

```text
┌──────────────────────────────────────────────────────┐
│ ⊕ Diagnóstico                                        │
├──────────────────────────────────────────────────────┤
│ ⚠ MAIOR BACKLOG  Embriologia e Genét... 52 pend   > │
│ ⏱ PRECISA ATENÇÃO Apresentação do cu... 999 dias  > │
│ 🏆 QUASE LÁ!     Ciências sociais, sa... 75%     > │
└──────────────────────────────────────────────────────┘
```

Cada item condensado em uma única linha:
- Ícone (compact) | Título (uppercase, 9px) | Descrição (truncada) | Badge (inline) | Chevron

## Mudanças Técnicas em `DiagnosticsCard.tsx`

### 1. Header mais compacto (linha 170-175)
```tsx
// ANTES
<CardHeader className="pb-3">
  <CardTitle className="flex items-center gap-2 text-lg">

// DEPOIS
<CardHeader className="pb-2">
  <CardTitle className="flex items-center gap-2 text-base">
```

### 2. CardContent com menos espaço (linha 176)
```tsx
// ANTES
<CardContent className="space-y-3">

// DEPOIS  
<CardContent className="space-y-2">
```

### 3. Item container compacto (linhas 185-189)
```tsx
// ANTES
className={cn(
  "group flex items-start gap-3 p-3 rounded-lg",
  ...
)}

// DEPOIS
className={cn(
  "group flex items-center gap-2 p-2 rounded-lg",
  ...
)}
```

### 4. Wrapper do ícone menor (linhas 196-204)
```tsx
// ANTES
<div className={cn("p-2 rounded-lg shrink-0", ...)}>
  <Icon className={cn("h-4 w-4", insight.iconColor)} />
</div>

// DEPOIS
<div className={cn("p-1.5 rounded-md shrink-0", ...)}>
  <Icon className={cn("h-3.5 w-3.5", insight.iconColor)} />
</div>
```

### 5. Título e descrição em layout inline (linhas 205-217)
```tsx
// ANTES: Layout empilhado com 2 linhas
<div className="flex-1 min-w-0">
  <div className="flex items-center justify-between gap-2">
    <p className="text-xs font-medium ...uppercase">{insight.title}</p>
    <Badge ...>{insight.value} {insight.unit}</Badge>
  </div>
  <p className="font-medium text-sm truncate mt-0.5">{insight.description}</p>
</div>

// DEPOIS: Layout horizontal em 1 linha
<div className="flex-1 min-w-0 flex items-center gap-2">
  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
    {insight.title}
  </p>
  <p className="font-medium text-xs truncate flex-1">
    {insight.description}
  </p>
  <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
    {insight.value} {insight.unit}
  </span>
</div>
```

### 6. Chevron menor e alinhado (linha 218)
```tsx
// ANTES
<ChevronRight className="h-4 w-4 ... shrink-0 mt-1" />

// DEPOIS
<ChevronRight className="h-3.5 w-3.5 ... shrink-0" />
```

### 7. Empty state mais compacto (linhas 153-161)
```tsx
// ANTES: py-6, w-12 h-12, mb-3
// DEPOIS: py-4, w-10 h-10, mb-2

<div className="flex flex-col items-center justify-center py-4 text-center">
  <div className="w-10 h-10 rounded-full ... flex items-center justify-center mb-2">
    <Trophy className="h-5 w-5 text-emerald-500" />
  </div>
  <p className="font-medium text-sm text-foreground">Tudo em dia!</p>
  <p className="text-xs text-muted-foreground">Continue no ritmo</p>
</div>
```

## Comparativo de Economia

| Elemento | Antes | Depois | Economia |
|----------|-------|--------|----------|
| Header padding | pb-3 (12px) | pb-2 (8px) | 4px |
| Title size | text-lg | text-base | ~2px |
| Items gap | space-y-3 (12px×2) | space-y-2 (8px×2) | 8px |
| Item padding | p-3 (12px×2) | p-2 (8px×2) | 8px por item × 3 = 24px |
| Item layout | 2 linhas | 1 linha | ~20px por item × 3 = 60px |
| Icon wrapper | p-2 + h-4 | p-1.5 + h-3.5 | ~4px |

**Total estimado: ~100px economizados**

## Resultado Esperado

```text
ConsistencyCard (~200px) + DiagnosticsCard (~170px) = ~370px
NextActionsCard (~380px)

✅ Grid alinhado verticalmente
```

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/progress-hub/DiagnosticsCard.tsx` | Aplicar layout compacto conforme descrito |

