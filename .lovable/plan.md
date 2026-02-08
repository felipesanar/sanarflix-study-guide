
# Plano de Reorganização da Central de Progresso

## Análise do Problema Atual

### Problemas Identificados na Screenshot

| Problema | Descrição | Impacto |
|----------|-----------|---------|
| **Cards Espremidos** | Os cards "O que fazer agora", "Sua consistência" e "Diagnóstico" estão em 3 colunas muito estreitas (lg:grid-cols-3), deixando o conteúdo apertado | UX ruim, texto truncado, difícil leitura |
| **Grande Espaço Vazio** | Entre o Hero Card e a linha de 3 cards há um gap visual, e o ExamTracker na lateral cria um "buraco" no layout | Layout desequilibrado |
| **ExamTracker Flutuando** | O "Suas Provas" está numa coluna separada de 320px fixa, mas visualmente desconectado do restante | Não se integra ao layout |
| **Grid Rígido** | O grid `xl:grid-cols-[1fr_320px]` força uma divisão que não escala bem em diferentes viewports | Responsividade ruim |
| **Proporções Desiguais** | Cards de alturas diferentes forçam espaços vazios entre linhas | Visual "quebrado" |

### Estrutura Atual do Layout

```text
┌─────────────────────────────────────────────────┬──────────────────┐
│ Header                                          │                  │
├─────────────────────────────────────────────────┤                  │
│ Hero Card (LARGO, ocupa toda a coluna principal)│   ExamTracker    │
├─────────────────────────────────────────────────┤   (320px fixo)   │
│ NextActions │ Consistency │ Diagnostics         │                  │
│    (1/3)    │    (1/3)    │    (1/3)            │                  │
├─────────────────────────────────────────────────┤                  │
│ Weekly     │ Coverage    │ SpacedRevision       │                  │
│  (1/3)     │   (1/3)     │    (1/3)             │                  │
├─────────────────────────────────────────────────┴──────────────────┤
│ Filtros + Mapa do Semestre                                         │
└────────────────────────────────────────────────────────────────────┘
```

**Problemas técnicos:**
- Linha 468: `grid-cols-1 xl:grid-cols-[1fr_320px]` - coluna fixa não escala
- Linha 494: `lg:grid-cols-3` - 3 colunas muito apertadas em telas menores
- Linha 517: segunda linha de 3 colunas igualmente estreitas
- `ExamTrackerCard` posicionado fora do fluxo natural dos cards

---

## Proposta de Novo Layout

### Princípio: "Layout como Lego"

A ideia é usar um **grid 12 colunas** (ou grid areas) onde cada card ocupa um número de colunas proporcional à sua importância e tamanho de conteúdo, evitando espaços vazios.

### Novo Layout Desktop (1280+)

```text
┌────────────────────────────────────────────────────────────────────┐
│ Header                                                             │
├────────────────────────────────────────────────────────────────────┤
│ Risk Alerts (full width, se houver)                                │
├────────────────────────────────────────┬───────────────────────────┤
│                                        │                           │
│ Hero Card                              │   📚 Suas Provas          │
│ (8 colunas)                            │   (4 colunas, compacto)   │
│                                        │                           │
├────────────────────┬───────────────────┴───────────────────────────┤
│ O que fazer agora  │              Sua Consistência                 │
│ (6 colunas)        │              (6 colunas)                      │
├────────────────────┼───────────────────┬───────────────────────────┤
│ Diagnóstico        │ Evolução Semanal  │ Sua Cobertura             │
│ (4 colunas)        │ (4 colunas)       │ (4 colunas)               │
├────────────────────┴───────────────────┴───────────────────────────┤
│ Filtros + Mapa do Semestre (full width)                            │
└────────────────────────────────────────────────────────────────────┘
```

**Nota:** SpacedRevisionCard será movido para dentro do Mapa do Semestre ou removido (pois duplica informação com Diagnóstico).

### Novo Layout Tablet (768-1279px)

```text
┌────────────────────────────────────────┐
│ Header                                 │
├────────────────────────────────────────┤
│ Hero Card (full width)                 │
├───────────────────┬────────────────────┤
│ Suas Provas       │ O que fazer agora  │
│ (compacto)        │                    │
├───────────────────┼────────────────────┤
│ Consistência      │ Diagnóstico        │
├───────────────────┴────────────────────┤
│ Evolução Semanal (full width)          │
├────────────────────────────────────────┤
│ Sua Cobertura (full width)             │
├────────────────────────────────────────┤
│ Filtros + Mapa do Semestre             │
└────────────────────────────────────────┘
```

### Novo Layout Mobile (< 768px)

```text
┌──────────────────────────┐
│ Header                   │
├──────────────────────────┤
│ Hero Card                │
├──────────────────────────┤
│ 📚 Suas Provas (colaps.) │
├──────────────────────────┤
│ O que fazer agora        │
├──────────────────────────┤
│ Consistência             │
├──────────────────────────┤
│ Diagnóstico              │
├──────────────────────────┤
│ Evolução Semanal         │
├──────────────────────────┤
│ Cobertura                │
├──────────────────────────┤
│ [Filtros] + Mapa         │
└──────────────────────────┘
```

