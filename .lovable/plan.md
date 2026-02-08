
# Plano: Corrigir Sobreposição do DiagnosticsCard com CoverageRankingCard

## Problema

O card de Diagnóstico está ultrapassando os limites do seu container e sobrepondo o card "Sua Cobertura" abaixo. Isso acontece porque o bloco que contém ConsistencyCard + DiagnosticsCard não tem altura limitada.

## Análise da Estrutura

```text
ROW 2 - Grid Layout Atual:
┌────────────────────────────┬────────────────────────────┐
│ NextActionsCard            │ ConsistencyCard            │
│ (col-span-6)               │ + DiagnosticsCard          │
│ ~380px altura natural      │ (col-span-6, space-y-4)    │
│                            │ SEM LIMITE DE ALTURA ❌    │
└────────────────────────────┴────────────────────────────┘

ROW 3:
┌────────────────────────────┬────────────────────────────┐
│ WeeklyEvolutionCard        │ CoverageRankingCard        │
│                            │ ← SOBREPOSTO!              │
└────────────────────────────┴────────────────────────────┘
```

## Solução

Limitar a altura do bloco da direita (ConsistencyCard + DiagnosticsCard) para que ele alinhe verticalmente com o NextActionsCard, forçando o DiagnosticsCard a usar `overflow-hidden` ou `max-height` para impedir que cresça além do disponível.

A abordagem mais robusta é usar **flexbox com flex-1** para que o DiagnosticsCard ocupe apenas o espaço restante após o ConsistencyCard.

## Mudanças Técnicas

### 1. Alterar o container da direita para usar flexbox

**Arquivo:** `src/pages/Dashboard.tsx`

**Linha 544** - Trocar `space-y-4 lg:space-y-5` por um layout flex com altura definida:

```tsx
// ANTES (linha 544)
<motion.div variants={itemVariants} className="col-span-12 md:col-span-6 space-y-4 lg:space-y-5">
  <ConsistencyCard ... />
  <DiagnosticsCard ... />
</motion.div>

// DEPOIS
<motion.div variants={itemVariants} className="col-span-12 md:col-span-6 flex flex-col gap-4 lg:gap-5">
  <ConsistencyCard ... />
  <div className="flex-1 min-h-0 overflow-hidden">
    <DiagnosticsCard ... />
  </div>
</motion.div>
```

### 2. Garantir que o DiagnosticsCard respeite altura do container

**Arquivo:** `src/components/progress-hub/DiagnosticsCard.tsx`

Adicionar `h-full` ao Card raiz e `overflow-auto` ao CardContent para permitir scroll interno se necessário (ou `overflow-hidden` para simplesmente cortar):

```tsx
// ANTES (linha 166-167)
<Card className="h-full">
  ...
  <CardContent className="space-y-2">

// DEPOIS
<Card className="h-full flex flex-col">
  ...
  <CardContent className="space-y-2 flex-1 overflow-hidden">
```

## Resultado Visual Esperado

```text
ROW 2:
┌────────────────────────────┬────────────────────────────┐
│ NextActionsCard            │ ConsistencyCard (~40%)     │
│                            ├────────────────────────────┤
│                            │ DiagnosticsCard (~60%)     │
│                            │ (altura limitada)          │
│____________________________│____________________________│
                              ↑ Alturas alinhadas

ROW 3 (com espaço correto acima):
┌────────────────────────────┬────────────────────────────┐
│ WeeklyEvolutionCard        │ CoverageRankingCard        │
│                            │ ✅ Sem sobreposição        │
└────────────────────────────┴────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Dashboard.tsx` | Envolver DiagnosticsCard em div com `flex-1 min-h-0 overflow-hidden` e trocar `space-y` por `flex flex-col gap-*` |
| `src/components/progress-hub/DiagnosticsCard.tsx` | Adicionar `flex flex-col` ao Card e `flex-1 overflow-hidden` ao CardContent |

## Considerações

- O `min-h-0` é essencial em flex items para permitir que eles encolham abaixo do tamanho natural do conteúdo
- O `overflow-hidden` garante que o conteúdo extra seja cortado ao invés de vazar
- Se desejar scroll interno no DiagnosticsCard, trocar por `overflow-auto`
- Essa abordagem é responsiva e funciona em qualquer tamanho de tela
