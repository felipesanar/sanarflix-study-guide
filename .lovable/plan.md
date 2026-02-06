
# Plano de Refatoração Premium do Dashboard Analytics

## Resumo Executivo

### Diagnóstico Atual
O dashboard `/analytics` possui uma base sólida com 6 abas funcionais e componentes modulares (MetricCard, InsightBox, EmptyState), mas apresenta problemas críticos de confiabilidade dos dados:

**Dados Reais Disponíveis (Volume):**
- `users`: 5.342 registros
- `user_sessions`: 1.281 registros
- `page_views`: 2.352 registros
- `answer_progress`: 11.300 registros
- `simulados_iniciados`: 111 registros
- `simulados_finalizados`: 115 registros
- `analytics_events`: 265 registros
- `study_progress`: 3 registros (MUITO BAIXO)
- `aula_views`: 3 registros (MUITO BAIXO)
- `sanarclass_views`: 1 registro (MUITO BAIXO)

**IES Reais no Sistema:**
Fame, Famp, Integrado, B2C, Funepe, Claretiano, USCS, Unifeso, UEA, Barao de Maua, B2B (11 IES)

**Problema de Semestre 0:**
479 usuarios com semestre = 0 (dado invalido)

---

## Fase 0: Correções Críticas (P0)

### 1. ExportModal - Remover Mocks e Implementar Export Real

**Arquivo:** `src/components/analytics/ExportModal.tsx`

**Problema Atual:**
- Usa `mockExportData` hardcoded com dados falsos
- Download simulado com setTimeout, não baixa arquivo real
- Filtros não afetam dados reais

**Solução:**
- Criar função `fetchExportData()` que busca dados reais do Supabase
- Implementar export CSV real usando blob + download
- Respeitar todos os filtros ativos (dateRange, iesId)
- Estados: loading, error, empty, success
- Preview com amostra real (primeiras 20 linhas)
- Colunas do CSV: usuario_id, nome, email, ies_nome, semestre, total_sessoes, tempo_medio_sessao, page_views, simulados_iniciados, simulados_finalizados

### 2. AnalyticsFilters - Carregar IES Dinamicamente

**Arquivo:** `src/components/analytics/AnalyticsFilters.tsx`

**Problema Atual:**
- Lista hardcoded de cursos e universidades que não existem no sistema
- Filtros selecionados não afetam queries

**Solução:**
- Remover arrays hardcoded `courses` e `universities`
- Buscar IES da tabela `ies` dinamicamente
- Remover filtro de "Curso" (não existe no schema atual)
- Adicionar loading skeleton nos selects
- Tratar caso vazio ("Nenhuma IES encontrada")
- Manter filtro de dateRange funcional

### 3. useAnalyticsData - Aplicar Filtros em Todas as Queries

**Arquivo:** `src/hooks/useAnalyticsData.ts`

**Problema Atual:**
- `iesId` é passado como parametro mas ignorado em todas as funcoes fetch
- `dateRange` só afeta taxa de abandono de simulados
- Timezone usa UTC em vez de Brasil

**Solução:**
- Criar função utilitária `buildFilters(iesId, dateRange)`
- Aplicar filtros em TODAS as funções:
  - `fetchOverviewMetrics`: filtrar por ies_id em user_sessions, page_views, simulados
  - `fetchEngagementMetrics`: filtrar por ies_id e dateRange
  - `fetchProgressMetrics`: filtrar por ies_nome em study_progress
  - `fetchDemographicsMetrics`: filtrar por iesId quando selecionado
  - `fetchSimuladoMetrics`: filtrar por dateRange em iniciados/finalizados
- Usar `getBrazilDate()` em vez de `new Date()` para consistência de timezone

---

## Fase 1: Qualidade de Dados (P1)

### 4. Tratamento de Semestre 0

**Arquivos:** `src/components/analytics/RealDemographicsTab.tsx`, `src/hooks/useAnalyticsData.ts`

**Problema:**
479 usuarios com semestre = 0 (invalido), distorce graficos

**Solução:**
- Na query de `fetchDemographicsMetrics`, tratar semestre 0 como "Nao informado"
- Exibir como categoria separada no gráfico de pizza
- Adicionar toggle opcional "Incluir não informados"
- Insight automatico quando > 10% da base tem semestre 0

### 5. Timezone Brasil Consistente

**Arquivo:** `src/hooks/useAnalyticsData.ts`

**Problema:**
- `const hoje = new Date().toISOString().split('T')[0]` usa UTC
- Gráficos de horário de pico mostram horário errado

**Solução:**
- Importar e usar `getBrazilDate()` de `@/utils/timezone`
- Para buckets de hora, converter timestamps com `toBrazilDate()`
- Garantir que "hoje" significa hoje em Brasília

### 6. Seção "Saúde do Tracking" (Admin)

**Arquivo:** `src/components/analytics/RealOverviewTab.tsx` (nova seção)

**Problema:**
Tracking de study_progress, aula_views, sanarclass_views com volume muito baixo

**Solução:**
- Adicionar seção "Saúde do Tracking" na aba Overview
- Mostrar contagens por tabela nos últimos 7 dias
- Alertas visuais quando volume < 10 registros
- Explicação do motivo (tracking possivelmente não ativo)
- Link para investigação técnica

---

## Fase 2: Questões Problemáticas com Enunciado Real (P2)

### 7. JOIN com Tabela questoes_simulado

**Arquivo:** `src/hooks/useAnalyticsData.ts` (função `fetchSimuladoMetrics`)

**Problema:**
`enunciado: Questao ${questao_id.slice(0, 8)}...` - mostra ID truncado

