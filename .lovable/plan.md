

# Plano: Esconder Barra de Scroll na Lista de Matérias (Mobile)

## Problema Atual

Na screenshot, a lista de matérias está correta mas mostra a barra de scroll. O usuário quer manter a funcionalidade de scroll mas sem a barra visível.

## Solução

Substituir o `ScrollArea` (Radix) por um div nativo com CSS para esconder a scrollbar em todos os browsers.

### Mudança no `ExamMateriaStepMobile.tsx`

**Linhas 89-176** - Trocar ScrollArea por div com scroll nativo invisível:

```tsx
// ANTES:
<ScrollArea className="flex-1 min-h-0 -mx-4 px-4">
  <div className="flex flex-col gap-2 py-2">
    {/* matérias... */}
  </div>
</ScrollArea>

// DEPOIS:
<div 
  className="flex-1 min-h-0 -mx-4 px-4 overflow-y-auto"
  style={{
    scrollbarWidth: 'none', // Firefox
    msOverflowStyle: 'none', // IE/Edge
  }}
>
  <style>{`
    .hide-scrollbar::-webkit-scrollbar {
      display: none; /* Chrome, Safari, Opera */
    }
  `}</style>
  <div className="flex flex-col gap-2 py-2 hide-scrollbar">
    {/* matérias... */}
  </div>
</div>
```

### Alternativa mais limpa com CSS-in-className

Usar classes Tailwind com CSS custom para esconder scrollbar:

```tsx
<div 
  className={cn(
    "flex-1 min-h-0 -mx-4 px-4 overflow-y-auto",
    "[&::-webkit-scrollbar]:hidden", // Chrome/Safari
    "[-ms-overflow-style:none]",     // IE/Edge
    "[scrollbar-width:none]"          // Firefox
  )}
>
  <div className="flex flex-col gap-2 py-2">
    {/* matérias... */}
  </div>
</div>
```

## Detalhes Técnicos

| Propriedade | Browser | Efeito |
|-------------|---------|--------|
| `scrollbar-width: none` | Firefox | Esconde scrollbar |
| `-ms-overflow-style: none` | IE/Edge legacy | Esconde scrollbar |
| `::-webkit-scrollbar { display: none }` | Chrome, Safari, Opera | Esconde scrollbar |

## Resultado Esperado

- ✅ Lista de matérias mantém scroll funcional por touch/swipe
- ✅ Scrollbar completamente invisível
- ✅ Cross-browser compatibility
- ✅ Experiência mobile mais limpa e premium

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/progress-hub/ExamMateriaStepMobile.tsx` | Linha 89: Substituir `ScrollArea` por div com classes para esconder scrollbar |

