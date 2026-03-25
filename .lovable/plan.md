

# Plano: Finalização da Página Desempenho Institucional

## Estado Atual

A arquitetura já está funcional e bem estruturada:
- 3 RPCs (`get_institutional_performance`, `get_institutional_student_scores`, `get_institutional_evolution`) alimentam o hook `useInstitutionalPerformanceData`
- `mapInstitutionalRpcToViewModel` centraliza toda transformação
- `applyDesempenhoV2Filters` aplica filtros client-side sobre o ViewModel
- Todas as 5 abas já consomem o mesmo objeto `InstitutionalViewModel`
- Filtros são gerenciados em `useDesempenhoV2State` com URL sync

## Problemas Identificados

1. **Mock fallback silencioso**: quando há sessão autenticada mas RPC falha, o sistema cai para mock sem sinalizar claramente ao gestor
2. **Sem retry automático**: falhas de rede não são recuperadas
3. **Sem debug mode**: não há como validar dados raw vs. mapeados
4. **Duplicate key warning**: `InteligenciaDecisoriModule` gera keys duplicadas (console log confirma)
5. **`applyDesempenhoV2Filters` filtra apenas `alunosAbaixo`**: deveria filtrar todos os alunos, não apenas os abaixo do limiar
6. **Sem debounce na busca de alunos** (VisaoAlunosModule)

## Fases de Implementação

### Fase 1: Blindar o hook de dados (sem mock silencioso)

**Arquivo**: `src/hooks/useInstitutionalPerformanceData.ts`

- Remover fallback para mock quando há sessão autenticada e erro real de RPC. Apenas usar mock quando não há sessão.
- Adicionar retry com backoff (usando `withRetry` de `src/utils/networkRetry.ts` que já existe)
- Adicionar timeout de segurança (15s) para não travar em loading infinito
- Logs prefixados: `[DesempenhoInstitucional]`

### Fase 2: Criar service layer isolado

**Novo arquivo**: `src/services/institutional.ts`

- `fetchInstitutionalPerformance(simuladoId, iesId)` → chama RPC com retry
- `fetchStudentScores(simuladoId, iesId)` → chama RPC com retry
- `fetchEvolution(iesId)` → chama RPC com retry
- Cada função encapsula `supabase.rpc()` + tratamento de erro + tipagem

O hook passa a consumir essas funções em vez de chamar `supabase.rpc()` diretamente.

### Fase 3: Guardrails de NaN/undefined na UI

**Arquivos**: todos os módulos em `src/components/analytics/v2/modules/`

- Criar helper `safePercent(value)` que retorna `0` se NaN/undefined
- Aplicar em todos os pontos que renderizam percentuais, totais e scores
- Corrigir duplicate key no `InteligenciaDecisoriModule` (usar `area+specialty+tema` como key)

### Fase 4: Debug mode (`?debug=true`)

**Arquivo**: `src/pages/DesempenhoInstitucionalV2.tsx`

- Ler `searchParams.get('debug')`
- Quando ativo, renderizar painel colapsável no topo mostrando:
  - JSON resumido dos dados raw (performance, evolution, scores)
  - JSON resumido do ViewModel mapeado
  - Contagem de alunos, áreas, temas
- Sem impacto visual quando desativado

### Fase 5: Performance (useMemo + debounce)

**Arquivos**: `VisaoAlunosModule.tsx`, `InsightsPedagogicosModule.tsx`, `InteligenciaDecisoriModule.tsx`

- Garantir que `buildInsights()`, `buildDecisionItems()`, listas filtradas estejam em `useMemo`
- Adicionar debounce de 300ms no campo de busca de alunos (`VisaoAlunosModule`)
- Verificar que `filteredData` no page-level já está em `useMemo` (confirmado)

### Fase 6: Consistência de filtros entre abas

**Arquivo**: `src/utils/desempenhoV2Filters.ts`

- O `applyStudentFilters` atualmente filtra `data.alunosAbaixo` — precisa receber e filtrar a lista completa de alunos (todos, não só abaixo). Ajustar para que os módulos de Visão de Alunos e Insights consumam a mesma lista filtrada.
- Garantir que trocar de aba não dispara refetch (já correto: só `simuladoId` e `iesId` disparam fetch)

## Detalhes Técnicos

```text
┌─────────────────────────────────────────────┐
│  services/institutional.ts (NEW)            │
│  fetchPerformance / fetchScores / fetchEvo  │
│  ↓ (with retry + timeout)                   │
├─────────────────────────────────────────────┤
│  hooks/useInstitutionalPerformanceData.ts   │
│  ↓ raw RPC data                             │
├─────────────────────────────────────────────┤
│  utils/mapInstitutionalData.ts              │
│  ↓ InstitutionalViewModel                   │
├─────────────────────────────────────────────┤
│  utils/desempenhoV2Filters.ts               │
│  ↓ filtered ViewModel                       │
├─────────────────────────────────────────────┤
│  ModuleContentRenderer → 5 abas             │
└─────────────────────────────────────────────┘
```

## Critérios de Aceite

- Nenhum fallback para mock quando usuário está autenticado
- Retry automático em falha de rede (até 3 tentativas)
- Nenhum NaN/undefined na interface
- Debug mode mostra dados raw vs. mapeados
- Filtros afetam todas as abas simultaneamente sem refetch
- Zero warnings de duplicate key no console

