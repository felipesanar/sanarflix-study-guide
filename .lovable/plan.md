
# Plano: Auditoria e Melhorias da Aba Progresso do Analytics

## 1. Resumo Executivo

Este plano aborda uma auditoria completa e melhorias de UI/UX para a aba "Progresso" do dashboard de Analytics, corrigindo problemas de integridade de dados e elevando a experiência visual ao padrão premium das outras abas.

---

## 2. Auditoria de Dados - Problemas Identificados

### 2.1 Problema Critico: Incompatibilidade de IDs

| Tabela | Campo | Formato | Exemplo |
|--------|-------|---------|---------|
| `study_progress` | `content_id` | ID composto (string) | `"1-Anatomia do Aparelho locomotor-null-Sistema articular-Artrologia"` |
| `conteudos` | `id` | UUID | `"7103fe69-1791-486e-b919-2f79938723dc"` |

**Impacto**: A metrica de "Cobertura de Conteudo" esta calculando `content_id` unicos de `study_progress` vs total de linhas em `conteudos`. Esses IDs NAO batem - sao formatos completamente diferentes.

**Solucao**: Recalcular cobertura usando JOIN por atributos (`materia_id` + `aula` ou normalizar os IDs).

### 2.2 Problema: Incompatibilidade de Tipos de Semestre

| Tabela | Campo | Tipo | Valores |
|--------|-------|------|---------|
| `users` | `semestre` | INTEGER | 0, 1, 2, 3... 12, 13, 14 |
| `conteudos` | `semestre` | TEXT | "1", "2", "INTERNATO", "0" |

**Impacto**: A comparacao `String(c.semestre) === String(userInfo.semestre)` pode falhar para valores como "INTERNATO" ou por diferencas de tipagem.

**Solucao**: Normalizar semestres criando um mapeamento (ex: 11, 12 = "INTERNATO") ou usar funcao de normalizacao.

### 2.3 Problema: Dados Escassos

- `study_progress`: Apenas **17 registros** de **2 usuarios**
- `conteudos`: **4.641 aulas** disponiveis
- Usuarios nao-admin: **5.334**

**Impacto**: Metricas mostram valores muito baixos (0-1%) que parecem "quebrados" quando na verdade refletem baixo uso.

**Solucao**: Adicionar contextualizacao e tratamento de estados com poucos dados.

### 2.4 Problema: Calculo de Taxa de Conclusao

A taxa atual calcula `totalConclusoes / totalPossivel` onde `totalPossivel` e a soma de aulas disponiveis por usuario. Porem:
- Usuarios com `semestre = 0` ou sem `id_ies` sao ignorados
- Usuarios no semestre 11/12 podem nao ter match com "INTERNATO"

**Solucao**: Tratar semestre 0 como "todos os semestres" ou excluir explicitamente.

---

## 3. Melhorias de UI/UX

### 3.1 Estrutura Atual vs Proposta

**ATUAL (5 secoes):**
1. KPIs em grid 4 colunas (sem MetricCard padrao)
2. Grafico de area temporal
3. BarChart horizontal + Lista ranking
4. PieChart + Card de cobertura
5. InsightBoxes

**PROPOSTO (6 secoes reorganizadas):**
1. **Hero Metrics** - 4 MetricCards padrao com interpretacoes contextuais
2. **Tendencia Temporal** - Area chart com granularidade ajustavel (dia/semana)
3. **Progresso por Materia** - BarChart comparativo com indicadores visuais
4. **Engajamento de Usuarios** - Distribuicao + Ranking em design unificado
5. **Cobertura de Conteudo** - Card dedicado com drill-down por materia
6. **Insights Inteligentes** - Engine de insights com priorizacao

### 3.2 Melhorias Especificas de UI

#### Cards KPI - Migrar para MetricCard

Atualmente usa Cards simples. Proposta: usar `MetricCard` igual a aba Overview:

```
+----------------------------------+
| [icone]              +12% 7d    |
|                                  |
| Taxa de Conclusao                |
| 2.3%                             |
| vs conteudo disponivel           |
|----------------------------------|
| [status] Valor baixo esperado    |
| para fase inicial. Benchmark: 15%|
+----------------------------------+
```

