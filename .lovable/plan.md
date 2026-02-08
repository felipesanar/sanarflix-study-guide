
# Plano: Melhorar Responsividade e UI do Wizard Desktop

## Problemas Identificados nas Screenshots

### Screenshot 1: Step Calendário
- Botão "Próximo" cortado (não visível)
- Há espaço desperdiçado abaixo do feedback de data
- Modal com altura fixa quando poderia ser dinâmica

### Screenshot 2: Step Matéria  
- **ScrollArea desnecessária** - Modal tem espaço para expandir
- Chips de matéria com nomes truncados ("Ciências soci-ais, saúde e meio ambiente")
- Grid 2 colunas muito apertado para 4 matérias
- Não segue o padrão visual do "Seu Guia" (SubjectChips.tsx)

## Referência: Padrões do "Seu Guia"

| Componente | Padrão Utilizado |
|------------|------------------|
| **SubjectChips** | Chips horizontais com scroll, min-h-[44px], nomes completos (`whitespace-nowrap`) |
| **TodayStudyCard** | Grid responsivo `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| **SubjectCard** | Cards com `break-words hyphens-auto`, nunca truncam texto |
| **CalendarViewDesktop** | Headers com ícone + título + descrição lado a lado |

---

## Solução Proposta

### 1. `ExamMateriaStep.tsx` - Refatorar Completamente

**Problemas atuais:**
- `ScrollArea` forçando scroll quando há espaço
- Grid `grid-cols-2` não adapta ao conteúdo
- Altura fixa `min-h-[500px]` no container pai

**Solução:**

```tsx
// REMOVER: ScrollArea wrapper
// REMOVER: min-h e alturas fixas que forçam scroll

