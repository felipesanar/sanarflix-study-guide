
# Plano: Unificar Cards do Calendário (Priorizar Estilo Dark Mode)

## Problema Identificado

Os cards no editor de calendário têm layouts completamente diferentes dependendo do tema:

| Aspecto | Modo Escuro (isCompact) | Modo Claro (!isCompact) |
|---------|-------------------------|--------------------------|
| Título | Fonte responsiva, break-words | Fonte fixa, sem responsividade |
| Categoria | Texto colorido pequeno | Badge pill separada |
| Texto extra | Não tem | "Estudo programado para esta matéria." |
| Padding | p-2.5 (compacto) | p-4 (maior) |
| Animação | x: -10 (lateral) | y: 10 (vertical) |

A lógica atual em `CalendarEditorDesktop.tsx` (linha 335):
```typescript
isCompact={variant === 'dark'}
```

Isso força cards expandidos no modo claro, causando a inconsistência visual.

---

## Solução Proposta

### Abordagem: Usar cards compactos em AMBOS os modos

O estilo compacto (dark mode) é superior porque:
- Layout mais limpo e moderno
- Tipografia responsiva com `clamp()`
- Categoria exibida de forma elegante (texto colorido ao invés de badge)
- Ocupa menos espaço vertical
- Não tem texto genérico desnecessário

### Mudança 1: `CalendarEditorDesktop.tsx`

Alterar linha 335 para sempre usar `isCompact={true}`:

```typescript
// Antes
isCompact={variant === 'dark'}

// Depois
isCompact={true}
```

### Mudança 2 (Opcional): Limpeza de código legado

Remover o bloco de código "full card" em `DayColumnCard.tsx` (linhas 84-130) que não será mais usado, mantendo apenas o layout compacto.

---

## Resultado Esperado

- Cards idênticos em ambos os modos (dark e light)
- Visual limpo e moderno em todas as variantes
- Títulos responsivos com break-words e tipografia fluida
- Categoria exibida como texto colorido (não badge)
- Sem texto "Estudo programado para esta matéria."

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/calendar/CalendarEditorDesktop.tsx` | Mudar `isCompact={variant === 'dark'}` para `isCompact={true}` |
| `src/components/calendar/DayColumnCard.tsx` | (Opcional) Remover bloco de código não utilizado |