Beneficios:
- Consistencia visual com Overview
- Interpretacoes contextuais
- Indicadores de tendencia
- Estados de "dados indisponiveis"

#### Grafico Temporal - Melhorias

- Adicionar toggle de granularidade (dia vs semana vs mes)
- Adicionar linha de media movel
- Mostrar tooltip com comparativo vs periodo anterior
- Adicionar markers para picos/quedas significativas

#### Progresso por Materia - Melhorias

- Adicionar barra de "meta" (benchmark institucional)
- Cores graduais por faixa de progresso (vermelho < 25%, amarelo 25-50%, verde > 50%)
- Tooltip com numeros absolutos + contexto
- Opcao de ordenar por: progresso, alfabetico, volume de usuarios

#### Ranking de Materias - Melhorias

- Adicionar sparkline de tendencia
- Mostrar delta vs periodo anterior
- Destacar materias "em alta" e "em queda"
- Click para drill-down de detalhes

#### Cobertura de Conteudo - Melhorias

- Adicionar lista de "Materias nunca acessadas"
- Ring chart ao inves de progress bar simples
- Comparativo com benchmark

---

## 4. Novas Metricas Propostas

### 4.1 Metricas de Engajamento Profundo

| Metrica | Descricao | Calculo |
|---------|-----------|---------|
| Taxa de Ativacao | % usuarios que iniciaram progresso | `usuarios_com_progresso / total_usuarios` |
| Profundidade Media | Aulas concluidas por usuario ativo | `total_conclusoes / usuarios_com_progresso` |
| Taxa de Retorno | Usuarios com progresso em >1 dia | Distinct days per user |
| Time-to-First-Completion | Dias entre primeiro acesso e primeira conclusao | Diff entre datas |

### 4.2 Metricas de Conteudo

| Metrica | Descricao | Calculo |
|---------|-----------|---------|
| Content Discovery Rate | % materias com pelo menos 1 acesso | Distinct materia_id / total materias |
| Abandono por Materia | Materias iniciadas mas nao concluidas | Materias com progresso < 100% apos 30 dias |
| Materias Mortas | Materias sem nenhum acesso | Zero em study_progress |

---

## 5. Tratamento de Estados Especiais

### 5.1 Estado: Poucos Dados

Quando `usuarios_com_progresso < 5`:

```
+------------------------------------------+
| [icone hourglass]                        |
|                                          |
| Coletando Dados de Progresso             |
|                                          |
| O tracking esta ativo. Atualmente temos  |
| dados de 2 usuarios (0.04% da base).     |
|                                          |
| Os graficos serao populados conforme     |
| mais usuarios interagem com o Guia.      |
|                                          |
| [Previsao: ~30 dias para amostra         |
|  estatisticamente significativa]         |
+------------------------------------------+
```

### 5.2 Estado: Periodo Sem Atividade

Quando `porDia.length === 0` no periodo selecionado:

```
+------------------------------------------+
| [icone calendar-x]                       |
|                                          |
| Nenhuma conclusao no periodo             |
|                                          |
| Nao houve conclusoes de aulas entre      |
| 01/01/2026 e 31/01/2026.                 |
|                                          |
| [Sugestao: Ampliar periodo]   [30d] [90d]|
+------------------------------------------+
```

---

## 6. Arquivos a Modificar

### 6.1 `src/hooks/useAnalyticsData.ts`

**Mudancas na funcao `fetchProgressMetrics`:**

1. Corrigir logica de cobertura de conteudo:
```typescript
// ANTES: Contava content_ids que nao casam com conteudos
const aulasAcessadas = materiasAcessadas.size;

// DEPOIS: Contar por materia_id que existe em conteudos
const materiasComProgresso = new Set(progressData.map(p => p.materia_id));
const materiasDisponiveis = new Set(conteudosData.map(c => c.materia));
const coberturaMateria = {
  materiasAcessadas: [...materiasComProgresso].filter(m => materiasDisponiveis.has(m)).length,
  totalMaterias: materiasDisponiveis.size,
  percentual: Math.round((materiasComProgresso.size / materiasDisponiveis.size) * 100)
};
```

