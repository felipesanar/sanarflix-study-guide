
# Plano: Experiência Premium de Adicionar Prova

## Diagnóstico do Problema Atual

### O Que Está Ruim na Screenshot

| Elemento | Problema | Impacto UX |
|----------|----------|------------|
| **Input type="date"** | Input HTML nativo, feio, sem estilo | Experiência inconsistente entre browsers |
| **Fluxo Linear** | Matéria → Nome → Data (forma tradicional) | Tedioso, não engaja |
| **Visual Básico** | Dialog genérico, campos padrão | Sem personalidade, zero "wow factor" |
| **Sem Feedbacks** | Nenhuma animação ou feedback visual | Não transmite progresso/sucesso |
| **Card Pequeno** | "Suas Provas" muito simples | Não valoriza a informação da prova |

---

## Nova Proposta: Calendar-First Experience

### Conceito Principal

Inverter o fluxo: **começar pela data** (o mais visual e emocional) e depois complementar com matéria/nome.

```text
FLUXO ATUAL:                    NOVO FLUXO:
┌──────────────┐               ┌──────────────────────────────────┐
│ 1. Matéria   │               │ 1. CALENDÁRIO GRANDE             │
│ 2. Nome      │     →         │    (visual, interativo)          │
│ 3. Data      │               │ 2. Seleciona matéria (chips)     │
│              │               │ 3. Nome (opcional, inline)       │
└──────────────┘               └──────────────────────────────────┘
```

---

## Design do Novo Modal: "Adicionar Prova"

### Layout em 2 Etapas com Transição Fluida

```text
╔══════════════════════════════════════════════════════════════════════╗
║  STEP 1: Quando Será Sua Prova?                              [X]    ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║                    ┌────────────────────────────┐                    ║
║                    │  ◄    Fevereiro 2026   ►   │                    ║
║                    ├────────────────────────────┤                    ║
║                    │ Do  Se  Te  Qu  Qu  Se  Sa │                    ║
║                    │                          1 │                    ║
║                    │  2   3   4   5   6   7   8 │                    ║
║                    │  9  10  11  12  13  14  15 │  ← Data hoje       ║
║                    │ 16  17  18  19  20  21  22 │                    ║
║                    │ 23  24 [25] 26  27  28     │  ← Selecionada     ║
║                    └────────────────────────────┘                    ║
║                                                                      ║
║                    📅 25 de fevereiro                                ║
║                        em 17 dias                                    ║
║                                                                      ║
║                              [Próximo →]                             ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝

             ↓ Animação slide-left ↓

╔══════════════════════════════════════════════════════════════════════╗
║  STEP 2: Qual Matéria?                      ← Voltar         [X]    ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║       📅 25/02 — em 17 dias              (mini preview fixo)         ║
║                                                                      ║
║  ┌─────────────────────────────────────────────────────────────────┐ ║
║  │  Selecione a matéria:                                           │ ║
║  │                                                                 │ ║
║  │  [ Ciências Básicas    ] [ Farmacologia      ] [ Anatomia     ] │ ║
║  │  [ Fisiologia          ] [ Bioquímica        ] [ Histologia   ] │ ║
║  │  [ Patologia           ] [ Microbiologia     ]                  │ ║
║  └─────────────────────────────────────────────────────────────────┘ ║
║                                                                      ║
║  ┌─────────────────────────────────────────────────────────────────┐ ║
║  │  Nome da prova (opcional):                                      │ ║
║  │  ┌───────────────────────────────────────────────────────────┐  │ ║
║  │  │ P1, P2, Prova Final...                                    │  │ ║
║  │  └───────────────────────────────────────────────────────────┘  │ ║
║  └─────────────────────────────────────────────────────────────────┘ ║
║                                                                      ║
║          [← Voltar]                        [✓ Salvar Prova]          ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## Feedbacks Visuais Premium

### 1. Seleção de Data

Quando o usuário clica numa data:

```text
┌─────────────────────────────────────┐
│  23  24 [25] 26  27  28             │
│           ↑                         │
│     ┌─────────────────┐             │
│     │ ● Pulse effect  │             │
│     │ ● Scale 1.1     │             │
│     │ ● Cor primária  │             │
│     │ ● Checkmark ✓   │             │
│     └─────────────────┘             │
└─────────────────────────────────────┘
```

- **Microanimação**: Scale bounce (1.0 → 1.15 → 1.0)
- **Pulse ring**: Efeito ripple suave saindo da data
- **Badge flutuante**: Mostra "em X dias" instantaneamente

### 2. Seleção de Matéria (Chips)

```text
ANTES:                          DEPOIS (selecionada):
┌──────────────┐               ┌──────────────────┐
│ Farmacologia │               │ ✓ Farmacologia   │
└──────────────┘               │   ████████████   │ ← progress bar
                               │   45% concluído  │
                               └──────────────────┘
