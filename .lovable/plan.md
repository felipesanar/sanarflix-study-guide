
# Plano: Evolução Enterprise da Seção Jornada do Estudante

## Visão Geral

Transformar a seção "Jornada" de um dashboard básico em um **Analytics Engine de nível enterprise** com cruzamento avançado de dados, análise preditiva, segmentação comportamental e insights acionáveis automáticos.

## Dados Disponíveis para Cruzamento

Com base na exploração do banco, identificamos **15+ fontes de dados** que podem ser cruzadas:

| Fonte | Dados | Uso na Jornada |
|-------|-------|----------------|
| `analytics_events` | 1047 eventos, 14 tipos | Funil, comportamento |
| `user_sessions` | 1916 sessões, 7.8min média | Retenção, engagement |
| `page_views` | Views por página | Navegação, drop-offs |
| `study_progress` | Progresso por matéria | Correlação estudo x performance |
| `simulados_finalizados` | 220 conclusões | Conversão, tempo até ação |
| `answer_progress` | 22k respostas, 52% acerto | Performance pedagógica |
| `questoes_simulado` | 600 questões, 7 áreas | Gaps de conhecimento |
| `calendar_subjects` | 27 itens, 6 usuários | Engajamento profundo |
| `user_exams` | Provas cadastradas | Preparação ativa |
| `users` | Dados demográficos | Segmentação por semestre/IES |

## Arquitetura do Novo StudentJourneySection

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    JORNADA DO ESTUDANTE (Enterprise)                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────── EXECUTIVE SUMMARY ──────────────────────┐  │
│  │  [DAU] [WAU] [Stickiness] [Time to Value] [Churn Risk]        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────── JOURNEY FUNNEL ────────────────────────┐  │
│  │  Primeiro Acesso → Exploração → Engajamento →                 │  │
│  │  Consumo → Conversão (Simulado) → Retenção                    │  │
│  │  [Gráfico de Sankey ou Funil Visual Interativo]               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────── BEHAVIORAL SEGMENTS ──────────────┬──────────────┐  │
│  │  Cohorts:                                      │  Retention   │  │
│  │  • Power Users (7+ dias)                       │  Cohort Grid │  │
│  │  • Regulars (4-6 dias)                         │  [Week 0-4]  │  │
│  │  • Ocasionais (2-3 dias)                       │              │  │
│  │  • Churned (1 dia)                             │              │  │
│  └────────────────────────────────────────────────┴──────────────┘  │
│                                                                      │
│  ┌─────────────── LEARNING VELOCITY ─────────────┬──────────────┐  │
│  │  Acurácia por Grande Área                      │  Correlação  │  │
│  │  [Radar Chart 7 áreas]                         │  Estudo x    │  │
│  │  • Clínica Médica: 50%                         │  Performance │  │
│  │  • GO: 55.6%                                   │              │  │
│  │  • Cirurgia: 49.7%                             │              │  │
│  └────────────────────────────────────────────────┴──────────────┘  │
│                                                                      │
│  ┌─────── ENGAGEMENT DEPTH ──────┬─────── SMART INSIGHTS ───────┐  │
│  │  Session Depth Distribution    │  • 84% não usa calendário    │  │
│  │  [1pg] [2-3pg] [4-6pg] [7+pg]  │  • 15% visitou apenas 1 dia  │  │
│  │                                │  • GO tem +6% de acerto      │  │
│  │  Peak Hours Heatmap            │  • Cirurgia é gargalo        │  │
│  │  [Seg-Dom x 0-23h]             │                              │  │
│  └────────────────────────────────┴──────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────── RISK ALERTS ─────────────────────────────┐  │
│  │  🔴 42 usuários em risco de churn (1 visita nos últimos 14d)  │  │
│  │  🟡 Cirurgia e Saúde Mental abaixo de 50% acerto             │  │
│  │  🟢 Retenção semana 1: 79% voltaram pelo menos 2x            │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Componentes a Implementar

### 1. Executive Summary Cards (KPIs Avançados)

| Métrica | Cálculo | Fonte |
|---------|---------|-------|
| DAU/WAU/MAU | Usuários únicos por período | `user_sessions` |
| Stickiness (DAU/MAU) | Razão de engajamento | `user_sessions` |
| Time to First Simulado | Tempo entre 1ª sessão e 1º simulado | `user_sessions` + `simulados_finalizados` |
| Avg Session Depth | Páginas por sessão | `page_views` |
| Churn Risk Score | Usuários inativos | `user_sessions` |
| Calendar Adoption | % usando calendário | `calendar_subjects` |

### 2. Journey Funnel Avançado (6 Estágios)

```text
Estágio 1: Primeiro Acesso
  ↓ (users com 1ª sessão)
Estágio 2: Exploração (2+ páginas na sessão)
  ↓
Estágio 3: Engajamento (retornou no dia seguinte)
  ↓
Estágio 4: Consumo (acessou Guia ou SanarClass)
  ↓
Estágio 5: Conversão (completou 1 simulado)
  ↓
Estágio 6: Retenção (voltou após completar)
```

### 3. Retention Cohort Grid (Matriz de Retenção)

Tabela visual estilo Mixpanel/Amplitude mostrando:
- Linhas: Semanas de entrada (cohort)
- Colunas: Semanas subsequentes (W0, W1, W2, W3, W4)
- Células: % de retenção com cor gradiente (verde→vermelho)

### 4. Behavioral Segments

Segmentar automaticamente usuários em:
- **Power Users**: 7+ dias de acesso no período
- **Regulares**: 4-6 dias
- **Ocasionais**: 2-3 dias
- **Em Risco**: 1 dia apenas
- **Churned**: Sem acesso há 14+ dias

