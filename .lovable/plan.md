
# Plano: Fundo Colorido Sutil com Glassmorphism nos Chips de Matéria

## Problema Atual

O pontinho colorido ao lado do nome da matéria parece um indicador de notificação ou "item novo", causando confusão visual.

```
┌─────────────────────────┐
│ 🧬 Biologia Molecular ● │  ← Pontinho parece notificação
└─────────────────────────┘
```

---

## Solução Proposta

Substituir o pontinho por um fundo sutil com a cor da matéria, aplicando efeito glassmorphism/perolado para uma aparência premium.

```
┌─────────────────────────┐
│ 🧬 Biologia Molecular   │  ← Fundo com tom sutil da cor
│   (fundo rosa claro)    │     + glassmorphism
└─────────────────────────┘
```

---

## Arquivo a Modificar

**`src/components/guia-estudos/SubjectChips.tsx`**

### Mudanças

1. **Remover o pontinho colorido** (linhas 137-142)

2. **Aplicar fundo colorido sutil via inline styles** quando a matéria NÃO está selecionada:

```typescript
{subjects.map((subject, idx) => {
  const isSelected = selectedSubject === subject.name;
  
  // Estilo do fundo colorido sutil (quando não selecionado)
  const subtleColorStyle = !isSelected && subject.color ? {
    backgroundColor: `color-mix(in srgb, ${subject.color} 8%, transparent)`,
    borderColor: `color-mix(in srgb, ${subject.color} 20%, hsl(var(--border)))`,
  } : {};

  return (
    <motion.button
      key={subject.name}
      // ... outras props
      className={cn(
        "shrink-0 snap-start flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl",
        "text-sm font-medium transition-all duration-200",
        "border shadow-sm",
        isSelected
          ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
          : "hover:brightness-105 border-border/50 text-foreground",
        // Glassmorphism sutil quando tem cor
        !isSelected && subject.color && "backdrop-blur-sm"
      )}
      style={subtleColorStyle}
      // ...
    >
      <span className="text-base" style={{ 
        filter: isSelected ? 'brightness(1.2)' : 'none' 
      }}>
        {subject.icon}
      </span>
      <span className="whitespace-nowrap">{subject.name}</span>
      {/* REMOVIDO: pontinho colorido */}
    </motion.button>
  );
})}
```

---

## Efeito Visual Esperado

### Light Mode
- Fundo: Cor da matéria com ~8% de opacidade
- Borda: Cor da matéria com ~20% de opacidade misturada com border padrão
- Efeito perolado: `backdrop-blur-sm` para suavidade

### Dark Mode
- Mesmo efeito, mas `color-mix` adapta naturalmente
- O fundo colorido fica mais evidente em fundos escuros

---

## Comparativo Visual

```
ANTES:
┌────────────────────────────┐
│ 🧬 Biologia Molecular  🔴  │  ← Pontinho confuso
│ 🫀 Anatomia            🔵  │
│ 💊 Farmacologia        🟢  │
└────────────────────────────┘

DEPOIS:
┌────────────────────────────┐
│ 🧬 Biologia Molecular      │  ← Fundo rosa sutil
│ 🫀 Anatomia                │  ← Fundo azul sutil  
│ 💊 Farmacologia            │  ← Fundo verde sutil
└────────────────────────────┘
```

---

## Detalhes Técnicos

| Propriedade | Valor | Motivo |
|-------------|-------|--------|
| `color-mix opacity (bg)` | 8% | Sutil, não compete com texto |
| `color-mix opacity (border)` | 20% | Visível mas não agressivo |
| `backdrop-blur-sm` | 4px blur | Efeito glassmorphism leve |
| `hover:brightness-105` | 5% mais claro | Feedback de hover sutil |

---

## Benefícios

- Remove ambiguidade do pontinho (não parece mais notificação)
- Visual premium e moderno
- Cada matéria tem identidade visual única
- Funciona bem em Light e Dark mode
- Mantém o destaque primário para item selecionado