---

## Implementação Técnica

### 1. Refatorar Grid Principal em Dashboard.tsx

**Antes (atual):**
```tsx
<div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
  <div className="space-y-6">
    {/* Hero + cards */}
  </div>
  <ExamTrackerCard /> {/* Isolado na lateral */}
</div>
```

**Depois (proposta):**
```tsx
<div className="grid grid-cols-12 gap-4 lg:gap-6">
  {/* Row 1: Hero + Exams */}
  <div className="col-span-12 lg:col-span-8">
    <ProgressHeroCard />
  </div>
  <div className="col-span-12 lg:col-span-4">
    <ExamTrackerCard compact />
  </div>

  {/* Row 2: Next Actions + Consistency */}
  <div className="col-span-12 md:col-span-6">
    <NextActionsCard />
  </div>
  <div className="col-span-12 md:col-span-6">
    <ConsistencyCard />
  </div>

  {/* Row 3: Diagnostics + Evolution + Coverage */}
  <div className="col-span-12 md:col-span-6 lg:col-span-4">
    <DiagnosticsCard />
  </div>
  <div className="col-span-12 md:col-span-6 lg:col-span-4">
    <WeeklyEvolutionCard />
  </div>
  <div className="col-span-12 lg:col-span-4">
    <CoverageRankingCard />
  </div>

  {/* Row 4: Filters + Map */}
  <div className="col-span-12">
    {/* Filters section */}
  </div>
  <div className="col-span-12">
    <SemesterMapCard />
  </div>
</div>
```

### 2. ExamTrackerCard Compacto

Adicionar prop `compact` ao ExamTrackerCard para comportamento diferenciado:

**Comportamento quando `compact={true}`:**
- Altura máxima de ~250px inicialmente
- Mostra apenas 2 provas em preview
- Botão "Ver todas" expande via modal/sheet ao invés de expandir inline
- Modo colapsado ainda menor (apenas contador)

**Quando o usuário clica "+":**
- Abre um Modal/Dialog bonito (não expande o card)
- Lista todas as provas com scroll
- Permite adicionar/editar/remover

### 3. Cards com Altura Consistente

Adicionar `min-h-[280px]` ou flexbox stretch para manter altura uniforme nas linhas:

```tsx
// Em cada card wrapper
<div className="col-span-12 md:col-span-6 flex">
  <NextActionsCard className="flex-1" />
</div>
```

### 4. Remover SpacedRevisionCard da Grid Principal

O SpacedRevisionCard duplica funcionalidade do DiagnosticsCard (ambos mostram temas negligenciados). Opções:

1. **Integrar ao DiagnosticsCard** como uma aba/toggle
2. **Mover para dentro do SemesterMapCard** como seção auxiliar
3. **Remover completamente** (preferido para simplificar layout)

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Dashboard.tsx` | Refatorar grid para 12 colunas, reordenar cards, remover SpacedRevisionCard da grid principal |
| `src/components/progress-hub/ExamTrackerCard.tsx` | Adicionar prop `compact`, criar versão modal para lista completa |
| `src/components/progress-hub/AddExamModal.tsx` | Evoluir para modal completo com lista de provas + formulário |
| `src/components/progress-hub/ProgressHeroCard.tsx` | Ajustar flexbox interno para não quebrar em viewports menores |

---

## Detalhamento das Mudanças

### Dashboard.tsx - Nova Estrutura

**Linhas a modificar:** 408-610 (seção de render principal)

```tsx
// NOVO: Estrutura de grid 12 colunas
<motion.div className="grid grid-cols-12 gap-4 lg:gap-6">
  
  {/* === ROW 1: Hero + Suas Provas === */}
  <motion.div variants={itemVariants} className="col-span-12 lg:col-span-8 xl:col-span-9">
    <ProgressHeroCard {...heroProps} />
  </motion.div>
  
  <motion.div variants={itemVariants} className="col-span-12 lg:col-span-4 xl:col-span-3">
    <ExamTrackerCard 
      byMateria={data.by_materia}
      materiasList={materiasList}
      compact={true}
    />
  </motion.div>

  {/* === ROW 2: Ações + Consistência (2 colunas iguais) === */}
  <motion.div variants={itemVariants} className="col-span-12 md:col-span-6">
    <NextActionsCard actions={data.next_actions} onActionClick={handleActionClick} />
  </motion.div>
  
  <motion.div variants={itemVariants} className="col-span-12 md:col-span-6">
    <ConsistencyCard streak={data.streak} onGoalChange={handleGoalChange} syncing={syncing} />
  </motion.div>

  {/* === ROW 3: Diagnóstico + Evolução + Cobertura (3 colunas em XL) === */}
  <motion.div variants={itemVariants} className="col-span-12 md:col-span-6 xl:col-span-4">
    <DiagnosticsCard byMateria={data.by_materia} byTema={data.by_tema} />
  </motion.div>
  
  <motion.div variants={itemVariants} className="col-span-12 md:col-span-6 xl:col-span-4">
    <WeeklyEvolutionCard evolution={data.weekly_evolution} totalContent={data.overview.total} />
  </motion.div>
  
  <motion.div variants={itemVariants} className="col-span-12 xl:col-span-4">
    <CoverageRankingCard byMateria={data.by_materia} />
  </motion.div>

  {/* === FILTERS + MAP === */}
  <motion.div variants={itemVariants} className="col-span-12">
    {/* Filters section... */}
  </motion.div>
  
  <motion.div variants={itemVariants} className="col-span-12">
    {/* SemesterMapCard... */}
  </motion.div>