```

- Ao clicar: Scale 0.95 → 1.05 → 1.0
- Checkmark aparece com spring animation
- Mini progress bar da matéria aparece com fade-in

### 3. Transição Entre Steps

- **Step 1 → Step 2**: Slide-left + fade
- **Step 2 → Step 1**: Slide-right + fade
- Duração: 300ms, easing: cubic-bezier(0.4, 0, 0.2, 1)

### 4. Sucesso ao Salvar

```text
╔═══════════════════════════════════════════════════╗
║                                                   ║
║           🎉  Prova Adicionada!                   ║
║                                                   ║
║        ┌────────────────────────────────┐         ║
║        │ 📚 Farmacologia                │         ║
║        │ 📅 25 de fevereiro (17 dias)   │         ║
║        │                                │         ║
║        │ [████████████░░░░░░] 45%       │         ║
║        │ Continue estudando!            │         ║
║        └────────────────────────────────┘         ║
║                                                   ║
║          [Adicionar outra]    [Fechar]            ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
```

- Confetti burst (Framer Motion)
- Checkmark animated (draw SVG)
- Card preview com todas as infos

---

## Novo Design do "ExamTrackerCard"

### Versão Compacta Melhorada

```text
┌───────────────────────────────────────────────────────────┐
│ 📚 Suas Provas                                     [+]    │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 🔴 Farmacologia                           5 dias ⏰ │  │
│  │    ████████░░░░░░░░░░░░ 42%                        │  │
│  │    ⚡ Acelere! 3 aulas/dia                         │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 🟢 Anatomia                               20 dias   │  │
│  │    ████████████████░░░░ 78%                        │  │
│  │    ✅ Bom ritmo!                                   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ─────────────────────────────────────────────────────── │
│  [Ver todas (3)]                                          │
└───────────────────────────────────────────────────────────┘
```

### Detalhes Visuais

- **Cards internos com gradiente sutil** baseado no status
- **Barra de progresso colorida** (vermelho → amarelo → verde → azul)
- **Ícone de relógio pulsante** quando dias < 7
- **Hover effect**: Eleva card + sombra + cursor pointer
- **Click**: Navega para guia de estudos da matéria

---

## Componentes a Criar/Modificar

### Novos Componentes

| Componente | Responsabilidade |
|------------|------------------|
| `AddExamWizard.tsx` | Modal wizard multi-step (substitui AddExamModal) |
| `ExamCalendarStep.tsx` | Step 1: Calendário estilizado |
| `ExamMateriaStep.tsx` | Step 2: Grid de chips + nome |
| `ExamSuccessStep.tsx` | Step 3: Feedback de sucesso |
| `ExamCardPreview.tsx` | Preview compacto inline do card salvo |

### Componentes a Refatorar

| Componente | Mudanças |
|------------|----------|
| `ExamTrackerCard.tsx` | Novo design visual premium |
| `ExamItem.tsx` | Layout mais rico, gradientes, animações |
| `ExamsFullModal.tsx` | Usar novo wizard para adicionar |

---

## Implementação Técnica

### 1. AddExamWizard (Wizard Multi-Step)

```tsx
interface WizardState {
  step: 'calendar' | 'materia' | 'success';
  selectedDate: Date | null;
  selectedMateria: string | null;
  examName: string;
}

