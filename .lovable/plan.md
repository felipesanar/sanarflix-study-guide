

# Plano: Corrigir Indicação Visual de Dias Ativos na Consistência

## Problema Identificado

Os cards "Hero" e "Sua Consistência" não refletem corretamente os dias em que houve atividade de estudo. A lógica atual usa `i < streak.active_days_week` que marca os **primeiros N dias da semana** (D, S, T...) ao invés dos **dias específicos** com atividade.

**Exemplo do bug:**
- Hoje é sábado (dia 6)
- Usuário estudou na quarta (3) e hoje (6)
- O card deveria marcar: ☐D ☐S ☐T ✓Q ☐Q ☐S ✓S
- O card mostra atualmente: ✓D ✓S ☐T ☐Q ☐Q ☐S ☐S

## Causa Raiz

A edge function `get-progress-hub` retorna apenas um contador (`active_days_week: 2`), mas o frontend precisa saber **quais dias específicos** tiveram atividade.

## Solução

### 1. Atualizar Edge Function (`get-progress-hub/index.ts`)

Modificar o cálculo de streak para retornar também um array com os dias ativos:

```typescript
// Linhas ~546-555 - Calcular dias ativos COM os índices
const weekStart = new Date(today);
weekStart.setDate(today.getDate() - today.getDay()); // Domingo como início

let activeDaysThisWeek = 0;
const activeDaysOfWeek: number[] = []; // NOVO: array com índices dos dias ativos

for (let i = 0; i < 7; i++) {
  const checkDate = new Date(weekStart.getTime() + i * 86400000);
  if (activityDates.has(checkDate.toISOString().split('T')[0])) {
    activeDaysThisWeek++;
    activeDaysOfWeek.push(i); // NOVO: adicionar índice do dia (0=dom, 1=seg, etc)
  }
}

// Na resposta (linha ~707):
streak: {
  current: currentStreak,
  active_days_week: activeDaysThisWeek,
  active_days_of_week: activeDaysOfWeek, // NOVO
  goal: 3
}
```

### 2. Atualizar Tipo `ProgressStreak` (`src/types/progressHub.ts`)

```typescript
export interface ProgressStreak {
  current: number;
  active_days_week: number;
  active_days_of_week: number[]; // NOVO: [0,2,5] = domingo, terça, sexta
  goal: number;
  weeks_achieved?: number;
}
```

### 3. Corrigir `ConsistencyCard.tsx` (linhas 67-68)

```typescript
// ANTES
const isActive = i < streak.active_days_week;

// DEPOIS
const isActive = streak.active_days_of_week?.includes(i) ?? false;
```

### 4. Corrigir `ProgressHeroCard.tsx` (linhas 197-204)

```typescript
// ANTES
{[...Array(7)].map((_, i) => (
  <div 
    key={i}
    className={cn(
      "w-3 h-3 rounded-sm transition-colors",
      i < streak.active_days_week
        ? "bg-primary"
        : "bg-muted-foreground/20"
    )}
  />
))}

// DEPOIS
{[...Array(7)].map((_, i) => (
  <div 
    key={i}
    className={cn(
      "w-3 h-3 rounded-sm transition-colors",
      streak.active_days_of_week?.includes(i)
        ? "bg-primary"
        : "bg-muted-foreground/20"
    )}
  />
))}
```

### 5. Atualizar `ProgressSummaryCard.tsx` (Home)

Aplicar a mesma correção se houver visualização de dias ativos.

### 6. Atualizar `useProgressHub.ts` - Fallback para compatibilidade

Adicionar fallback no hook para garantir compatibilidade durante a transição:

```typescript
// No processamento da resposta
const responseWithGoal = {
  ...response,
  streak: {
    ...response.streak,
    goal: streakGoal,
    // Fallback: se API antiga não retornar active_days_of_week
    active_days_of_week: response.streak.active_days_of_week ?? []
  }
};
```

## Visualização do Comportamento Esperado

```text
Semana: D=Domingo, S=Segunda, T=Terça, Q=Quarta, Q=Quinta, S=Sexta, S=Sábado

Se hoje é Sábado (6) e houve atividade na Quarta (3) e Sábado (6):

ANTES (bug):
┌─────────────────────────────────────────┐
│  ✓D  ✓S  ☐T  ☐Q  ☐Q  ☐S  ☐S           │
│                            ↑ hoje       │
└─────────────────────────────────────────┘

DEPOIS (correto):
┌─────────────────────────────────────────┐
│  ☐D  ☐S  ☐T  ✓Q  ☐Q  ☐S  ✓S           │
│              ↑estudou      ↑ hoje/estudou│
└─────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/get-progress-hub/index.ts` | Adicionar cálculo de `active_days_of_week` e incluir na resposta |
| `src/types/progressHub.ts` | Adicionar campo `active_days_of_week: number[]` ao tipo |
| `src/components/progress-hub/ConsistencyCard.tsx` | Usar `includes(i)` ao invés de `i <` |
| `src/components/progress-hub/ProgressHeroCard.tsx` | Usar `includes(i)` ao invés de `i <` |
| `src/hooks/useProgressHub.ts` | Adicionar fallback para compatibilidade |

## Teste

Após a implementação:
1. Marcar uma aula como concluída no Guia de Estudos
2. Navegar para o Dashboard
3. Verificar que o dia de hoje (sábado) aparece marcado nos dois cards
4. Verificar que outros dias da semana sem atividade aparecem desmarcados