// NOVO: Container flex que cresce naturalmente
<div className="flex flex-col gap-5">
  {/* Grid de matérias - SEM scroll, expande o modal */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {materias.map((materia) => (
      // Cada chip é um card completo
      <button className={cn(
        "w-full p-4 rounded-xl border-2 text-left",
        "flex items-center gap-3",
        "min-h-[56px]", // Touch-friendly
        isSelected && "border-primary bg-primary/10"
      )}>
        {/* Radio visual */}
        <div className="w-5 h-5 rounded-full border-2 shrink-0">
          {isSelected && <Check />}
        </div>
        
        {/* Nome COMPLETO - nunca trunca */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm break-words">
            {materia}
          </span>
          {/* Progress inline quando selecionado */}
          {isSelected && progress && (
            <div className="mt-2">
              <Progress value={percentage} />
              <span className="text-xs">{percentage}% concluído</span>
            </div>
          )}
        </div>
        
        {/* Badge de % quando NÃO selecionado */}
        {!isSelected && percentage > 0 && (
          <Badge>{percentage}%</Badge>
        )}
      </button>
    ))}
  </div>
</div>
```

### 2. `AddExamWizard.tsx` - Dialog Dinâmico

**Problemas atuais:**
- `min-h-[500px]` força altura fixa
- `absolute inset-0` nos steps impede crescimento

**Solução:**

```tsx
<DialogContent 
  className={cn(
    "sm:max-w-lg overflow-visible p-0",
    // SEM min-h fixo - deixa o conteúdo definir altura
  )}
>
  {/* Container relativo que cresce com conteúdo */}
  <div className="p-6">
    <AnimatePresence mode="wait">
      {/* Steps com posição relativa, não absoluta */}
      {state.step === 'calendar' && (
        <motion.div key="calendar">
          <ExamCalendarStep ... />
        </motion.div>
      )}
      
      {state.step === 'materia' && (
        <motion.div key="materia">
          <ExamMateriaStep ... />
        </motion.div>
      )}
    </AnimatePresence>
  </div>
</DialogContent>
```

### 3. `ExamCalendarStep.tsx` - Garantir Botão Visível

**Problema:** Botão "Próximo" cortado pelo container pai

**Solução:**
- Remover `flex-1` que força calendário a esticar
- Adicionar espaçamento adequado antes do botão
- Garantir que feedback de data não ocupe espaço excessivo

```tsx
<div className="flex flex-col gap-5">
  {/* Header */}
  <div>...</div>
  
  {/* Calendário - tamanho natural */}
  <div className="flex justify-center">
    <Calendar ... />
  </div>
  
  {/* Feedback de data - altura fixa pequena */}
  <div className="h-14 flex items-center justify-center">
    {selectedDate && <DateFeedback />}
  </div>
  
  {/* Botão - SEMPRE visível */}
  <Button className="w-full h-12">
    Próximo
  </Button>
</div>
```

---

## Mudanças Detalhadas por Arquivo

### Arquivo 1: `src/components/progress-hub/AddExamWizard.tsx`

**Linha 168**: Alterar DialogContent
```tsx
// ANTES
<DialogContent className="sm:max-w-md md:max-w-lg overflow-hidden p-0">

// DEPOIS  
<DialogContent className="sm:max-w-lg overflow-visible p-0">
```

**Linha 175**: Remover altura fixa e posição absoluta
```tsx
// ANTES
<div className="relative min-h-[500px] p-6">
  ...
  <motion.div className="absolute inset-0 p-6">

// DEPOIS
<div className="p-6">
  ...
  <motion.div>
```

### Arquivo 2: `src/components/progress-hub/ExamCalendarStep.tsx`

**Linha 54**: Container principal sem flex-1
```tsx
// ANTES
<div className="flex flex-col h-full space-y-5">

// DEPOIS
<div className="flex flex-col gap-5">
```

**Linha 78**: Calendário centralizado sem esticar
```tsx
// ANTES
<div className="flex-1 flex flex-col items-center justify-center">

// DEPOIS
<div className="flex justify-center py-2">
```

**Linha 134**: Feedback de data com altura controlada
```tsx
// ANTES
<div className="h-16 flex items-center justify-center mt-4">

// DEPOIS
<div className="h-14 flex items-center justify-center">
```

### Arquivo 3: `src/components/progress-hub/ExamMateriaStep.tsx`

**REMOVER:**
- Import de `ScrollArea` (linha 10)
- Wrapper `ScrollArea` (linhas 89-176)

**ALTERAR linha 51:**
```tsx
// ANTES
<div className="flex flex-col h-full space-y-5">

// DEPOIS
<div className="flex flex-col gap-5">
```

**ALTERAR grid de matérias (linha 90):**
```tsx
// ANTES (com ScrollArea)
<ScrollArea className="flex-1 -mx-1 px-1">
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2">

// DEPOIS (sem scroll, layout melhor)
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
```

**Cada botão de matéria - garantir nomes completos:**
```tsx
<motion.button
  className={cn(
    "w-full px-4 py-3 rounded-xl border-2 text-left",
    "flex items-center gap-3 min-h-[56px]",
    // Sem truncate!
  )}
>
  {/* Radio circle */}
  <div className="w-5 h-5 rounded-full border-2 shrink-0">
    {isSelected && <Check />}
  </div>
  
  {/* Conteúdo */}
  <div className="flex-1 min-w-0">
    <span className="font-medium text-sm break-words leading-tight">
      {materia}
    </span>
    
    {/* Progress quando selecionado */}
    {isSelected && progress && (
      <motion.div className="mt-2 space-y-1">
        <Progress value={percentage} className="h-1.5" />
        <span className="text-xs text-muted-foreground">
          {percentage}% concluído
        </span>
      </motion.div>
    )}
  </div>
  
  {/* Badge de % quando não selecionado */}
  {!isSelected && percentage > 0 && (
    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
      {percentage}%
    </span>
  )}
</motion.button>
```

---

## Comparação Visual Esperada

### ANTES (Problemas):
```text
┌────────────────────────────────────┐
│ Voltar                  📅 19/02   │
├────────────────────────────────────┤
│ Qual matéria?                      │
│                                    │
│ ┌─────────────────────────────────┐│
│ │ ┌──────────┐ ┌──────────────┐   ││
│ │ │Anatomia  │ │Citologia e...│   ││  ← Scroll
│ │ │do Apare..│ │              │   ││  ← Nomes truncados
│ │ └──────────┘ └──────────────┘   ││
│ │ ┌──────────┐ ┌──────────────┐   ││
│ │ │Ciências  │ │Embriologia...│   ││
│ │ │soci-ais..│ │              │   ││
│ │ └──────────┘ └──────────────┘   ││
│ └─────────────────────────────────┘│
│                                    │
│ Nome da prova (opcional)           │
│ [                                ] │
│                                    │
│ [  Voltar  ]     [ Salvar Prova  ] │
└────────────────────────────────────┘
```

### DEPOIS (Corrigido):
```text
┌────────────────────────────────────────────┐
│ ← Voltar                      📅 19/02 • 11d│
├────────────────────────────────────────────┤
│                                            │
│ 📚 Qual matéria?                           │
│    Selecione a disciplina da prova         │
│                                            │
│ ┌────────────────────┐ ┌──────────────────┐│
│ │ ○ Anatomia do      │ │ ✓ Citologia e    ││
│ │   Aparelho         │ │   Histologia     ││  ← Nomes COMPLETOS
│ │   Locomotor   33%  │ │   ────────────   ││  ← SEM scroll
│ │                    │ │   33% concluído  ││  ← Progress inline
│ └────────────────────┘ └──────────────────┘│
│ ┌────────────────────┐ ┌──────────────────┐│
│ │ ○ Ciências sociais,│ │ ○ Embriologia e  ││
│ │   saúde e meio     │ │   Genética       ││
│ │   ambiente    75%  │ │                  ││
│ └────────────────────┘ └──────────────────┘│
│                                            │
│ Nome da prova (opcional)                   │
│ ┌──────────────────────────────────────┐   │
│ │ P1, P2, Prova Final...               │   │
│ └──────────────────────────────────────┘   │
│                                            │
│ ┌──────────────────┐ ┌────────────────────┐│
│ │     Voltar       │ │   ✓ Salvar Prova   ││
│ └──────────────────┘ └────────────────────┘│
└────────────────────────────────────────────┘
```

---

## Checklist de Validação

### Responsividade
- [ ] Modal expande para acomodar todas as matérias (sem scroll interno)
- [ ] Nomes de matérias longos aparecem completos
- [ ] Botões sempre visíveis sem precisar rolar
- [ ] Funciona bem em viewports 1024px, 1280px, 1920px

### Visual
- [ ] Chips de matéria com visual similar ao SubjectChips do "Seu Guia"
- [ ] Radio buttons circulares com check animado
- [ ] Progress bar inline quando matéria selecionada
- [ ] Badge de % quando não selecionada
- [ ] Bordas e sombras consistentes com theme

### UX
- [ ] Transições suaves entre steps
- [ ] Hover states claros em cada chip
- [ ] Focus visible para acessibilidade
- [ ] prefers-reduced-motion respeitado

---

## Ordem de Implementação

1. **AddExamWizard.tsx**: Remover altura fixa e posição absoluta dos steps
2. **ExamCalendarStep.tsx**: Ajustar layout para botão sempre visível
3. **ExamMateriaStep.tsx**: Remover ScrollArea, melhorar grid de chips
4. **Testar**: Verificar em diferentes tamanhos de tela