**Solução:**
- Fazer JOIN com tabela `questoes_simulado` para buscar enunciado real
- Truncar enunciado em 50 caracteres com tooltip completo
- Fallback: "Enunciado indisponivel" se não encontrar

---

## Fase 3: UI Premium e Interatividade

### 8. Loading States Granulares

**Arquivos:** Todas as abas Real*Tab.tsx

**Problema:**
Loading global afeta toda a página

**Solução:**
- Loading skeleton por seção/card
- Permitir ver dados já carregados enquanto outros carregam
- Error boundary por seção com botão de retry

### 9. DateRange Aplicado Universalmente

**Arquivo:** `src/hooks/useAnalyticsData.ts`

**Problema:**
DateRange só afeta taxa de abandono

**Solução:**
- Aplicar dateRange em TODAS as metricas temporais:
  - Sessões por dia
  - Page views
  - Horários de pico
  - Simulados iniciados/finalizados
  - SanarClass views
- Para métricas vitalícias (total usuários), exibir nota "Métrica vitalícia"

### 10. Responsividade Mobile-First

**Arquivos:** Todas as abas

**Problema:**
Gráficos podem ter labels sobrepostas em 375px

**Solução:**
- Eixos com abreviação inteligente
- Tabelas com sticky header + scroll horizontal
- Pie/donut com tamanho mínimo e legenda empilhada
- Testar em breakpoint 375px

### 11. Interatividade Premium

**Arquivos:** Gráficos Recharts em todas as abas

**Melhorias:**
- Tooltips ricos com número absoluto + percentual
- Legendas clicáveis para filtrar séries
- Hover suave com transições 150-250ms
- Animações fade-in leve (já usando Framer Motion no projeto)

---

## Arquivos a Modificar

| Arquivo | Modificações |
|---------|-------------|
| `src/components/analytics/ExportModal.tsx` | Remover mocks, implementar export CSV real |
| `src/components/analytics/AnalyticsFilters.tsx` | Carregar IES dinamicamente, remover hardcodes |
| `src/hooks/useAnalyticsData.ts` | Aplicar filtros em todas as queries, timezone Brasil |
| `src/components/analytics/RealOverviewTab.tsx` | Seção saúde do tracking, loading granular |
| `src/components/analytics/RealDemographicsTab.tsx` | Tratar semestre 0 |
| `src/components/analytics/RealSimuladosTab.tsx` | Enunciado real das questões |
| `src/components/analytics/RealEngagementTab.tsx` | Responsividade mobile |
| `src/components/analytics/RealProgressTab.tsx` | Loading granular |

---

## Critérios de Sucesso

- [ ] ExportModal exporta CSV com dados reais filtrados
- [ ] Filtro de IES carrega dinamicamente da tabela `ies`
- [ ] `iesId` e `dateRange` aplicados em TODAS as queries
- [ ] Timezone Brasil correto em gráficos e agregações
- [ ] Semestre 0 tratado como "Não informado"
- [ ] Questões problemáticas mostram enunciado real
- [ ] Loading granular por seção
- [ ] Mobile-first ok (375px)
- [ ] Zero erros no console
- [ ] Zero dados mockados

---

## Detalhes Técnicos

### Query para Export Real (exemplo)
```sql
SELECT 
  u.id as usuario_id,
  u.nome,
  u.email,
  i.nome as ies_nome,
  u.semestre,
  COUNT(DISTINCT s.id) as total_sessoes,
  COALESCE(AVG(s.duration_seconds)/60, 0) as tempo_medio_min,
  COUNT(DISTINCT pv.id) as page_views
FROM users u
LEFT JOIN ies i ON u.id_ies = i.id
LEFT JOIN user_sessions s ON u.id = s.user_id
LEFT JOIN page_views pv ON u.id = pv.user_id
WHERE (u.id_ies = :iesId OR :iesId IS NULL)
  AND (s.started_at >= :startDate OR :startDate IS NULL)
  AND (s.started_at <= :endDate OR :endDate IS NULL)
GROUP BY u.id, u.nome, u.email, i.nome, u.semestre
ORDER BY total_sessoes DESC
LIMIT 1000
```

### Estrutura do CSV Export
```
usuario_id,nome,email,ies_nome,semestre,total_sessoes,tempo_medio_min,page_views,simulados_iniciados,simulados_finalizados
uuid,Nome Completo,email@example.com,Fame,5,12,8.5,45,3,2
```

### Tratamento de Semestre 0
```typescript
const usuariosPorSemestre = Array.from(usuariosPorSemestreMap.entries())
  .map(([semestre, quantidade]) => ({ 
    semestre: semestre === 0 ? 'Não informado' : `${semestre}º`,
    quantidade 
  }))
```

---

## Ordem de Implementação

1. **Fase 0.1**: AnalyticsFilters - carregar IES dinamicamente
2. **Fase 0.2**: useAnalyticsData - aplicar iesId em todas as queries
3. **Fase 0.3**: useAnalyticsData - aplicar dateRange universalmente
4. **Fase 0.4**: useAnalyticsData - corrigir timezone Brasil
5. **Fase 0.5**: ExportModal - implementar export CSV real
6. **Fase 1.1**: RealDemographicsTab - tratar semestre 0
7. **Fase 1.2**: RealOverviewTab - seção saúde do tracking
8. **Fase 2.1**: fetchSimuladoMetrics - JOIN para enunciado real
9. **Fase 3.1**: Loading states granulares em todas as abas
10. **Fase 3.2**: Responsividade mobile-first
