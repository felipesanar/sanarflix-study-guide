

# Plano: Evolução do Modo Pré-Prova — Sempre Ativo e Multi-Prova

## Resumo Executivo

Transformar o Modo Pré-Prova de um recurso opcional em uma **funcionalidade core sempre visível** que ajuda o aluno a gerenciar múltiplas provas associadas às matérias do semestre, com insights inteligentes sobre preparação.

---

## O Que Existe Hoje vs O Que Será Feito

| Aspecto | Hoje | Depois |
|---------|------|--------|
| Ativação | Manual (Switch ou URL) | **Sempre ativo** |
| Posição | Grid de 2 colunas, meio da página | **Topo direito, coluna lateral fixa** |
| Número de provas | 1 única data global | **Múltiplas provas por matéria** |
| Armazenamento | localStorage apenas | **Banco de dados (user_exams)** |
| Insights | Checklist genérico por % | **Insights por prova + progresso específico** |
| Associação | Nenhuma | **Prova ↔ Matéria** |

---

## Arquitetura da Solução

### 1. Nova Tabela: `user_exams`

```sql
CREATE TABLE user_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  materia TEXT NOT NULL,
  exam_name TEXT NOT NULL DEFAULT 'Prova',
  exam_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, materia, exam_date)
);

-- RLS
ALTER TABLE user_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own exams"
  ON user_exams FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 2. Novo Componente: `ExamTrackerCard`

Substitui `PreProvaMode` + `ExamCountdownCard` por um único componente premium:

```text
┌─────────────────────────────────────────────────┐
│ 📚 Suas Provas                          [+ Add] │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🔴 Anatomia                                     │
│    Prova em 5 dias                              │
│    ┌──────────────────────────────────────────┐ │
│    │ ▓▓▓▓▓▓░░░░░░░░░ 42% concluído            │ │
│    │ 15/36 aulas • 3 quizzes feitos           │ │
│    └──────────────────────────────────────────┘ │
│    ⚠️ Você precisa acelerar! 4 aulas/dia       │
│    [Estudar Anatomia →]                         │
│                                                 │
│ 🟡 Farmacologia                                 │
│    Prova em 12 dias                             │
│    ┌──────────────────────────────────────────┐ │
│    │ ▓▓▓▓▓▓▓▓▓▓▓▓░░░ 78% concluído            │ │
│    │ 28/36 aulas • 5 quizzes feitos           │ │
│    └──────────────────────────────────────────┘ │
│    ✅ Bom ritmo! Continue assim                 │
│    [Revisar Farmacologia →]                     │
│                                                 │
│ 🟢 Fisiologia                                   │
│    Prova em 20 dias                             │
│    ┌──────────────────────────────────────────┐ │
│    │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░ 92% concluído            │ │
│    │ 33/36 aulas • 8 quizzes feitos           │ │
│    └──────────────────────────────────────────┘ │
│    🎯 Quase lá! Foque na revisão                │
│    [Finalizar Fisiologia →]                     │
│                                                 │
├─────────────────────────────────────────────────┤
│ Sem provas em breve                             │
│ [+ Adicionar prova]                             │
└─────────────────────────────────────────────────┘
```

### 3. Modal de Adição de Prova

```text
┌─────────────────────────────────────────────────┐
│ Adicionar Prova                           [X]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Matéria *                                       │
│ ┌─────────────────────────────────────────────┐ │
│ │ Selecione a matéria            ▾           │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Nome da Prova (opcional)                        │
│ ┌─────────────────────────────────────────────┐ │
│ │ P1, P2, Prova Final...                      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Data da Prova *                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📅 Selecionar data                          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Cancelar]                        [Salvar]      │
└─────────────────────────────────────────────────┘
```

### 4. Lógica de Insights por Prova

Para cada prova cadastrada, calcular:

```typescript
interface ExamInsight {
  exam: UserExam;
  materia: MateriaProgress;
  daysRemaining: number;
  lessonsRemaining: number;
  lessonsPerDay: number; // lessonsRemaining / daysRemaining
  status: 'critical' | 'warning' | 'on_track' | 'excellent';
  message: string;
}

