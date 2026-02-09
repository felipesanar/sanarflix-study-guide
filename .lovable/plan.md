

# Plano: Redesenho da Aba Progresso do Analytics

## Diagnóstico do Problema Atual

### Problemas Identificados

1. **Taxa de Conclusão Enganosa**
   - Atualmente calcula: `concluidos / registros em study_progress`
   - Exemplo: Se um usuário marcou 5 aulas como concluídas de 354 disponíveis, e todas essas 5 estão como `completed=true`, a taxa mostra 100% - completamente errado

2. **Sem Comparação com Conteúdo Total**
   - Tabela `conteudos` tem 4.641 aulas cadastradas
   - A lógica atual ignora completamente esse dado
   - Deveria calcular: aulas concluídas pelo usuário / total de aulas disponíveis para o semestre/IES dele

3. **Filtro de Período Ignorado**
   - A query atual não usa `dateRange` dos filtros
   - Busca todos os registros de `study_progress` sem restrição de data

4. **Administradores Não Excluídos**
   - Diferente das outras abas, a aba Progresso não filtra usuários admin
   - Isso pode distorcer métricas

5. **Dados Escassos**
   - Apenas 17 registros em `study_progress` de 2 usuários
   - A aba precisa tratar melhor estados vazios e mostrar métricas alternativas

## Nova Arquitetura de Métricas

### Métricas Principais (Corrigidas)

| Métrica | Cálculo Atual (Errado) | Cálculo Proposto (Correto) |
|---------|------------------------|----------------------------|
| Taxa de Conclusão Geral | `completed / total em study_progress` | `SUM(aulas_concluídas por usuário) / SUM(aulas_disponíveis por semestre/IES)` |
| Progresso por Matéria | `completed / total por matéria em study_progress` | `aulas_concluídas da matéria / total_aulas_da_matéria em conteudos` |
| Usuários por Faixa | Baseado em registros `study_progress` | Baseado em aulas concluídas vs disponíveis |

### Novas Métricas Propostas

1. **Velocidade de Estudo**
   - Aulas concluídas por dia/semana no período selecionado
   - Gráfico de tendência temporal

2. **Matérias Mais/Menos Populares**
   - Ranking de matérias por volume de estudo (usuários únicos que interagiram)
   - Identificar matérias "esquecidas"

3. **Top Usuários Mais Ativos**
   - Usuários com maior volume de conclusão (anonimizado para LGPD)
   - Útil para gamificação e benchmarks

4. **Cobertura de Conteúdo**
   - % das aulas que foram acessadas por pelo menos um usuário
   - Identificar conteúdo "morto" que ninguém toca

5. **Progressão por Semestre**
   - Comparar progresso entre semestres diferentes
   - Identificar gargalos no currículo

## Fluxo de Dados Proposto

```text
ENTRADA:
  - dateRange: { start, end }
  - iesId: filtro de IES
  - excludedIES: IES excluídas

PROCESSAMENTO:

  1. Buscar admin IDs (para exclusão)

  2. Buscar usuários elegíveis:
     - Filtrar por IES se aplicável
     - Excluir admins
     - Coletar semestres de cada usuário

  3. Buscar conteúdos disponíveis:
     - Agrupar por IES + semestre + matéria
     - Contar total de aulas por grupo

  4. Buscar study_progress:
     - Filtrar por completed_at no dateRange
     - Filtrar por usuários elegíveis
     - Excluir admins

  5. Calcular métricas:
     - Para cada usuário: aulas_concluídas / aulas_disponíveis_semestre
     - Agregar por matéria
     - Calcular tendências temporais

SAÍDA:
  - taxaConclusaoReal: % correta
  - progressoPorMateria: com denominador do conteudos
  - velocidadeEstudo: aulas/semana
  - materiasPopulares: ranking
  - coberturaConteudo: % acessado
```

## Novo Layout da Aba

### Seção 1: Visão Geral (Métricas Corrigidas)

```text
+------------------------------------------------------------------+
| 📊 Visão Geral de Progresso                                      |
| Taxa de conclusão real baseada no conteúdo disponível            |
+------------------------------------------------------------------+
| ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐   |
| │     12.5%        │ │      45         │ │     2.3/sem      │   |
| │ Taxa de Conclusão│ │ Usuários Ativos │ │ Veloc. de Estudo │   |
| │ ████░░░░░░░░░░░░ │ │  com progresso  │ │   aulas/semana   │   |
| └──────────────────┘ └──────────────────┘ └──────────────────┘   |
+------------------------------------------------------------------+
```

### Seção 2: Tendência Temporal (NOVA)

```text
+------------------------------------------------------------------+
| 📈 Velocidade de Estudo                                          |
| Conclusões de aulas ao longo do período selecionado              |
+------------------------------------------------------------------+
|                                                                   |
|   [Gráfico de Linha: conclusões por dia]                         |
|   ▲                                                               |
|   │     ⋅⋅⋅⋅⋅                                                    |
|   │   ⋅⋅     ⋅⋅                                                  |
|   │  ⋅        ⋅⋅⋅                                                |
|   └────────────────────────▶                                      |
|   Jan 01   Jan 07   Jan 14   Jan 21   Jan 28                     |
|                                                                   |
+------------------------------------------------------------------+
```

### Seção 3: Progresso por Matéria (Grid lado a lado)

