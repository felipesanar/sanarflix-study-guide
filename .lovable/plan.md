
# Plano: Corrigir Persistência de Progresso no Guia de Estudos

## Problema Identificado

A página `StudyGuide.tsx` foi redesenhada com novos componentes (`SubjectCard`, `LessonRow`) que **não utilizam o hook `useStudyProgress`**. Em vez disso, usam um sistema local baseado em `Set<string>` + `localStorage`, que:

1. **Não persiste no banco de dados** — progresso salvo apenas no navegador local
2. **Não sincroniza entre dispositivos** — usuário perde progresso em outro navegador
3. **Não aparece no Dashboard** — pois o Dashboard lê da tabela `study_progress`
4. **Pode perder dados** — cache do navegador pode ser limpo

### Evidência

```typescript
// StudyGuide.tsx - Sistema ATUAL (quebrado)
const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

useEffect(() => {
  const stored = localStorage.getItem('study-progress'); // ❌ Só localStorage
  // ...
}, []);

const saveProgress = (items: Set<string>) => {
  localStorage.setItem('study-progress', JSON.stringify([...items])); // ❌ Não salva no Supabase
};
```

Enquanto existe o hook correto (`useStudyProgress`) que:
- Salva no Supabase (`study_progress`)
- Faz upsert com conflito correto
- Mostra toasts de sucesso
- Permite rollback otimista

---

## Solução Proposta

### Estratégia: Integrar o hook `useStudyProgress` no `SubjectCard`/`LessonRow`

Em vez de reescrever toda a página, vamos:
1. Adicionar o hook `useStudyProgress` no nível do `StudyGuide.tsx`
2. Carregar progresso do Supabase ao iniciar
3. Substituir `completedItems`/`saveProgress` pelo hook
4. Manter compatibilidade com o formato de IDs existente

---

## Mudanças Técnicas

### 1. `src/pages/StudyGuide.tsx`

**Adicionar import e hook:**
```typescript
import { useStudyProgress } from '@/hooks/useStudyProgress';

// Dentro do componente:
const { progress, loading: progressLoading, toggleContentCompletion, loadProgress } = useStudyProgress();
```

**Remover estado local de progresso (linhas 152, 206-223):**
```typescript
// REMOVER:
const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

// REMOVER useEffect de localStorage
// REMOVER função saveProgress
```

**Carregar progresso ao selecionar matéria:**
```typescript
useEffect(() => {
  if (user?.ies_nome && selectedSemestre && selectedMateria) {
    loadProgress(selectedMateria, parseInt(selectedSemestre), user.ies_nome);
  }
}, [selectedMateria, selectedSemestre, user?.ies_nome]);
```

**Atualizar função `isCompleted`:**
```typescript
const isCompleted = (item: ConteudoData) => {
  const key = `aula-${getAulaId(item)}-${item.materia}`;
  return progress.get(key) || false;
};
```

**Atualizar callback `onAulaToggle` em SubjectCard:**
```typescript
onAulaToggle={async (aulaId) => {
  await toggleContentCompletion(
    'aula',
    aulaId,
    selectedMateria || filteredMaterias[0]?.materia || '',
    parseInt(selectedSemestre),
    user?.ies_nome || ''
  );
}}
```

### 2. `src/hooks/useStudyProgress.ts`

**Ajustar formato do content_id para compatibilidade:**

O hook atual usa `content_id` como campo, mas o StudyGuide gera IDs compostos como:
`${semestre}-${materia}-${tema}-${subtema}-${aula}`

Precisamos garantir que o upsert use esse mesmo formato.

**Carregar progresso global (não apenas por matéria):**

Adicionar opção para carregar todo o progresso do usuário de uma vez:

```typescript
const loadAllProgress = async (semestre: number, iesNome: string) => {
  if (!user?.id) return;

  const { data, error } = await supabase
    .from('study_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('semestre', semestre)
    .eq('ies_nome', iesNome);

  if (!error && data) {
    const progressMap = new Map<string, boolean>();
    data.forEach((item: any) => {
      // Usar content_id diretamente como chave
      progressMap.set(item.content_id, item.completed);
    });
    setProgress(progressMap);
  }
};
```

### 3. Migração de Dados Existentes

Para não perder progresso já registrado no localStorage:
```typescript
// Ao carregar, mesclar localStorage com banco (uma única vez)
useEffect(() => {
  const migrateLocalStorageToSupabase = async () => {
    const stored = localStorage.getItem('study-progress');
    if (!stored || !user?.id) return;
    
    try {
      const items = JSON.parse(stored);
      if (Array.isArray(items) && items.length > 0) {
        // Fazer batch insert no Supabase
        const records = items.map(id => ({
          user_id: user.id,
          user_email: user.email,
          content_type: 'aula',
          content_id: id,
          materia_id: id.split('-')[1] || 'unknown',
          semestre: parseInt(id.split('-')[0]) || user.semestre || 1,
          ies_nome: user.ies_nome || '',
          completed: true,
        }));
        
        await supabase.from('study_progress').upsert(records, {
          onConflict: 'user_id,content_type,content_id,materia_id',
        });
        
        // Limpar localStorage após migração
        localStorage.removeItem('study-progress');
      }
    } catch (e) {
      console.error('Migration failed:', e);
    }
  };
  
  migrateLocalStorageToSupabase();
}, [user?.id]);
```

---

## Fluxo de Dados Corrigido

```text
Usuário clica em "Concluir Aula"
         │
         ▼
┌─────────────────────────────┐
│  toggleContentCompletion()  │
│  (useStudyProgress hook)    │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  1. Atualização otimista    │◀─┐
│     (UI fica verde)         │  │ Rollback se erro
└─────────────────────────────┘  │
         │                       │
         ▼                       │
┌─────────────────────────────┐  │
│  2. Upsert no Supabase      │──┘
│     (study_progress)        │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  3. Toast de confirmação    │
│     + CTA "Ver impacto"     │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  4. Dashboard atualizado    │
│     (lê de study_progress)  │
└─────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/StudyGuide.tsx` | Substituir localStorage pelo hook `useStudyProgress` |
| `src/hooks/useStudyProgress.ts` | Adicionar `loadAllProgress()` e migração de localStorage |
| `src/components/guia-estudos/SubjectCard.tsx` | Sem mudanças (já recebe callbacks) |
| `src/components/guia-estudos/LessonRow.tsx` | Sem mudanças (já recebe callbacks) |

---

## Critérios de Aceitação

- [ ] Marcar aula como concluída persiste no banco `study_progress`
- [ ] Recarregar página mantém estado de conclusão
- [ ] Progresso aparece corretamente no Dashboard (/dashboard)
- [ ] Toast de sucesso aparece ao marcar
- [ ] Dados existentes no localStorage são migrados uma única vez
- [ ] Nenhuma regressão em deep links, calendário, ou filtros
- [ ] Funciona offline com graceful degradation (fallback para localStorage)

---

## Esforço Estimado

**M (Medium)** — Refatoração de lógica de estado em 2 arquivos principais

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Perda de dados do localStorage | Migração automática antes de limpar |
| IDs incompatíveis entre sistemas | Usar o mesmo formato `semestre-materia-tema-subtema-aula` |
| Race conditions no upsert | onConflict já configurado na tabela |
| Usuário offline | Manter fallback para localStorage como cache secundário |