// Status logic:
// - critical: < 7 dias E < 50% concluído
// - warning: < 14 dias E < 70% concluído OU lessonsPerDay > 3
// - on_track: progresso adequado ao tempo restante
// - excellent: >= 80% concluído OU finalizado
```

### 5. Estado Vazio (Sem Provas)

```text
┌─────────────────────────────────────────────────┐
│ 📚 Suas Provas                                  │
├─────────────────────────────────────────────────┤
│                                                 │
│    ┌─────────────────────────────────────────┐  │
│    │       📅                                │  │
│    │                                         │  │
│    │   Cadastre suas provas para            │  │
│    │   acompanhar seu progresso              │  │
│    │                                         │  │
│    │   [+ Adicionar primeira prova]          │  │
│    └─────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Layout Atualizado do Dashboard

### Desktop (1280+)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Header: Central de Progresso • IES • Semestre                        │
├───────────────────────────────────────┬──────────────────────────────┤
│ [Risk Alert Banner - se houver]       │                              │
├───────────────────────────────────────┤                              │
│                                       │   📚 SUAS PROVAS             │
│ Hero Card (2/3 width)                 │   (ExamTrackerCard)          │
│                                       │                              │
├────────────────────┬──────────────────┤   - Prova Anatomia (5d)      │
│ NextActionsCard    │ ConsistencyCard  │   - Prova Farmaco (12d)      │
│                    │                  │   - Prova Fisio (20d)        │
├────────────────────┼──────────────────┤                              │
│ DiagnosticsCard    │ CoverageRanking  │   [+ Adicionar]              │
│                    │                  │                              │
├────────────────────┼──────────────────┤                              │
│ WeeklyEvolution    │ SpacedRevision   │                              │
│                    │                  │                              │
├────────────────────┴──────────────────┤                              │
│ Filtros + Mapa do Semestre            │                              │
│                                       │                              │
└───────────────────────────────────────┴──────────────────────────────┘
```

### Mobile

No mobile, `ExamTrackerCard` fica **logo após o Hero Card**:

```text
┌─────────────────────────────┐
│ Header                      │
│ Hero Card                   │
│ 📚 Suas Provas (collapsed)  │  ← Expande ao tocar
│ NextActionsCard             │
│ ConsistencyCard             │
│ ...                         │
└─────────────────────────────┘
```

---

## Mudanças Técnicas

### Arquivos a Criar

| Arquivo | Propósito |
|---------|-----------|
| `supabase/migrations/XXXX_create_user_exams.sql` | Tabela de provas do usuário |
| `src/components/progress-hub/ExamTrackerCard.tsx` | Card principal sempre visível |
| `src/components/progress-hub/AddExamModal.tsx` | Modal para adicionar prova |
| `src/components/progress-hub/ExamItem.tsx` | Linha individual de prova |
| `src/hooks/useUserExams.ts` | Hook para CRUD de provas |

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Dashboard.tsx` | Novo layout 2 colunas com ExamTrackerCard fixo à direita |
| `src/types/progressHub.ts` | Adicionar `UserExam` e `ExamInsight` types |
| `src/components/progress-hub/index.ts` | Exportar novos componentes |
| `supabase/functions/get-progress-hub/index.ts` | Retornar `user_exams` no payload |

### Arquivos a Remover/Deprecar

| Arquivo | Ação |
|---------|------|
| `src/components/progress-hub/PreProvaMode.tsx` | Substituído por `ExamTrackerCard` |
| `src/components/progress-hub/ExamCountdownCard.tsx` | Substituído por `ExamTrackerCard` |

---

## Novos Types

