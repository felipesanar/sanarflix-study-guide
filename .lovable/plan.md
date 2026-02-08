

# Plano: Trocar Ícone do Card "O que fazer agora"

## Objetivo

Substituir o ícone `Sparkles` (estrelas) por um ícone que transmita melhor a ideia de "orientação" ou "o que fazer?" - algo como uma pessoa pensando ou um ponto de interrogação.

## Opções de Ícones do Lucide

| Ícone | Nome | Descrição |
|-------|------|-----------|
| 🤔 | `CircleHelp` | Círculo com ponto de interrogação |
| 💡 | `Lightbulb` | Lâmpada (ideia/sugestão) |
| 🧭 | `Compass` | Bússola (direção/orientação) |
| 👤❓ | `UserRoundQuestion` | Bonequinho com ponto de interrogação |
| 🎯 | `Target` | Alvo (foco/objetivo) - já usado no Diagnóstico |
| ❓ | `HelpCircle` | Círculo de ajuda |

## Recomendação

**`CircleHelp`** - É um círculo com ponto de interrogação que transmite bem a ideia de "o que fazer agora?". Alternativamente, **`Lightbulb`** transmite a ideia de sugestão/dica.

## Mudança em `NextActionsCard.tsx`

### 1. Atualizar import (linha 4-7)

```tsx
// ANTES
import { 
  Play, FileText, ListChecks, Sparkles, 
  Zap, Rocket, ChevronRight, Clock 
} from 'lucide-react';

// DEPOIS
import { 
  Play, FileText, ListChecks, CircleHelp, 
  Zap, Rocket, ChevronRight, Clock 
} from 'lucide-react';
```

### 2. Trocar no header principal (linha 94)

```tsx
// ANTES
<Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />

// DEPOIS
<CircleHelp className="h-5 w-5 text-primary" aria-hidden="true" />
```

### 3. Trocar no empty state (linha 51)

```tsx
// ANTES
<Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />

// DEPOIS
<CircleHelp className="h-5 w-5 text-primary" aria-hidden="true" />
```

## Resultado Visual

O card passará a ter um ícone de "?" que combina melhor com a pergunta "O que fazer agora?", transmitindo a ideia de orientação e sugestão.

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/progress-hub/NextActionsCard.tsx` | Trocar `Sparkles` por `CircleHelp` no import e nos 2 locais de uso |

