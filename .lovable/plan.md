
# Plano: Experiência Mobile Premium para Adicionar Prova

## Diagnóstico do Problema Atual

### Problemas Identificados no Mobile

| Problema | Descrição | Impacto UX |
|----------|-----------|------------|
| **Dialog não é nativo mobile** | Usa `Dialog` (Radix) que centraliza na tela. No mobile, modais centrados são ruins | Padrece "app desktop no celular" |
| **Calendário pequeno** | Células de 40x40px são apertadas para dedos (mínimo recomendado: 44px) | Difícil tocar nas datas |
| **Sem gesture de swipe** | Usuário não pode deslizar para voltar ou fechar | Não se sente nativo |
| **Altura fixa 500px** | `min-h-[500px]` pode ser maior que a tela de alguns celulares | Scroll desnecessário ou corte |
| **Chips pequenos** | Chips de matéria com `min-w-[140px]` ficam apertados em telas < 375px | Texto truncado, toque difícil |
| **Sem haptic feedback** | Nenhuma vibração ao selecionar data/matéria | Experiência "morta" |
| **Botão fechar pequeno** | Botão X de 32x32px no canto superior | Difícil de alcançar |

### Análise Técnica

O projeto já tem:
- `vaul` (Drawer) instalado - perfeito para bottom sheets nativos mobile
- `useIsMobile()` hook funcionando - para detectar contexto
- Componentes `SubjectDrawerMobile` e padrões de drawer já implementados em outras partes

---

## Proposta: Drawer Bottom Sheet para Mobile

### Princípio: "Mobile-First Native Feel"

```text
DESKTOP:                           MOBILE:
┌───────────────────────┐         ╭───────────────────────────╮
│                       │         │  ──────  (drag handle)    │
│   ┌─────────────┐     │         │                           │
│   │   Dialog    │     │         │  📅 Quando será sua prova?│
│   │  Centered   │     │         │                           │
│   └─────────────┘     │         │   [  Calendário GRANDE  ] │
│                       │         │   [  (scroll interno)   ] │
└───────────────────────┘         │                           │
                                  │        [Próximo →]        │
                                  ╰───────────────────────────╯
                                        ↑ Desliza de baixo
```

---

## Design Mobile: Bottom Sheet Full-Height

### Step 1: Calendário (Mobile)

```text
╭───────────────────────────────────────────────╮
│  ──────────────────────  (drag handle)        │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │   📅                                    │  │
│  │   Quando será sua prova?                │  │
│  │   Selecione a data no calendário        │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │                                         │  │
│  │         ◄  Fevereiro 2026  ►            │  │
│  │                                         │  │
│  │    Do   Se   Te   Qu   Qu   Se   Sa     │  │
│  │                               1         │  │
│  │     2    3    4    5    6    7    8     │  │
│  │     9   10   11   12   13   14   15     │  │
│  │    16   17   18   19   20   21   22     │  │
│  │    23   24  [25]  26   27   28          │  │
│  │                                         │  │
│  │    (Células 48x48px para touch)         │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│    ┌─────────────────────────────────────┐    │
│    │  📅 25 de fevereiro • em 17 dias    │    │
│    └─────────────────────────────────────┘    │
│                                               │
│  ╔═════════════════════════════════════════╗  │
│  ║             Próximo  →                  ║  │
│  ╚═════════════════════════════════════════╝  │
│                                               │
╰───────────────────────────────────────────────╯
```

**Melhorias mobile:**
- Células do calendário: 48x48px (touch-friendly)
- Drag handle visível para fechar arrastando
- Safe area padding no bottom
- Feedback de seleção com escala maior (1.15x)

### Step 2: Matéria (Mobile)

```text
╭───────────────────────────────────────────────╮
│  ──────────────────────  (drag handle)        │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │  ← Voltar          📅 25/02 • 17d       │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │   📚 Qual matéria?                      │  │
│  │   Selecione a disciplina                │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │                                         │  │
│  │   [ Anatomia             ] → CHIP FULL  │  │
│  │                                         │  │
│  │   [ Farmacologia   ✓     ] ← SELECTED   │  │
│  │   [████████░░] 45%                      │  │
│  │                                         │  │
│  │   [ Fisiologia           ]              │  │
│  │                                         │  │
│  │   [ Bioquímica           ]              │  │
│  │                                         │  │
│  │   ... (scroll)                          │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │  Nome: P1, P2...  (optional)            │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ╔═════════════════════════════════════════╗  │
│  ║          ✓ Salvar Prova                 ║  │
│  ╚═════════════════════════════════════════╝  │
│                                               │
╰───────────────────────────────────────────────╯
```

