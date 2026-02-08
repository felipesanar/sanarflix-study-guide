
# Plano de Correcao: Paginacao Completa e Exclusao de Admins no Analytics

## Problemas Identificados

### Problema 1: Total de Respostas Limitado a 1.000

**Localizacao:** `src/hooks/useAnalyticsData.ts` linhas 636-639

```typescript
// ATUAL - SEM paginacao (limite padrao de 1000 linhas)
useUserFilter && userIdsFromIES
  ? supabase.from('answer_progress').select('question_id, correct, user_id').in('user_id', userIdsFromIES)
  : supabase.from('answer_progress').select('question_id, correct, user_id')
```

**Evidencia:** A tabela `answer_progress` possui **22.000+ registros**, mas a query retorna apenas 1.000 (limite padrao do Supabase).

O hook `useSimuladosAnalytics.ts` JA implementa paginacao correta (linhas 273-309) com `fetchAllAnswerProgress`, mas o `useAnalyticsData.ts` NAO usa essa tecnica.

---

### Problema 2: Usuarios Admin NAO Excluidos

**Evidencia:** Existem **8 usuarios admin** na tabela `user_roles`:
- 86c38a5e-a43c-4e53-932e-bff888ac75b6
- 7299f7c2-9bb1-47ae-804a-4199522c4fc3
- c62a7e9a-0da5-4b5b-bf45-44f559ae5d46
- bb23becf-1d21-46bd-8a48-357a9807bbb3
- 70f1d617-0703-4e7b-a12a-88fce9c7ff36
- dc435ead-062c-4277-ae61-9d161bd560f0
- 6bbe275a-466c-48c6-a5dd-f307958145ed
- b920c8b5-3ba9-4380-9834-fad0fa4bcda4

**Impacto:** Todas as metricas (usuarios totais, sessoes, respostas de simulado, page views, etc.) incluem dados de admins, distorcendo os relatorios B2B.

**Correcao necessaria:** Excluir os IDs de admins de TODAS as queries de analytics:
- `fetchOverviewMetrics`
- `fetchEngagementMetrics`
- `fetchProgressMetrics`
- `fetchDemographicsMetrics`
- `fetchSimuladoMetrics`
- `fetchTrackingHealth`

E tambem no `useSimuladosAnalytics.ts`:
- Fase 2 (fetch de users)
- Filtro `allowedUserIds`

---

## Plano de Implementacao

### FASE 1: Adicionar Helper para Buscar IDs de Admins

**Arquivo:** `src/hooks/useAnalyticsData.ts`

Adicionar funcao helper para buscar os user_ids de usuarios com role 'admin':

```typescript
const fetchAdminUserIds = useCallback(async (): Promise<Set<string>> => {
  const { data } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin');
  return new Set(data?.map(r => r.user_id) || []);
}, []);
```

---

### FASE 2: Excluir Admins em Todas as Queries de useAnalyticsData

**2.1. Modificar `fetchUserIdsByIES` e `fetchUserIdsExcludingIES`:**

Adicionar parametro `excludeAdmins: Set<string>` e filtrar na resposta:

```typescript
const fetchUserIdsByIES = useCallback(async (iesId: string, excludeAdmins: Set<string>): Promise<string[]> => {
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('id_ies', iesId);
  return (users?.map(u => u.id) || []).filter(id => !excludeAdmins.has(id));
}, []);
```

**2.2. Aplicar exclusao em TODAS as queries:**

No inicio de `fetchOverviewMetrics`, `fetchEngagementMetrics`, etc:

```typescript
const adminIds = await fetchAdminUserIds();

// Em queries com count
const totalUsuariosQuery = iesFilter
  ? supabase.from('users').select('*', { count: 'exact', head: true })
      .eq('id_ies', iesFilter)
      .not('id', 'in', `(${Array.from(adminIds).join(',')})`)
  : // ...
```

---

### FASE 3: Implementar Paginacao para answer_progress em useAnalyticsData