```text
+---------------------------+  +----------------------------+
| 📚 Progresso por Matéria |  | 🔥 Matérias Mais Populares |
| vs conteúdo disponível   |  | Por volume de usuários     |
+---------------------------+  +----------------------------+
|                           |  |                            |
|  [BarChart horizontal]    |  | 1. Anatomia      45 users  |
|  Anatomia     ██████  15% |  | 2. Fisiologia    38 users  |
|  Fisiologia   ████    10% |  | 3. Cirurgia      32 users  |
|  Cirurgia     ██      5%  |  | 4. Pediatria     28 users  |
|  ...                      |  | 5. Clínica Méd.  25 users  |
|                           |  |                            |
+---------------------------+  +----------------------------+
```

### Seção 4: Distribuição e Cobertura

```text
+---------------------------+  +----------------------------+
| 👥 Usuários por Faixa     |  | 🎯 Cobertura de Conteúdo   |
| (Progresso Real)          |  | Aulas que foram acessadas  |
+---------------------------+  +----------------------------+
|                           |  |                            |
|  [PieChart Donut]         |  | 847 de 4.641 aulas         |
|                           |  |                            |
|  ● 0-25%:   120 users     |  |  ████████░░░░░░░ 18.2%    |
|  ● 25-50%:   45 users     |  |                            |
|  ● 50-75%:   12 users     |  | ⚠️ 82% do conteúdo nunca  |
|  ● 75-100%:   3 users     |  |    foi acessado            |
|                           |  |                            |
+---------------------------+  +----------------------------+
```

### Seção 5: Insights Inteligentes

```text
+------------------------------------------------------------------+
| ⚡ Insights de Progresso                                          |
| Padrões identificados e recomendações                            |
+------------------------------------------------------------------+
| ┌────────────────────────────────┐ ┌────────────────────────────┐ |
| │ 🔴 3 matérias sem acessos      │ │ 🟢 Anatomia em alta        │ |
| │ Embriologia, Bioquímica e      │ │ 15 conclusões na última    │ |
| │ Direitos Humanos não foram     │ │ semana, +200% vs anterior  │ |
| │ acessadas no período           │ │                            │ |
| │ 💡 Revisar visibilidade        │ │                            │ |
| └────────────────────────────────┘ └────────────────────────────┘ |
+------------------------------------------------------------------+
```

## Secao Tecnica

### Arquivos a Modificar

1. **`src/hooks/useAnalyticsData.ts`** - `fetchProgressMetrics`
   - Adicionar filtro de dateRange
   - Excluir admins
   - Join com `conteudos` para calcular taxa real
   - Novas métricas: velocidade, cobertura, popularidade

2. **`src/hooks/useAnalyticsData.ts`** - `ProgressMetrics` interface
   - Adicionar novos campos:
   ```typescript
   interface ProgressMetrics {
     // Existentes (corrigidos)
     progressoMedioPorMateria: { 
       materia: string; 
       progresso: number; 
       aulasDisponiveis: number;
       aulasConcluidas: number;
     }[];
     usuariosPorFaixaProgresso: { faixa: string; quantidade: number }[];
     taxaConclusaoConteudo: number;
     
     // Novos
     velocidadeEstudo: {
       aulasUltimaSemana: number;
       aulasSemanaAnterior: number;
       tendencia: 'up' | 'down' | 'stable';
       porDia: { data: string; conclusoes: number }[];
     };
     materiasPopulares: {
       materia: string;
       usuariosUnicos: number;
       totalConclusoes: number;
     }[];
     coberturaConteudo: {
       aulasAcessadas: number;
       totalAulas: number;
       percentual: number;
     };
     usuariosComProgresso: number;
   }
   ```

3. **`src/components/analytics/RealProgressTab.tsx`**
   - Redesenho completo da UI
   - Novo gráfico de tendência temporal
   - Seção de cobertura de conteúdo
   - Seção de matérias populares
   - Insights corrigidos

### Lógica de Cálculo Correta

```typescript
// 1. Taxa de Conclusão Real
// Para cada usuário:
//   - Buscar semestre e IES do usuário
//   - Contar aulas disponíveis em `conteudos` para esse semestre/IES
//   - Contar aulas concluídas em `study_progress` para esse usuário
//   - progresso_usuario = concluidas / disponiveis

// 2. Taxa Geral
const taxaGeral = soma(progressos_usuarios) / total_usuarios;

// 3. Por Matéria
// Para cada matéria:
//   - Contar total de aulas em `conteudos` para essa matéria (filtrado por IES)
//   - Contar conclusões em `study_progress` para essa matéria
//   - progresso_materia = concluidas / disponiveis

// 4. Velocidade
const aulasUltimaSemana = study_progress
  .filter(p => p.completed_at >= 7diasAtras && p.completed)
  .length;
```

### Performance

- Queries em paralelo (Promise.all)
- Cache de conteúdos por IES (evitar rebuscar)
- Paginação se `study_progress` crescer muito

### Tratamento de Estados Vazios

Se não houver dados:
- Mostrar métricas zeradas com contexto explicativo
- Highlight de cobertura de conteúdo (mesmo sem conclusões, mostrar quanto conteúdo existe)
- Call-to-action para incentivar uso do Guia de Estudos

## Entregáveis

1. Atualizar interface `ProgressMetrics` com novos campos
2. Reescrever `fetchProgressMetrics` com:
   - Exclusão de admins
   - Filtro de período
   - Join com `conteudos`
   - Novas métricas
3. Redesenhar `RealProgressTab.tsx` com:
   - Métricas corrigidas
   - Gráfico de tendência temporal
   - Seção de cobertura
   - Seção de popularidade
   - Insights inteligentes

