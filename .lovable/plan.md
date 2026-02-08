
# Auditoria do Preview de Dados - Exportação Analytics

## Problemas Identificados

### 1. **Questões: Valor INCORRETO (10 questões)**

**Problema:** O preview mostra `questoesMapeadas` que está pegando `data.simulados.questoesProblematicas.length`

```typescript
// exportAnalyticsReport.ts - linha 54
const questoesMapeadas = data.simulados.questoesProblematicas.length;
```

**Causa raiz:** O sistema busca apenas questões "problemáticas" (taxa erro >= 50%) e limita a **10 itens** (slice 0, 10):

```typescript
// useAnalyticsData.ts - linhas 700-708
.slice(0, 10)  // <-- LIMITADOR FIXO!
.map(([id]) => id);
```

**Isso NÃO representa o total de questões no sistema!** O label "Questões" sugere o total, mas mostra apenas as 10 piores.

**Correção:** Alterar para contar o TOTAL de questões dos simulados analisados.

---

### 2. **Sessões: Valor INCORRETO (1.000 sessões)**

**Problema:** O Supabase tem limite padrão de **1000 linhas** por query. O fetch de sessões NÃO usa paginação:

```typescript
// useAnalyticsData.ts - linhas 370-376
supabase.from('user_sessions')
  .select('started_at, duration_seconds, is_mobile')
  .gte('started_at', startDate)
  .lte('started_at', endDate)
  // SEM .limit() explícito = 1000 linhas padrão!
```

**Causa raiz:** O valor 1.000 exato indica truncamento pelo limite do Supabase.

**Correção:** Usar `count: 'exact'` separadamente ou implementar paginação com `.range()`.

---

### 3. **Ícones: Semanticamente incorretos**

| Métrica | Ícone Atual | Problema |
|---------|-------------|----------|
| Usuários | `Users` | OK |
| Sessões | `TrendingUp` | Incorreto - deveria ser algo como Clock ou Activity |
| Simulados | `BarChart3` | Incorreto - deveria ser algo como Target ou ClipboardList |
| Questões | `FileBarChart` | Incorreto - deveria ser algo como HelpCircle ou ListChecks |

---

### 4. **Posicionamento: Preview no final do modal**

O preview deveria aparecer ANTES da seleção de formato, dando contexto ao usuário sobre o que será exportado.

---

## Plano de Correção

### FASE 1: Corrigir Cálculo das Estatísticas

**1.1. Alterar `calculatePreviewStats` em `exportAnalyticsReport.ts`:**

```typescript
export function calculatePreviewStats(data: AnalyticsExportData): ExportPreviewStats {
  const totalUsuarios = data.overview.totalUsuarios;
  
  // Sessões: somar de sessoesPorDia (já é a soma processada)
  const sessoesNoPeriodo = data.engagement.sessoesPorDia.reduce((acc, d) => acc + d.sessoes, 0);
  
  // Simulados: quantidade de simulados disponíveis
  const simuladosAnalisados = data.simulados.simuladosDisponiveis.length;
  
  // CORREÇÃO: Total de questões de TODOS os simulados, não só problemáticas
  const questoesMapeadas = data.simulados.simuladosDisponiveis.reduce(
    (acc, s) => acc + s.total_questoes, 
    0
  );
  
  // Registros totais: soma de todas as métricas
  const registrosTotais = 
    totalUsuarios + 
    sessoesNoPeriodo + 
    data.engagement.pageViewsPorPagina.reduce((acc, p) => acc + p.views, 0) +
    data.simulados.simuladosDisponiveis.reduce((acc, s) => acc + s.iniciados + s.finalizados, 0);

  return {
    totalUsuarios,
    sessoesNoPeriodo,
    simuladosAnalisados,
    questoesMapeadas,
    registrosTotais,
  };
}
```

---

### FASE 2: Adicionar Contagem Precisa de Sessões via `count`

**2.1. Expor total real de sessões no hook:**

Adicionar uma query com `count: 'exact', head: true` para obter o número real de sessões sem o limite de 1000 linhas:

```typescript
// Em fetchEngagementMetrics ou overview
const { count: totalSessoesPeriodo } = await supabase
  .from('user_sessions')
  .select('*', { count: 'exact', head: true })
  .gte('started_at', startDate)
  .lte('started_at', endDate);
```

**2.2. Adicionar campo `totalSessoesPeriodo` em EngagementMetrics:**

```typescript
export interface EngagementMetrics {
  // ... existentes
  totalSessoesPeriodo: number; // NOVO: contagem real
}
```

**2.3. Atualizar `calculatePreviewStats` para usar o novo campo:**

```typescript
const sessoesNoPeriodo = data.engagement.totalSessoesPeriodo; // Usar count real
```

---

### FASE 3: Corrigir Ícones Semânticos

Atualizar os ícones no `ExportReportModal.tsx` para serem semanticamente corretos:

```typescript
import { 
  Users,           // Usuários - OK
  Activity,        // Sessões - representa atividade/uso
  Target,          // Simulados - representa provas/objetivos
  HelpCircle       // Questões - representa perguntas
} from 'lucide-react';

// No array de stats:
{[
  { icon: Users, label: 'Usuários', value: previewStats.totalUsuarios, color: 'text-blue-500' },
  { icon: Activity, label: 'Sessões', value: previewStats.sessoesNoPeriodo, color: 'text-emerald-500' },
  { icon: Target, label: 'Simulados', value: previewStats.simuladosAnalisados, color: 'text-violet-500' },
  { icon: HelpCircle, label: 'Questões', value: previewStats.questoesMapeadas, color: 'text-amber-500' },
]}
```

---

### FASE 4: Reposicionar Preview para o Topo

Mover a seção "Preview dos dados" para ANTES da seleção de formato no modal, dando contexto imediato ao usuário.

**Nova ordem:**
1. Header (Exportar Relatório)
2. **Preview dos dados** (movido para cima)
3. Filtros aplicados (Período, IES)
4. Seleção de formato
5. Footer (botões)

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/utils/exportAnalyticsReport.ts` | Corrigir `calculatePreviewStats` para usar `total_questoes` |
| `src/hooks/useAnalyticsData.ts` | Adicionar `totalSessoesPeriodo` com count real |
| `src/components/analytics/ExportReportModal.tsx` | Trocar ícones + reposicionar preview |

---

## Resultado Esperado

**Antes:**
- Questões: 10 (limitado pelo slice de questões problemáticas)
- Sessões: 1.000 (truncado pelo limite do Supabase)
- Ícones genéricos e confusos
- Preview escondido no final

**Depois:**
- Questões: ~1.200+ (soma real de todas as questões dos simulados)
- Sessões: 5.000+ (contagem real via `count: 'exact'`)
- Ícones semanticamente corretos (Activity, Target, HelpCircle)
- Preview visível no topo do modal