export const AddExamWizard: React.FC<Props> = ({ ... }) => {
  const [state, setState] = useState<WizardState>({
    step: 'calendar',
    selectedDate: null,
    selectedMateria: null,
    examName: ''
  });

  // Framer Motion variants para transições
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  return (
    <Dialog>
      <DialogContent className="sm:max-w-lg overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          {state.step === 'calendar' && (
            <motion.div key="calendar" variants={slideVariants}>
              <ExamCalendarStep
                selectedDate={state.selectedDate}
                onSelect={(date) => setState(s => ({ ...s, selectedDate: date }))}
                onNext={() => setState(s => ({ ...s, step: 'materia' }))}
              />
            </motion.div>
          )}
          
          {state.step === 'materia' && (
            <motion.div key="materia" variants={slideVariants}>
              <ExamMateriaStep
                selectedMateria={state.selectedMateria}
                materias={materiasList}
                examName={state.examName}
                onBack={() => setState(s => ({ ...s, step: 'calendar' }))}
                onSubmit={handleSubmit}
              />
            </motion.div>
          )}
          
          {state.step === 'success' && (
            <motion.div key="success" variants={slideVariants}>
              <ExamSuccessStep
                examInsight={savedInsight}
                onAddAnother={() => reset()}
                onClose={() => onOpenChange(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
```

### 2. ExamCalendarStep (Calendar Premium)

```tsx
export const ExamCalendarStep: React.FC<Props> = ({ selectedDate, onSelect, onNext }) => {
  const today = new Date();
  
  // Customização do Calendar para visual premium
  const modifiers = {
    selected: selectedDate,
    today: today
  };
  
  const modifiersStyles = {
    selected: {
      backgroundColor: 'hsl(var(--primary))',
      color: 'white',
      fontWeight: 'bold',
      transform: 'scale(1.1)',
      boxShadow: '0 4px 12px hsl(var(--primary) / 0.3)'
    }
  };

  // Calcular dias restantes
  const daysUntil = selectedDate 
    ? differenceInDays(selectedDate, today) 
    : null;

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="text-xl text-center">
          📅 Quando será sua prova?
        </DialogTitle>
        <DialogDescription className="text-center">
          Selecione a data no calendário
        </DialogDescription>
      </DialogHeader>

      {/* Calendário centralizado e grande */}
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onSelect}
          disabled={(date) => date < today}
          className="rounded-xl border-2 shadow-lg p-4 pointer-events-auto"
          classNames={{
            day_selected: "bg-primary text-primary-foreground scale-110 shadow-lg transition-all",
            day: "h-10 w-10 transition-all hover:scale-105"
          }}
        />
      </div>

      {/* Feedback visual da seleção */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center space-y-1"
          >
            <p className="text-lg font-semibold">
              📅 {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
            </p>
            <p className="text-sm text-muted-foreground">
              {daysUntil === 0 && "Hoje! 😮"}
              {daysUntil === 1 && "Amanhã! 🔥"}
              {daysUntil > 1 && `em ${daysUntil} dias`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: selectedDate ? 1 : 0.5 }}
      >
        <Button
          className="w-full h-12 text-base gap-2"
          disabled={!selectedDate}
          onClick={onNext}
        >
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
};
```

### 3. ExamMateriaStep (Chips Grid)

```tsx
export const ExamMateriaStep: React.FC<Props> = ({ 
  selectedMateria, 
  materias, 
  materiasProgress,
  examName,
  selectedDate,
  onBack, 
  onSubmit 
}) => {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <div className="space-y-6">
      {/* Header com mini-preview da data */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        
        <div className="flex items-center gap-2 text-sm bg-muted px-3 py-1.5 rounded-full">
          <Calendar className="h-3.5 w-3.5" />
          <span>{format(selectedDate, 'dd/MM')}</span>
          <span className="text-muted-foreground">
            • {differenceInDays(selectedDate, new Date())}d
          </span>
        </div>
      </div>

      <DialogHeader>
        <DialogTitle className="text-xl">Qual matéria?</DialogTitle>
      </DialogHeader>

      {/* Grid de Matérias como Chips */}
      <div className="flex flex-wrap gap-2">
        {materias.map((materia) => {
          const isSelected = selectedMateria === materia;
          const progress = materiasProgress.find(m => m.materia === materia);
          
          return (
            <motion.button
              key={materia}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelectMateria(materia)}
              className={cn(
                "px-4 py-3 rounded-xl border-2 text-left transition-all",
                "flex flex-col gap-1 min-w-[140px]",
                isSelected 
                  ? "border-primary bg-primary/10 shadow-md" 
                  : "border-border hover:border-primary/50 hover:bg-accent"
              )}
            >
              <div className="flex items-center gap-2">
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Check className="h-4 w-4 text-primary" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <span className="font-medium text-sm truncate">{materia}</span>
              </div>
              
              {/* Mini progress */}
              {progress && isSelected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-1"
                >
                  <Progress value={progress.percentage} className="h-1.5" />
                  <span className="text-xs text-muted-foreground">
                    {progress.percentage}% concluído
                  </span>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Nome da Prova (opcional) */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">
          Nome da prova (opcional)
        </Label>
        <Input
          placeholder="P1, P2, Prova Final..."
          value={examName}
          onChange={(e) => onExamNameChange(e.target.value)}
          className="h-11"
        />
      </div>

      {/* Footer */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Voltar
        </Button>
        <Button 
          className="flex-1 gap-2" 
          disabled={!selectedMateria}
          onClick={onSubmit}
        >
          <Check className="h-4 w-4" />
          Salvar Prova
        </Button>
      </div>
    </div>
  );
};
```

### 4. ExamSuccessStep (Celebração)

```tsx
export const ExamSuccessStep: React.FC<Props> = ({ insight, onAddAnother, onClose }) => {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6 py-4"
    >
      {/* Confetti animation (se prefers-reduced-motion permite) */}
      {!shouldReduceMotion && <ConfettiBurst />}
      
      {/* Checkmark animado */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
        className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"
      >
        <motion.div
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Check className="h-8 w-8 text-emerald-600" />
        </motion.div>
      </motion.div>

      <div>
        <h3 className="text-xl font-semibold">Prova Adicionada!</h3>
        <p className="text-muted-foreground mt-1">Boa sorte nos estudos 🎯</p>
      </div>

      {/* Preview do card salvo */}
      <div className="bg-muted/50 rounded-xl p-4 text-left space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">{insight.exam.materia}</span>
          <span className="text-sm text-muted-foreground">
            {insight.exam.exam_name}
          </span>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4" />
          <span>{format(new Date(insight.exam.exam_date), "d 'de' MMMM", { locale: ptBR })}</span>
          <span className="text-muted-foreground">
            ({insight.days_remaining} dias)
          </span>
        </div>

        {insight.materia_progress && (
          <div className="space-y-1">
            <Progress value={insight.materia_progress.percentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {insight.materia_progress.percentage}% concluído • {insight.message}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onAddAnother}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar outra
        </Button>
        <Button className="flex-1" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </motion.div>
  );
};
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/progress-hub/AddExamModal.tsx` | Remover (substituído por AddExamWizard) |
| `src/components/progress-hub/AddExamWizard.tsx` | **Criar** - Wizard completo multi-step |
| `src/components/progress-hub/ExamCalendarStep.tsx` | **Criar** - Step 1 do wizard |
| `src/components/progress-hub/ExamMateriaStep.tsx` | **Criar** - Step 2 do wizard |
| `src/components/progress-hub/ExamSuccessStep.tsx` | **Criar** - Step 3 celebração |
| `src/components/progress-hub/ExamTrackerCard.tsx` | **Refatorar** - Novo design visual |
| `src/components/progress-hub/ExamItem.tsx` | **Refatorar** - Layout premium |
| `src/components/progress-hub/ExamsFullModal.tsx` | Usar novo wizard |
| `src/components/progress-hub/index.ts` | Exportar novos componentes |

---

## Checklist de Qualidade

### Visual
- [ ] Calendário centralizado, grande, bonito
- [ ] Transições suaves entre steps (300ms)
- [ ] Chips de matéria com hover/selected states
- [ ] Feedback visual ao selecionar data
- [ ] Celebração animada no sucesso
- [ ] Dark/Light mode perfeito

### UX
- [ ] Fluxo calendar-first (data → matéria → nome)
- [ ] Botão "Voltar" funcional
- [ ] Preview da data sempre visível no step 2
- [ ] Progress da matéria visível ao selecionar
- [ ] "Adicionar outra" após sucesso

### Acessibilidade
- [ ] prefers-reduced-motion respeitado
- [ ] aria-labels em todos os botões
- [ ] Focus trap no modal
- [ ] Navegação por teclado

### Performance
- [ ] Lazy load do Calendar
- [ ] useMemo para cálculos de daysUntil
- [ ] Animações via CSS/Framer (não JS pesado)

---

## Resultado Esperado

Após a implementação:

1. **Experiência "Wow"**: O usuário clica em adicionar, vê um calendário grande e bonito, seleciona a data com animação satisfatória
2. **Fluxo Intuitivo**: Data → Matéria (chips visuais) → Nome (opcional) → Sucesso com celebração
3. **Feedbacks Constantes**: Cada ação tem resposta visual imediata
4. **Cards Premium**: O card "Suas Provas" mostra informações de forma rica e engajante
5. **Zero Frustração**: Fácil voltar, corrigir, e adicionar múltiplas provas

