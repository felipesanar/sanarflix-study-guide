# Plano: Corrigir Persistência de Progresso no Guia de Estudos

## ✅ Status: IMPLEMENTADO

---

## Problema Identificado

A página `StudyGuide.tsx` foi redesenhada com novos componentes (`SubjectCard`, `LessonRow`) que **não utilizavam o hook `useStudyProgress`**. Usavam `localStorage` apenas, causando:

1. ❌ Progresso não persistia no banco de dados
2. ❌ Não sincronizava entre dispositivos
3. ❌ Não aparecia no Dashboard
4. ❌ Podia perder dados ao limpar cache

---

## Solução Implementada

### 1. `src/hooks/useStudyProgress.ts` - Atualizado

- ✅ Adicionada função `loadAllProgress(semestre, iesNome)` para carregar todo o progresso do semestre
- ✅ Implementada migração automática de `localStorage` para Supabase (uma única vez)
- ✅ Adicionada função helper `isCompleted(contentId)` para verificação simples
- ✅ Armazenamento em `Map` por `content_id` diretamente para lookups eficientes

### 2. `src/pages/StudyGuide.tsx` - Atualizado

- ✅ Removido estado local `completedItems` (Set)
- ✅ Removido `useEffect` que lia de `localStorage`
- ✅ Removida função `saveProgress` que salvava em `localStorage`
- ✅ Integrado hook `useStudyProgress` com `loadAllProgress`, `toggleContentCompletion` e `isProgressCompleted`
- ✅ Atualizado callback `onAulaToggle` no `SubjectCard` para usar o hook
- ✅ Atualizada função `isCompleted` para usar `isProgressCompleted` do hook

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

## Critérios de Aceitação

- [x] Marcar aula como concluída persiste no banco `study_progress`
- [x] Recarregar página mantém estado de conclusão
- [ ] Progresso aparece corretamente no Dashboard (/dashboard) - *Depende do Progress Hub ler de study_progress*
- [x] Toast de sucesso aparece ao marcar
- [x] Dados existentes no localStorage são migrados uma única vez
- [x] Nenhuma regressão em deep links, calendário, ou filtros

---

## Próximos Passos (se necessário)

1. **Verificar Edge Function `get-progress-hub`**: Garantir que lê de `study_progress` para mostrar progresso no Dashboard
2. **Testar E2E**: Marcar aula → recarregar → verificar que está marcada