**Melhorias mobile:**
- Chips de matéria FULL WIDTH (não lado a lado)
- Scroll vertical suave na lista
- Botão "Voltar" com área de toque generosa (44px)
- Input de nome fixo no bottom com safe area

### Step 3: Sucesso (Mobile)

```text
╭───────────────────────────────────────────────╮
│                                               │
│           🎉 (confetti animado)               │
│                                               │
│           ╭─────────────────────╮             │
│           │        ✓            │             │
│           │   (animação scale)  │             │
│           ╰─────────────────────╯             │
│                                               │
│           Prova Adicionada!                   │
│           Boa sorte nos estudos 🎯            │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │  📚 Farmacologia                        │  │
│  │  📅 25 de fevereiro • 17 dias           │  │
│  │  [████████████░░░░░] 45%                │  │
│  │  Continue estudando!                    │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ╔═════════════════════════════════════════╗  │
│  ║  + Adicionar outra      │      Fechar   ║  │
│  ╚═════════════════════════════════════════╝  │
│                                               │
╰───────────────────────────────────────────────╯
```

---

## Implementação Técnica

### 1. Arquitetura: Drawer para Mobile, Dialog para Desktop

Criar um componente wrapper que detecta o contexto:

```tsx
// AddExamWizard.tsx (refatorado)

export const AddExamWizard: React.FC<Props> = (props) => {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return <AddExamWizardMobile {...props} />;
  }
  
  return <AddExamWizardDesktop {...props} />;
};
```

### 2. AddExamWizardMobile (Novo Componente)

Usar `vaul` Drawer ao invés de Dialog:

```tsx
// AddExamWizardMobile.tsx

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

export const AddExamWizardMobile: React.FC<Props> = ({
  open,
  onOpenChange,
  ...props
}) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh] px-4 pb-safe">
        {/* Steps animados */}
        <AnimatePresence mode="wait">
          {/* Calendar, Materia, Success */}
        </AnimatePresence>
      </DrawerContent>
    </Drawer>
  );
};
```

### 3. ExamCalendarStepMobile (Calendário Otimizado)

```tsx
// ExamCalendarStepMobile.tsx

<Calendar
  classNames={{
    // Células maiores para touch
    head_cell: "w-12 text-xs", // 48px
    cell: "h-12 w-12",          // 48px x 48px
    day: cn(
      "h-12 w-12 p-0 font-normal rounded-2xl",
      "active:scale-95 transition-transform", // Press feedback
    ),
    day_selected: cn(
      "bg-primary text-primary-foreground font-bold",
      "scale-105 shadow-lg shadow-primary/40",
    ),
  }}
/>
```

### 4. ExamMateriaStepMobile (Lista Vertical)

```tsx
// Layout de chips em coluna única para mobile

<div className="flex flex-col gap-3">
  {materias.map((materia) => (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={cn(
        "w-full px-4 py-4 rounded-2xl border-2",
        "min-h-[56px] flex items-center gap-3", // 56px altura mínima
        isSelected && "border-primary bg-primary/10"
      )}
    >
      {/* Full width chip */}
    </motion.button>
  ))}
</div>
```

### 5. Gestures e Haptics

```tsx
// Vibração ao selecionar (se suportado)
const triggerHaptic = () => {
  if ('vibrate' in navigator) {
    navigator.vibrate(10); // 10ms pulse
  }
};

// Swipe para voltar
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  onDragEnd={(_, info) => {
    if (info.offset.x > 100) {
      onBack();
    }
  }}
>
  {/* Step content */}
</motion.div>
```

### 6. Safe Area e Sticky Footer

```tsx
// Bottom safe area para iPhone X+
<div className="pb-safe">
  <Button className="w-full h-14 text-lg rounded-2xl">
    Próximo
  </Button>
</div>
```

---

## Arquivos a Criar/Modificar

### Novos Componentes

