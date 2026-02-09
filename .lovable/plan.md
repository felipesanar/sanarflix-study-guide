
# Plano: Adaptar Jornada do Estudante ao Contexto B2B Institucional

## Contexto do Negocio

A plataforma SanarFlix Academy e um produto B2B vendido para universidades parceiras. Os alunos nao escolhem usar a plataforma individualmente - eles sao inscritos pela instituicao. Isso significa:

1. **Nao existe churn do aluno**: O aluno nao cancela assinatura, ele simplesmente pode deixar de usar
2. **O risco real e institucional**: Se o engajamento for baixo, o gestor da universidade pode nao ver valor e nao renovar o contrato
3. **Foco em saude do engajamento**: Em vez de "risco de churn", devemos falar em "baixo engajamento" ou "alunos inativos"

## Mudancas Necessarias

### 1. Renomear Metricas e Alertas

| Termo Atual | Novo Termo |
|-------------|------------|
| "Risco de Churn" | "Baixo Engajamento" ou "Alunos Inativos" |
| "X usuarios em risco de churn" | "X alunos com baixa atividade" |
| "Churn Risk" | "Inatividade" |
| "campanha de reengajamento" | "acoes de ativacao" |

### 2. Recontextualizar Alertas e Insights

**Alertas Atuais (problema):**
- "X usuarios em risco de churn" - Implica que vao cancelar

**Novos Alertas (contexto B2B):**
- "X alunos com baixa atividade" - Apenas 1 visita nos ultimos 14 dias
- "X% da turma ainda nao acessou este mes" - Alunos que precisam de ativacao
- "Engajamento abaixo do esperado" - Quando stickiness ou metricas estao baixas

### 3. Reformular Insights Automaticos

**Insight Atual:**
```
"X usuarios em risco de churn - Usuarios com apenas 1 visita nos ultimos 14 dias precisam de reengajamento"
```

**Novo Insight:**
```
"X alunos com baixa atividade - Estes alunos acessaram apenas 1 vez nas ultimas 2 semanas. Considere acoes de ativacao como lembretes ou comunicacao via coordenacao"
```

### 4. Adicionar Metricas Relevantes para B2B

Novas metricas que fazem mais sentido no contexto institucional:

- **Taxa de Ativacao**: % de alunos matriculados que acessaram pelo menos 1x
- **Cobertura Mensal**: % de alunos ativos no mes vs total matriculados
- **Alunos Nunca Ativos**: Usuarios cadastrados que nunca fizeram login
- **Engajamento por Semestre/Curso**: Comparativo entre turmas

### 5. Novo Card: Indicador de Saude Institucional

Em vez de "Risco de Churn", criar um indicador de "Saude do Engajamento" que mostre ao gestor:
- Verde: Engajamento saudavel (>60% ativos no mes)
- Amarelo: Atencao necessaria (30-60% ativos)
- Vermelho: Engajamento critico (<30% ativos)

## Arquivos a Modificar

### 1. `types.ts`
- Renomear `churnRiskCount` para `lowEngagementCount`
- Adicionar `neverActiveCount` e `activationRate`

### 2. `useJourneyAnalytics.ts`
- Atualizar calculo de `churnRiskCount` para `lowEngagementCount`
- Calcular `neverActiveCount` (usuarios sem nenhuma sessao)
- Calcular `activationRate` (% de usuarios com pelo menos 1 acesso)
- Reescrever textos de insights e alertas

### 3. `ExecutiveSummaryCards.tsx`
- Renomear card "Risco Churn" para "Baixa Atividade"
- Atualizar icone e cores para refletir contexto de ativacao (nao perda)
- Adicionar tooltip explicativo

### 4. `BehavioralSegments.tsx`
- Renomear segmento "Em Risco" para "Inativos" ou "Baixa Frequencia"
- Atualizar descricao e icone

### 5. `RiskAlertBanner.tsx`
- Renomear para `EngagementAlertBanner.tsx`
- Atualizar textos para contexto B2B
- Adicionar novos tipos de alerta focados em ativacao

### 6. `SmartInsightsEngine.tsx`
- Reescrever mensagens de insights
- Mudar acoes sugeridas de "campanha de reengajamento" para "comunicacao via coordenacao" ou "lembretes institucionais"

## Exemplos de Novos Textos

### Alertas

**Antes:**
- "25 usuarios em risco de churn - Apenas 1 visita nos ultimos 14 dias"

**Depois:**
- "25 alunos com baixa atividade - Acessaram apenas 1 vez nas ultimas 2 semanas"
- "15% da turma inativa este mes - Alunos matriculados que ainda nao acessaram"

### Insights

**Antes:**
- "25 usuarios em risco de churn - Usuarios com apenas 1 visita nos ultimos 14 dias precisam de reengajamento. Acao: Enviar campanha de reengajamento"

**Depois:**
- "25 alunos com baixa atividade - Estes alunos podem nao estar aproveitando os recursos da plataforma. Acao: Notificar coordenacao para acompanhamento"

### Segmentos

**Antes:**
- "Em Risco" com icone de alerta

**Depois:**
- "Baixa Frequencia" ou "Inativos" com icone neutro (nao alarmista)

## Secao Tecnica

### Estrutura de Tipos Atualizada
```typescript
export interface ExecutiveMetrics {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
  avgSessionDepth: number;
  avgSessionDuration: number;
  timeToFirstSimulado: number | null;
  calendarAdoption: number;
  // Removido: churnRiskCount
  lowEngagementCount: number;    // Novo: usuarios com apenas 1 visita em 14d
  neverActiveCount: number;      // Novo: usuarios sem nenhum acesso
  activationRate: number;        // Novo: % de usuarios que ja acessaram
  totalUsers: number;
}
```

### Logica de Calculo
```typescript
// Low engagement (substitui churn risk)
const lowEngagementCount = Array.from(userSessionCounts.entries())
  .filter(([_, count]) => count === 1).length;

// Never active (usuarios sem sessao alguma)
const usersWithSessions = new Set(sessions.map(s => s.user_id));
const neverActiveCount = totalUsers - usersWithSessions.size;

// Activation rate
const activationRate = totalUsers > 0 
  ? Math.round((usersWithSessions.size / totalUsers) * 100) 
  : 0;
```

## Beneficios

1. **Contexto correto**: Metricas e alertas refletem a realidade B2B
2. **Acoes relevantes**: Sugestoes fazem sentido para gestores de universidade
3. **Menos alarme desnecessario**: "Baixa atividade" e menos alarmante que "risco de churn"
4. **Novas metricas uteis**: Taxa de ativacao e cobertura sao mais relevantes para o cliente institucional
5. **Comunicacao profissional**: Textos adequados para mostrar ao gestor da universidade

## Entregaveis

1. Types atualizados com novas metricas B2B
2. Hook `useJourneyAnalytics` com calculos e textos revisados
3. `ExecutiveSummaryCards` com card de "Baixa Atividade"
4. `BehavioralSegments` com segmento "Inativos" em vez de "Em Risco"
5. Alertas e insights reescritos para contexto institucional
6. Possivel renomeacao de `RiskAlertBanner` para `EngagementAlertBanner`