```typescript
// src/types/progressHub.ts

export interface UserExam {
  id: string;
  user_id: string;
  materia: string;
  exam_name: string;
  exam_date: string; // ISO date
  created_at: string;
}

export interface ExamInsight {
  exam: UserExam;
  materia_progress: MateriaProgress | null;
  days_remaining: number;
  lessons_remaining: number;
  lessons_per_day: number;
  quizzes_completed: number;
  status: 'critical' | 'warning' | 'on_track' | 'excellent';
  message: string;
  cta_label: string;
  cta_action: 'study' | 'review' | 'finish';
}

// Atualizar ProgressHubData
export interface ProgressHubData {
  // ...existing fields
  user_exams: ExamInsight[]; // NOVO
}
```

---

## Hook: `useUserExams`

```typescript
// src/hooks/useUserExams.ts

export function useUserExams() {
  const { user } = useAuth();
  
  const [exams, setExams] = useState<UserExam[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch exams
  const fetchExams = async () => {
    const { data, error } = await supabase
      .from('user_exams')
      .select('*')
      .eq('user_id', user?.id)
      .gte('exam_date', new Date().toISOString().split('T')[0])
      .order('exam_date', { ascending: true });
    
    if (!error) setExams(data || []);
    setLoading(false);
  };
  
  // Add exam
  const addExam = async (materia: string, examName: string, examDate: string) => {
    const { data, error } = await supabase
      .from('user_exams')
      .insert({
        user_id: user?.id,
        materia,
        exam_name: examName || 'Prova',
        exam_date: examDate
      })
      .select()
      .single();
    
    if (!error && data) {
      setExams(prev => [...prev, data].sort((a, b) => 
        new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime()
      ));
      toast.success('Prova adicionada!');
    }
    
    return { data, error };
  };
  
  // Remove exam
  const removeExam = async (examId: string) => {
    const { error } = await supabase
      .from('user_exams')
      .delete()
      .eq('id', examId);
    
    if (!error) {
      setExams(prev => prev.filter(e => e.id !== examId));
      toast.success('Prova removida');
    }
    
    return { error };
  };
  
  // Edit exam
  const updateExam = async (examId: string, updates: Partial<UserExam>) => {
    const { error } = await supabase
      .from('user_exams')
      .update(updates)
      .eq('id', examId);
    
    if (!error) {
      setExams(prev => prev.map(e => e.id === examId ? { ...e, ...updates } : e));
    }
    
    return { error };
  };
  
  return {
    exams,
    loading,
    addExam,
    removeExam,
    updateExam,
    refresh: fetchExams
  };
}
```

---

## Lógica de Insights (Detalhada)

```typescript
// Dentro de ExamTrackerCard.tsx ou useUserExams.ts

const calculateInsight = (exam: UserExam, materiaProgress: MateriaProgress | null): ExamInsight => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const examDate = new Date(exam.exam_date);
  examDate.setHours(0, 0, 0, 0);
  
  const daysRemaining = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  // Sem dados de progresso
  if (!materiaProgress) {
    return {
      exam,
      materia_progress: null,
      days_remaining: daysRemaining,
      lessons_remaining: 0,
      lessons_per_day: 0,
      quizzes_completed: 0,
      status: daysRemaining <= 7 ? 'critical' : 'warning',
      message: 'Você ainda não começou esta matéria',
      cta_label: 'Começar a estudar',
      cta_action: 'study'
    };
  }
  
  const lessonsRemaining = materiaProgress.total - materiaProgress.completed;
  const lessonsPerDay = daysRemaining > 0 ? lessonsRemaining / daysRemaining : lessonsRemaining;
  const percentage = materiaProgress.percentage;
  
  let status: ExamInsight['status'];
  let message: string;
  let ctaLabel: string;
  let ctaAction: ExamInsight['cta_action'];
  
  if (percentage >= 90) {
    status = 'excellent';
    message = '🎯 Quase lá! Foque na revisão final';
    ctaLabel = 'Revisar';
    ctaAction = 'review';
  } else if (percentage >= 70 || (daysRemaining > 14 && lessonsPerDay <= 2)) {
    status = 'on_track';
    message = '✅ Bom ritmo! Continue assim';
    ctaLabel = 'Continuar';
    ctaAction = 'study';
  } else if (daysRemaining <= 7 && percentage < 50) {
    status = 'critical';
    message = `⚠️ Atenção! ${Math.ceil(lessonsPerDay)} aulas/dia necessárias`;
    ctaLabel = 'Acelerar';
    ctaAction = 'study';
  } else {
    status = 'warning';
    message = `📊 Mantenha o foco. ${lessonsRemaining} aulas restantes`;
    ctaLabel = 'Estudar';
    ctaAction = 'study';
  }
  
  return {
    exam,
    materia_progress: materiaProgress,
    days_remaining: daysRemaining,
    lessons_remaining: lessonsRemaining,
    lessons_per_day: lessonsPerDay,
    quizzes_completed: 0, // TODO: fetch from quiz data if available
    status,
    message,
    cta_label: ctaLabel,
    cta_action: ctaAction
  };
};
```