### 5. Learning Velocity (Performance Pedagógica)

- **Radar Chart**: Acurácia por Grande Área (7 eixos)
- **Correlação**: Cruzar `study_progress` com `answer_progress` para ver se quem estuda mais acerta mais
- **Gaps Identificados**: Top 3 áreas com menor acerto

### 6. Engagement Depth Analysis

- **Session Depth**: Distribuição de páginas por sessão
- **Time on Platform**: Tempo médio diário
- **Peak Hours Heatmap**: Matriz Dia da Semana x Hora

### 7. Smart Insights Engine

Algoritmo que detecta automaticamente:
- Anomalias (quedas repentinas)
- Oportunidades (features subutilizadas)
- Riscos (padrões de churn)
- Correlações (estudo → performance)

### 8. Risk Alert Banner

Cards visuais com:
- 🔴 Crítico: Usuários em churn iminente
- 🟡 Atenção: Áreas acadêmicas problemáticas
- 🟢 Positivo: Métricas acima do benchmark

## Estrutura de Arquivos

```text
src/components/analytics/journey/
├── StudentJourneySection.tsx      # Container principal (reescrito)
├── ExecutiveSummaryCards.tsx      # KPIs enterprise
├── JourneyFunnelChart.tsx         # Funil visual 6 estágios
├── RetentionCohortGrid.tsx        # Matriz de retenção
├── BehavioralSegments.tsx         # Segmentação de usuários
├── LearningVelocityCard.tsx       # Radar + correlações
├── EngagementDepthCard.tsx        # Session depth + heatmap
├── SmartInsightsEngine.tsx        # Insights automáticos
├── RiskAlertBanner.tsx            # Alertas visuais
├── hooks/
│   └── useJourneyAnalytics.ts     # Hook de data fetching
└── types.ts                       # Tipos e interfaces
```

## Queries de Dados

### Query 1: Executive Metrics
```sql
-- DAU, WAU, MAU, Stickiness
WITH daily AS (
  SELECT DATE(started_at) as d, COUNT(DISTINCT user_id) as dau
  FROM user_sessions WHERE started_at > NOW() - INTERVAL '30 days'
  GROUP BY d
)
SELECT AVG(dau) as avg_dau, MAX(dau) as peak_dau
FROM daily
```

### Query 2: Retention Cohort
```sql
WITH cohorts AS (
  SELECT user_id, DATE(MIN(started_at)) as cohort_week
  FROM user_sessions GROUP BY user_id
),
activity AS (
  SELECT user_id, DATE(started_at) as activity_date
  FROM user_sessions
)
SELECT cohort_week, 
  COUNT(DISTINCT CASE WHEN activity_date = cohort_week THEN user_id END) as week_0,
  COUNT(DISTINCT CASE WHEN activity_date BETWEEN cohort_week + 7 AND cohort_week + 13 THEN user_id END) as week_1
FROM cohorts c JOIN activity a USING (user_id)
GROUP BY cohort_week
```

### Query 3: Learning Velocity (Cross-table)
```sql
SELECT qs.grande_area,
  COUNT(DISTINCT ap.user_id) as respondentes,
  AVG(CASE WHEN ap.correct THEN 1.0 ELSE 0.0 END) * 100 as accuracy,
  COUNT(*) as total_respostas
FROM answer_progress ap
JOIN questoes_simulado qs ON ap.question_id = qs.id
GROUP BY qs.grande_area
```

## Tecnologias e Bibliotecas

- **Gráficos**: Recharts (já instalado)
  - `RadarChart` para áreas de conhecimento
  - `Sankey` ou custom SVG para funil
  - `Heatmap` customizado para horários
- **Animações**: Framer Motion (já instalado)
- **Data Fetching**: React Query com cache agressivo
- **UI**: shadcn/ui components existentes

## Detalhes de UI/UX

### Design Premium
- Cards com bordas sutis e sombras
- Gradientes para indicar intensidade
- Animações de entrada suaves
- Tooltips ricos com contexto
- Estados de loading skeleton personalizados

### Cores por Criticidade
- 🔴 Vermelho: < 30% ou risco alto
- 🟠 Laranja: 30-50% ou atenção
- 🟡 Amarelo: 50-70% ou neutro
- 🟢 Verde: > 70% ou excelente

### Responsividade
- Desktop: Grid 2-3 colunas
- Tablet: Grid 2 colunas
- Mobile: Stack vertical com cards colapsáveis

## Métricas de Sucesso

1. Dashboard carrega em < 2s
2. Todas as 8 seções funcionando
3. Insights automáticos detectando pelo menos 3 padrões
4. Matriz de retenção com pelo menos 4 semanas
5. Zero erros de console
6. Mobile-friendly (testado em 375px)

## Fases de Implementação

### Fase 1: Infraestrutura (Hook + Tipos)
- Criar `useJourneyAnalytics.ts` com todas as queries
- Definir interfaces TypeScript
- Setup de cache e error handling

### Fase 2: Core Components
- ExecutiveSummaryCards
- JourneyFunnelChart (6 estágios)
- BehavioralSegments

### Fase 3: Advanced Analytics
- RetentionCohortGrid
- LearningVelocityCard (Radar)
- EngagementDepthCard (Heatmap)

### Fase 4: Intelligence Layer
- SmartInsightsEngine
- RiskAlertBanner
- Testes e polish

## Resultado Esperado

Uma seção de Jornada que responde perguntas como:
- "Quantos usuários voltam após o primeiro dia?"
- "Qual área acadêmica precisa de mais conteúdo?"
- "Quem está em risco de churn?"
- "O calendário de estudos impacta performance?"
- "Qual o horário ideal para push notifications?"
- "Quanto tempo leva para um usuário fazer seu primeiro simulado?"