**3.1. Criar helper de paginacao:**

```typescript
const fetchAllAnswerProgress = async (
  userFilter: string[] | null,
  adminIds: Set<string>
): Promise<{ question_id: string; correct: boolean; user_id: string }[]> => {
  const PAGE_SIZE = 1000;
  const all: { question_id: string; correct: boolean; user_id: string }[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('answer_progress')
      .select('question_id, correct, user_id')
      .order('answer_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (userFilter && userFilter.length > 0) {
      query = query.in('user_id', userFilter);
    }

    const { data: page, error } = await query;
    if (error) throw error;
    
    const rows = (page || []).filter(r => !adminIds.has(r.user_id));
    all.push(...rows);
    
    if ((page || []).length < PAGE_SIZE) {
      hasMore = false;
    } else {
      from += PAGE_SIZE;
    }
  }

  return all;
};
```

**3.2. Substituir a query atual em `fetchSimuladoMetrics`:**

```typescript
// ANTES (linha 636-639)
const respostasResult = useUserFilter && userIdsFromIES
  ? supabase.from('answer_progress').select('question_id, correct, user_id').in('user_id', userIdsFromIES)
  : supabase.from('answer_progress').select('question_id, correct, user_id')

// DEPOIS
const respostasData = await fetchAllAnswerProgress(
  useUserFilter && userIdsFromIES ? userIdsFromIES : null,
  adminIds
);
```

---

### FASE 4: Excluir Admins em useSimuladosAnalytics

**Arquivo:** `src/hooks/useSimuladosAnalytics.ts`

**4.1. Buscar admin IDs no inicio de `fetchData`:**

```typescript
const { data: adminRoles } = await supabase
  .from('user_roles')
  .select('user_id')
  .eq('role', 'admin');
const adminIds = new Set((adminRoles || []).map(r => r.user_id));
```

**4.2. Filtrar admins ao construir `allowedUserIds` (linha 381-390):**

```typescript
const allowedUserIds = new Set(
  eventUserIds.filter(uid => {
    if (adminIds.has(uid)) return false; // NOVA LINHA: excluir admins
    const u = userById.get(uid);
    if (!u) return false;
    if (iesId && u.id_ies !== iesId) return false;
    if (excludedIES?.length > 0 && u.id_ies && excludedIES.includes(u.id_ies)) return false;
    if (semestre && u.semestre !== semestre) return false;
    return true;
  })
);
```

---

### FASE 5: Atualizar Exports para Refletir Dados Corretos

Os arquivos de exportacao ja usam os dados processados pelos hooks, entao automaticamente refletirao os valores corretos apos as correcoes acima.

Garantir que a label "Total de Respostas" no XLSX exiba o valor real (22.000+) em vez de 1.000.

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useAnalyticsData.ts` | Adicionar `fetchAdminUserIds`, paginacao de respostas, excluir admins em todas as queries |
| `src/hooks/useSimuladosAnalytics.ts` | Adicionar exclusao de admins em `allowedUserIds` |

---

## Resultado Esperado

**Antes:**
- Total de Respostas: 1.000 (truncado)
- Usuarios incluem admins
- Sessoes incluem admins
- Desempenho de simulado inclui dados de teste de admins

**Depois:**
- Total de Respostas: 22.000+ (real)
- Usuarios: somente alunos B2B (sem admins)
- Sessoes: somente de alunos (sem admins)
- Metricas pedagogicas limpas, sem distorcao de dados de teste

---

## Nota Tecnica: Performance

A paginacao sequencial adicionara latencia (~100-200ms por pagina de 1000 registros). Para 22.000 registros, serao ~22 iteracoes = 2-4 segundos adicionais.

Mitigacao: O hook `useSimuladosAnalytics` ja usa cache de 5 minutos (SWR pattern), e o `useAnalyticsData` mantem estado local. O impacto sera notado apenas no primeiro carregamento ou refresh manual.