| Arquivo | Responsabilidade |
|---------|------------------|
| `AddExamWizardMobile.tsx` | Wrapper com Drawer para mobile |
| `ExamCalendarStepMobile.tsx` | Calendário com células grandes |
| `ExamMateriaStepMobile.tsx` | Lista vertical de matérias |

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `AddExamWizard.tsx` | Renderização condicional mobile/desktop |
| `ExamCalendarStep.tsx` | Ajustar tamanhos de células via props |
| `ExamMateriaStep.tsx` | Suportar layout vertical via props |
| `ExamSuccessStep.tsx` | Ajustes menores de padding |

---

## Detalhes de Implementação

### AddExamWizard.tsx (Atualizado)

```tsx
import { useIsMobile } from '@/hooks/use-mobile';
import { AddExamWizardMobile } from './AddExamWizardMobile';

export const AddExamWizard: React.FC<AddExamWizardProps> = (props) => {
  const isMobile = useIsMobile();
  
  // Mobile: usa Drawer bottom sheet
  if (isMobile) {
    return <AddExamWizardMobile {...props} />;
  }
  
  // Desktop: mantém Dialog atual
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* ...existing desktop implementation */}
    </Dialog>
  );
};
```

### ExamCalendarStep (Com Props para Tamanhos)

```tsx
interface ExamCalendarStepProps {
  // ...existing props
  cellSize?: 'sm' | 'lg'; // 'lg' para mobile
}

// Inside component:
const cellSizeClass = cellSize === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
```

### ExamMateriaStep (Com Layout Vertical)

```tsx
interface ExamMateriaStepProps {
  // ...existing props
  layout?: 'grid' | 'vertical'; // 'vertical' para mobile
}

// Inside component:
<div className={cn(
  layout === 'vertical' 
    ? "flex flex-col gap-3" 
    : "flex flex-wrap gap-2"
)}>
```

### Tailwind Safe Area Plugin

Adicionar ao `tailwind.config.ts`:

```ts
// Já pode usar pb-safe se tiver o plugin, senão usar fallback:
// pb-[env(safe-area-inset-bottom,16px)]
```

---

## Transições e Animações Mobile

### Swipe Gestures

```tsx
// Step transitions com swipe horizontal
const swipeVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
  }),
};

// Mais rápido no mobile
const mobileTransition = {
  x: { type: "spring", stiffness: 500, damping: 40 },
  opacity: { duration: 0.15 },
};
```

### Press States

```tsx
// Feedback visual imediato
<motion.button
  whileTap={{ scale: 0.95 }}
  transition={{ duration: 0.1 }}
>
```

---

## Checklist de QA Mobile

### Touch & Gestures
- [ ] Todas as áreas tocáveis têm pelo menos 44x44px
- [ ] Calendário com células de 48x48px
- [ ] Swipe para fechar drawer funciona
- [ ] Press states visíveis (scale 0.95-0.98)
- [ ] Sem atrasos perceptíveis no toque

### Layout
- [ ] Drawer ocupa altura adequada (80-96vh)
- [ ] Safe area respeitada no bottom (iPhone X+)
- [ ] Sem scroll horizontal indesejado
- [ ] Teclado não sobrepõe input de nome
- [ ] Conteúdo visível em telas de 320px de largura

### Visual
- [ ] Drag handle visível e funcional
- [ ] Animações suaves (60fps)
- [ ] Dark/light mode consistente
- [ ] Confetti funciona no mobile

### Acessibilidade
- [ ] VoiceOver/TalkBack navegável
- [ ] Focus trap dentro do drawer
- [ ] Reduced motion respeitado

---

## Ordem de Implementação

1. **Criar `AddExamWizardMobile.tsx`** com estrutura Drawer
2. **Modificar `AddExamWizard.tsx`** para renderização condicional
3. **Criar `ExamCalendarStepMobile.tsx`** com células grandes
4. **Criar `ExamMateriaStepMobile.tsx`** com lista vertical
5. **Ajustar `ExamSuccessStep.tsx`** para padding mobile
6. **Testar em dispositivos reais** (iPhone SE, Pixel 5, etc.)

---

## Resultado Esperado

Após implementação:

1. **Experiência nativa**: Bottom sheet desliza de baixo, como apps nativos iOS/Android
2. **Touch-friendly**: Todas as áreas tocáveis adequadas para dedos
3. **Fluidez**: Animações spring suaves, gestures responsivos
4. **Safe areas**: Conteúdo nunca cortado pelo notch ou home indicator
5. **Haptic feedback**: Vibração sutil ao selecionar data/matéria
6. **Zero frustração**: Fácil navegar, voltar, e fechar com gestures

