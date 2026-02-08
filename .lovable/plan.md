
# Plano: Remover Card de Progresso e Adicionar Provas no MeuDiaCard

## Objetivo

Remover o `ProgressSummaryCard` (card com 14%, "Acelerando", streak) da Home e adicionar um indicador compacto de provas vinculado ao `MeuDiaCard`, mantendo o grid/layout original intacto.

## Análise do Layout Atual

O layout atual da Home possui três linhas principais:
- **Linha 1**: WelcomeCard + AnnouncementsCard
- **Linha 1.5**: ProgressSummaryCard (será removido)
- **Linha 2**: MeuDiaCard + RankingCard
- **Linha 3**: SimuladoPerformanceCard + MeuSemestreCard

Ao remover a Linha 1.5, o layout volta ao original e mais enxuto.

## Abordagem: Seção de Prova Inline no MeuDiaCard

A melhor forma de integrar provas sem atrapalhar o layout é criar uma **seção compacta dentro do próprio MeuDiaCard**, exibida como um "banner" ou item especial no topo da lista de atividades.

```text
┌─────────────────────────────────────────┐
│  🗓️ Meu Dia              3 Sugestões   │
├─────────────────────────────────────────┤
│  ┌────────────────────────────────────┐ │  ← Novo: Banner de Próxima Prova
│  │ 🎓 Bioquímica em 5 dias            │ │
│  │   ████████░░░░ 68%  | Estudar →    │ │
│  └────────────────────────────────────┘ │
│                                         │
│  📚 Aula: Proteínas        [Assistir →] │  ← Sugestões do calendário
│  📚 Aula: Lipídios         [Assistir →] │
│  📚 Revisão: Carboidratos  [Assistir →] │
│                                         │
└─────────────────────────────────────────┘
```

## Arquitetura da Solução

### 1. Criar componente `UpcomingExamBanner`

Componente leve e compacto para exibir a próxima prova:

```typescript
// src/components/home/UpcomingExamBanner.tsx

interface UpcomingExamBannerProps {
  exam: ExamInsight | null;
  loading: boolean;
  onStudyClick: (materia: string) => void;
  onAddExamClick: () => void;
}
```

**Características:**
- Exibe a prova mais próxima (se houver)
- Mostra: matéria, dias restantes, barra de progresso, botão de ação
- Estado vazio: "Cadastre sua próxima prova" (link para wizard)
- Ocupa no máximo ~70px de altura

### 2. Modificar `MeuDiaCard`

Integrar o `UpcomingExamBanner` no topo do conteúdo:

```typescript
interface MeuDiaCardProps {
  items: MeuDiaItem[];
  hasStudyGuide: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  // Novos props para provas
  nextExam?: ExamInsight | null;
  examLoading?: boolean;
  onAddExamClick?: () => void;
}
```

### 3. Atualizar `Home.tsx`

- Remover `ProgressSummaryCard` de todos os layouts (Desktop, Tablet, Mobile)
- Buscar dados de provas usando `useUserExams` e `calculateExamInsight`
- Passar a próxima prova para o `MeuDiaCard`
- Adicionar modal de cadastro de prova (reutilizar `AddExamWizard`)

## Mudanças nos Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/home/UpcomingExamBanner.tsx` | **Criar** - Banner compacto de próxima prova |
| `src/components/home/MeuDiaCard.tsx` | Adicionar props e renderizar UpcomingExamBanner |
| `src/pages/Home.tsx` | Remover ProgressSummaryCard, integrar lógica de provas |
| `src/components/home/ProgressSummaryCard.tsx` | Pode ser mantido/deprecado (não usado na Home) |

## Design do UpcomingExamBanner

### Estado com prova cadastrada
```text
┌────────────────────────────────────────────────────────┐
│  🎓  Bioquímica         ████████░░ 68%    5 dias  →   │
│      ⚡ 2 aulas/dia restantes                          │
└────────────────────────────────────────────────────────┘
```

### Estado sem prova
```text
┌────────────────────────────────────────────────────────┐
│  🗓️  Cadastre sua próxima prova para acompanhar  [+]  │
└────────────────────────────────────────────────────────┘
```

## Cores por Status (reutilizando do ExamTrackerCard)
- 🔴 **Critical** (≤7 dias, <50%): Vermelho/destructive
- 🟡 **Warning**: Âmbar
- 🟢 **On Track**: Verde
- 🔵 **Excellent** (≥90%): Primário

## Considerações

1. **Reutilização**: O modal `AddExamWizard` já existe e será reutilizado
2. **Dados**: Usar `useUserExams` + `calculateExamInsight` (já implementados)
3. **Responsividade**: Banner é compacto e funciona em todas as telas
4. **Performance**: Dados de provas já são carregados via React Query com cache
5. **Consistência**: Visual segue os padrões do MeuDiaCard existente

## Fluxo de Dados

```text
Home.tsx
├── useUserExams() → exams[]
├── useProgressHub() → byMateria[]
├── calculateExamInsight(exams[0], byMateria) → nextExam
│
└── MeuDiaCard
    └── UpcomingExamBanner
        ├── nextExam (props)
        └── onClick → navigate('/guia-estudos?materia=X')
```

## Detalhes Técnicos

### Hook de dados no Home
```typescript
// Em Home.tsx
const { exams, loading: examsLoading, addExam } = useUserExams();
const { data: progressData } = useProgressHub();

// Calcular próxima prova
const nextExamInsight = useMemo(() => {
  if (!exams.length || !progressData) return null;
  const exam = exams[0]; // Já ordenado por data
  const materiaProgress = progressData.by_materia.find(
    m => m.materia.toLowerCase() === exam.materia.toLowerCase()
  );
  return calculateExamInsight(exam, materiaProgress || null);
}, [exams, progressData]);
```

## Resultado Final

- Layout da Home **mais limpo** (sem card de progresso ocupando linha inteira)
- Provas integradas **organicamente** ao fluxo do dia
- **Zero quebra** no grid original
- Usuário vê informação de prova **contextualizada** com suas atividades do dia