</motion.div>
```

### ExamTrackerCard.tsx - Modo Compacto

**Adicionar prop e comportamento:**

```tsx
interface ExamTrackerCardProps {
  byMateria: MateriaProgress[];
  materiasList: string[];
  compact?: boolean; // NOVO
  className?: string;
}

// Quando compact=true:
// - Limitar exibição a 2 exames
// - "Ver mais" abre Dialog ao invés de expandir
// - Altura máxima restrita
// - Card mais limpo visualmente
```

**Estado vazio ainda mais compacto:**
```tsx
// Quando não há provas e compact=true:
<Card className="h-auto">
  <CardContent className="flex items-center justify-between py-4">
    <div className="flex items-center gap-3">
      <Calendar className="h-5 w-5 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Suas Provas</span>
    </div>
    <Button size="sm" variant="outline" onClick={() => setIsAddModalOpen(true)}>
      <Plus className="h-4 w-4 mr-1" /> Adicionar
    </Button>
  </CardContent>
</Card>
```

### ExamsFullModal - Novo Componente

Modal para visualização completa das provas:

```tsx
// src/components/progress-hub/ExamsFullModal.tsx

interface ExamsFullModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exams: ExamInsight[];
  materiasList: string[];
  onAddExam: (...) => Promise<any>;
  onRemoveExam: (...) => Promise<any>;
  onNavigate: (materia: string) => void;
}

// Dialog grande com:
// - Lista completa de provas com scroll
// - Botão de adicionar no header
// - Insights completos visíveis
// - Edição inline
```

---

## Breakpoints e Responsividade

| Viewport | Comportamento |
|----------|---------------|
| **< 640px (xs/sm)** | 1 coluna, cards empilhados verticalmente |
| **640-767px (sm)** | 1 coluna, ExamTracker colapsado por padrão |
| **768-1023px (md)** | 2 colunas (6+6), ExamTracker full width após Hero |
| **1024-1279px (lg)** | Hero 8 + Exams 4, grid 2+2 nos cards |
| **1280+px (xl)** | Hero 9 + Exams 3, grid 3 colunas nos cards |

---

## Ordem de Implementação

1. **ExamTrackerCard** - Adicionar prop `compact` e comportamento de modal
2. **Dashboard.tsx** - Refatorar grid para 12 colunas
3. **ExamsFullModal** - Criar modal para lista completa
4. **Cards individuais** - Ajustar `className` para suportar flex-1 / height matching
5. **Remover SpacedRevisionCard** - Do grid principal (manter componente para uso futuro)

---

## Checklist de QA

### Responsividade
- [ ] 360px - todos os cards em 1 coluna, sem overflow-x
- [ ] 768px - grids 2 colunas, Hero + Exams empilhados
- [ ] 1024px - Hero (8) + Exams (4)
- [ ] 1280px+ - Layout completo 12 colunas
- [ ] 1920px - Nenhum espaço vazio desproporcional

### Visual
- [ ] Cards com altura uniforme em cada linha
- [ ] Zero espaços "buracos" entre cards
- [ ] ExamTracker compacto no desktop
- [ ] ExamTracker expandível via modal
- [ ] Light/Dark mode consistente

### Funcionalidade
- [ ] Adicionar prova via modal funciona
- [ ] Ver todas as provas no modal funciona
- [ ] CTAs de todos os cards navegam corretamente
- [ ] Filtros do Mapa funcionam
- [ ] Animações suaves (prefers-reduced-motion respeitado)

### Performance
- [ ] Sem re-renders desnecessários
- [ ] Nenhum layout shift ao carregar
- [ ] Transições CSS, não JavaScript pesado

---

## Resultado Esperado

Após a implementação, a página terá:

1. **Layout "Lego"** - Cards encaixados como blocos, sem espaços vazios
2. **ExamTracker integrado** - Não mais flutuando isolado na lateral
3. **Responsividade fluida** - Adapta-se naturalmente a diferentes telas
4. **Hierarquia visual clara** - Hero + Exams no topo, ações/insights no meio, mapa embaixo
5. **Menos clutter** - SpacedRevisionCard removido (funcionalidade coberta pelo Diagnóstico)
