

# Plano: Filtro de Exclusão de IES no Analytics

## Objetivo

Adicionar a opção de visualizar **"Todas as IES EXCETO [selecionadas]"** no filtro de IES do dashboard de Analytics, permitindo análises que excluem instituições específicas (ex: excluir IES de teste, B2C, etc).

---

## Mudanças Necessárias

### 1. Atualizar Interface de Filtros

**Arquivo:** `src/pages/Analytics.tsx`

Adicionar novo campo `excludedIES` ao tipo `AnalyticsFilters`:

```typescript
export interface AnalyticsFilters {
  dateRange: { start: Date; end: Date };
  course: string;
  university: string;
  excludedIES: string[]; // NOVO: IES a excluir quando university = 'all'
  searchTerm: string;
}
```

### 2. Redesenhar o Componente de Filtro

**Arquivo:** `src/components/analytics/AnalyticsFilters.tsx`

**Nova UI:**
- Quando "Todas as IES" está selecionado, mostrar botão/toggle "Exceto..."
- Ao clicar, abre multi-select com checkboxes das IES disponíveis
- Mostrar badges das IES excluídas abaixo do filtro
- Cada badge tem botão X para remover da exclusão

**Mockup da UI:**

```text
┌─────────────────────────────────────────────────────────────┐
│  📅 01/01/25 - 06/02/25    │  🏛️ Todas as IES ▾  │ 🔍 Buscar │
└─────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                              ┌─────────────────────┐
                              │ ○ Todas as IES      │
                              │ ─────────────────── │
                              │ ○ Fame              │
                              │ ○ USCS              │
                              │ ○ Claretiano        │
                              │ ...                 │
                              │ ─────────────────── │
                              │ ☐ Excluir B2C       │
                              │ ☐ Excluir B2B       │
                              │ ☐ Excluir Barao...  │
                              └─────────────────────┘

[Quando IES excluídas estão ativas:]

┌──────────────────────────────────────────────────────────────┐
│ 🏷️ Filtros ativos                                            │
│ ┌──────────────────────┐  ┌──────────────────────┐           │
│ │ 🏛️ Exceto: B2C  ✕    │  │ 🏛️ Exceto: B2B  ✕    │           │
│ └──────────────────────┘  └──────────────────────┘           │
└──────────────────────────────────────────────────────────────┘
```

### 3. Propagar Exclusões para o Hook de Dados

**Arquivo:** `src/hooks/useAnalyticsData.ts`

**Mudanças:**
- Receber `excludedIES: string[]` nos filtros
- Criar helper `fetchUserIdsExcludingIES(excludedIds: string[])` que retorna IDs de usuários de TODAS as IES EXCETO as especificadas
- Modificar `filterParams` para incluir `excludedIESIds`
- Aplicar lógica: se `iesFilter` está definido, usar ele; senão, se `excludedIESIds.length > 0`, buscar todos EXCETO esses

**Lógica de filtragem:**

```typescript
const filterParams = useMemo(() => {
  const iesFilter = filters.iesId && filters.iesId !== 'all' ? filters.iesId : null;
  const excludedIESIds = filters.excludedIES || [];
  
  return { 
    iesFilter, 
    excludedIESIds,
    // ... resto
  };
}, [filters.iesId, filters.excludedIES, ...]);
```

**Na query de usuários:**

```typescript
// Se tem exclusões (e não tem filtro específico)
if (!iesFilter && excludedIESIds.length > 0) {
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .not('id_ies', 'in', `(${excludedIESIds.join(',')})`);
  userIdsFromIES = users?.map(u => u.id) || [];
}
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/Analytics.tsx` | Adicionar `excludedIES: string[]` ao tipo e estado inicial |
| `src/components/analytics/AnalyticsFilters.tsx` | Adicionar UI de exclusão com multi-select/checkboxes |
| `src/hooks/useAnalyticsData.ts` | Aplicar lógica de exclusão em todas as queries |

---

## Detalhes Técnicos

### Interface do Select com Exclusão

Usar o componente existente `Select` do Radix com customização:
- Separador visual entre "selecionar IES" e "excluir IES"
- Checkboxes na seção de exclusão (não radio buttons)
- Manter compatibilidade: selecionar uma IES específica limpa exclusões e vice-versa

### Query de Exclusão no Supabase

```typescript
// Excluir IES pelo ID usando .not()
const { data } = await supabase
  .from('users')
  .select('id')
  .not('id_ies', 'in', `(${excludedIds.map(id => `"${id}"`).join(',')})`);
```

### Estado Visual

- "Todas as IES" + nenhuma exclusão = Badge verde "Todos os dados"
- "Todas as IES" + exclusões = Badge "Filtros ativos" + badges de exclusão
- IES específica selecionada = Badge da IES (comportamento atual)

---

## Critérios de Sucesso

- [ ] Usuário pode selecionar IES a excluir do dropdown
- [ ] Múltiplas IES podem ser excluídas simultaneamente
- [ ] Badges mostram IES excluídas com botão X para remover
- [ ] Todas as abas refletem a exclusão (métricas diminuem)
- [ ] Selecionar uma IES específica limpa as exclusões
- [ ] Export CSV respeita as exclusões
- [ ] Performance mantida (sem queries adicionais desnecessárias)