2. Normalizar semestres:
```typescript
const normalizeSemestre = (s: string | number | null): string => {
  if (s === null || s === undefined) return 'unknown';
  const sNum = typeof s === 'number' ? s : parseInt(String(s), 10);
  if (isNaN(sNum)) return String(s).toUpperCase(); // "INTERNATO"
  if (sNum >= 11 && sNum <= 12) return 'INTERNATO';
  return String(sNum);
};
```

3. Adicionar novas metricas:
```typescript
interface ProgressMetrics {
  // Existentes...
  
  // Novas
  taxaAtivacao: number;
  profundidadeMedia: number;
  materiasNuncaAcessadas: string[];
  diasComAtividade: number;
  usuariosMaisAtivos: { id: string; conclusoes: number; email: string }[];
}
```

### 6.2 `src/components/analytics/RealProgressTab.tsx`

**Mudancas principais:**

1. Substituir Cards simples por `MetricCard` com interpretacoes
2. Adicionar toggle de granularidade no grafico temporal
3. Melhorar BarChart com cores por faixa
4. Adicionar lista de materias nunca acessadas
5. Melhorar logica de insights com priorizacao
6. Adicionar estados especiais para poucos dados

### 6.3 Novos Componentes (opcionais)

- `ProgressGranularityToggle.tsx` - Toggle dia/semana/mes
- `MateriaDetailDrawer.tsx` - Drill-down de materia especifica
- `CoverageRingChart.tsx` - Ring chart para cobertura

---

## 7. Ordem de Implementacao

### Fase 1: Correcoes Criticas de Dados (Prioridade Alta)
1. Corrigir calculo de cobertura de conteudo
2. Normalizar comparacao de semestres
3. Adicionar tratamento de estados vazios

### Fase 2: Migracao para MetricCard (Prioridade Alta)
1. Substituir os 4 KPIs por MetricCard
2. Adicionar interpretacoes contextuais
3. Adicionar indicadores de tendencia

### Fase 3: Melhorias de Graficos (Prioridade Media)
1. Toggle de granularidade temporal
2. Cores por faixa no BarChart
3. Melhorias em tooltips

### Fase 4: Novas Metricas (Prioridade Media)
1. Taxa de ativacao
2. Materias nunca acessadas
3. Usuarios mais ativos (anonimizado)

### Fase 5: Insights Inteligentes (Prioridade Baixa)
1. Engine de priorizacao
2. Sugestoes de acao especificas
3. Benchmarks institucionais

---

## 8. Secao Tecnica

### Query de Cobertura Corrigida

```sql
-- Contar materias com progresso vs disponiveis
SELECT 
  (SELECT COUNT(DISTINCT materia_id) FROM study_progress WHERE completed = true) as materias_com_progresso,
  (SELECT COUNT(DISTINCT materia) FROM conteudos) as total_materias;
```

### Normalizacao de Content ID

O `content_id` em `study_progress` segue o padrao:
`{semestre}-{materia}-{tema}-{subtema}-{aula}`

Para cruzar com `conteudos`, extrair componentes:
```typescript
const parseContentId = (contentId: string) => {
  const parts = contentId.split('-');
  // Depende do formato exato, pode precisar de regex
  return { semestre: parts[0], materia: parts[1], ... };
};
```

### Performance

- Manter queries paralelas (Promise.all)
- Adicionar cache de materias disponiveis (staleTime: 5min)
- Limitar lista de "materias nunca acessadas" a 10 itens

---

## Entregaveis

1. Correcao de integridade nos calculos de cobertura e taxa
2. Migracao dos KPIs para MetricCard padrao
3. Estados especiais para baixo volume de dados
4. Novas metricas de engajamento (ativacao, profundidade)
5. Lista de materias nunca acessadas
6. Melhorias visuais em graficos e rankings
7. Engine de insights com priorizacao