---

## Componente: ExamTrackerCard

```typescript
// src/components/progress-hub/ExamTrackerCard.tsx

interface ExamTrackerCardProps {
  exams: ExamInsight[];
  byMateria: MateriaProgress[];
  materiasList: string[];
  onAddExam: (materia: string, name: string, date: string) => Promise<any>;
  onRemoveExam: (examId: string) => Promise<any>;
  onNavigate: (materia: string) => void;
  loading?: boolean;
}

export const ExamTrackerCard: React.FC<ExamTrackerCardProps> = ({
  exams,
  byMateria,
  materiasList,
  onAddExam,
  onRemoveExam,
  onNavigate,
  loading
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  
  // Status colors
  const getStatusColor = (status: ExamInsight['status']) => {
    switch (status) {
      case 'critical': return 'border-l-red-500 bg-red-50 dark:bg-red-950/20';
      case 'warning': return 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20';
      case 'on_track': return 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20';
      case 'excellent': return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20';
    }
  };
  
  // ... render logic
};
```

---

## Critérios de Aceitação

- [ ] Card "Suas Provas" sempre visível no topo direito (desktop) ou após Hero (mobile)
- [ ] Sem switch de ativação — funcionalidade core sempre presente
- [ ] Usuário pode adicionar múltiplas provas com matéria + data
- [ ] Cada prova mostra countdown + progresso da matéria associada
- [ ] Insights inteligentes calculados (critical/warning/on_track/excellent)
- [ ] Deep link "Estudar X" navega para `/guia-estudos?materia=X`
- [ ] Dados persistidos no banco (`user_exams`)
- [ ] Estado vazio amigável com CTA para adicionar primeira prova
- [ ] Provas passadas automaticamente ocultadas (ou marcadas como "realizada")
- [ ] Editar/remover prova funcional
- [ ] Responsivo: coluna lateral no desktop, card expandível no mobile
- [ ] Light/dark mode impecável
- [ ] Zero regressões nos componentes existentes

---

## Migração de Dados

Para usuários que já têm `exam_date` no localStorage (`ExamCountdownCard`):

```typescript
// Em useUserExams.ts - executar uma vez
useEffect(() => {
  const migrateOldExamDate = async () => {
    const oldDate = localStorage.getItem('progress_hub_exam_date');
    if (!oldDate || !user?.id) return;
    
    // Criar uma prova genérica para a data antiga
    await addExam('Geral', 'Prova', oldDate);
    localStorage.removeItem('progress_hub_exam_date');
  };
  
  migrateOldExamDate();
}, [user?.id]);
```

---

## Ordem de Implementação

1. **Migração SQL** — Criar tabela `user_exams` com RLS
2. **Types** — Adicionar `UserExam` e `ExamInsight`
3. **Hook** — Criar `useUserExams` com CRUD
4. **Edge Function** — Incluir `user_exams` no payload de `get-progress-hub`
5. **Componentes** — `ExamTrackerCard`, `AddExamModal`, `ExamItem`
6. **Dashboard** — Novo layout com coluna lateral
7. **Remover** — `PreProvaMode.tsx`, `ExamCountdownCard.tsx`
8. **Migração** — Dados do localStorage para banco
9. **Testes** — QA completo

