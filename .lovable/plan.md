

# Plano: Reorganizar Cards do Dashboard

## Objetivo

Reorganizar o layout do grid para:
1. Empilhar "Sua Consistência" + "Diagnóstico" verticalmente na coluna ao lado do "O que fazer agora"
2. Mover "Sua Cobertura" para ficar ao lado da "Evolução Semanal"

## Layout Atual

```text
ROW 2:  ┌─────────────────────┐  ┌─────────────────────┐
        │  O que fazer agora  │  │   Sua consistência  │
        │       (6 cols)      │  │       (6 cols)      │
        └─────────────────────┘  └─────────────────────┘

ROW 3:  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │  Diagnóstico │  │ Evol. Semanal│  │ Sua Cobertura│
        │   (4 cols)   │  │   (4 cols)   │  │   (4 cols)   │
        └──────────────┘  └──────────────┘  └──────────────┘
```

## Layout Proposto

```text
ROW 2:  ┌─────────────────────┐  ┌─────────────────────┐
        │                     │  │   Sua consistência  │
        │  O que fazer agora  │  ├─────────────────────┤
        │                     │  │     Diagnóstico     │
        │       (6 cols)      │  │       (6 cols)      │
        └─────────────────────┘  └─────────────────────┘

ROW 3:  ┌─────────────────────┐  ┌─────────────────────┐
        │   Evolução Semanal  │  │    Sua Cobertura    │
        │       (6 cols)      │  │       (6 cols)      │
        └─────────────────────┘  └─────────────────────┘
```

## Mudanças em `Dashboard.tsx`

### ROW 2 - Agrupar cards na coluna direita (linhas 478-492)

**Antes:**
```tsx
{/* ROW 2: Next Actions (6 cols) + Consistency (6 cols) */}
<motion.div variants={itemVariants} className="col-span-12 md:col-span-6">
  <NextActionsCard ... />
</motion.div>

<motion.div variants={itemVariants} className="col-span-12 md:col-span-6">
  <ConsistencyCard ... />
</motion.div>
```

**Depois:**
```tsx
{/* ROW 2: Next Actions (6 cols) + [Consistency + Diagnostics stacked] (6 cols) */}
<motion.div variants={itemVariants} className="col-span-12 md:col-span-6">
  <NextActionsCard ... />
</motion.div>

<motion.div variants={itemVariants} className="col-span-12 md:col-span-6 space-y-4 lg:space-y-5">
  <ConsistencyCard ... />
  <DiagnosticsCard ... />
</motion.div>
```

### ROW 3 - Weekly Evolution + Coverage lado a lado (linhas 494-511)

**Antes:**
```tsx
{/* ROW 3: Diagnostics + Weekly Evolution + Coverage (4+4+4) */}
<motion.div className="col-span-12 md:col-span-6 xl:col-span-4">
  <DiagnosticsCard ... />
</motion.div>

<motion.div className="col-span-12 md:col-span-6 xl:col-span-4">
  <WeeklyEvolutionCard ... />
</motion.div>

<motion.div className="col-span-12 xl:col-span-4">
  <CoverageRankingCard ... />
</motion.div>
```

**Depois:**
```tsx
{/* ROW 3: Weekly Evolution (6 cols) + Coverage (6 cols) */}
<motion.div className="col-span-12 md:col-span-6">
  <WeeklyEvolutionCard ... />
</motion.div>

<motion.div className="col-span-12 md:col-span-6">
  <CoverageRankingCard ... />
</motion.div>
```

## Responsividade

| Breakpoint | Layout ROW 2 | Layout ROW 3 |
|------------|--------------|--------------|
| Mobile (<768px) | Empilhado (NextActions → Consistency → Diagnostics) | Empilhado (Evolution → Coverage) |
| Tablet (768px+) | 6+6 colunas com Consistency+Diagnostics empilhados | 6+6 colunas |
| Desktop (1024px+) | Mesmo que tablet | Mesmo que tablet |

## Resultado Visual Esperado

Os dois cards "Sua Consistência" e "Diagnóstico" juntos terão aproximadamente a mesma altura do card "O que fazer agora", criando um layout equilibrado. O "Sua Cobertura" ao lado da "Evolução Semanal" oferece mais espaço para cada gráfico.

## Arquivo a Modificar

| Arquivo | Linhas | Mudança |
|---------|--------|---------|
| `src/pages/Dashboard.tsx` | 478-511 | Reorganizar grid ROW 2 e ROW 3 conforme descrito |

