

# Refatoração do Simulador de Impacto — Foco em Alunos Recuperados

## Resumo

Reestruturar a UI e os outputs do `SimuladorImpactoModule` para priorizar "quantos alunos se tornam proficientes", mantendo a lógica matemática existente (peso proporcional) que já está correta.

## Auditoria da lógica atual (Fase 1)

A lógica em `simulateImpact()` já implementa corretamente:
- Peso proporcional: `weight = targetNode.total / totalQuestions`
- Melhoria efetiva: `effectiveImprovement = improvement * weight`
- Segmentação: todos (<60%), próximos (50-60%), risco (<45%)
- Simulação aluno a aluno com cap implícito (percentual + improvement, sem ultrapassar threshold check)
- Contagem de alunos que cruzam 60%

**Correção necessária**: garantir cap em 100% no score simulado (`Math.min(100, simulatedScore)`).

## Arquivo modificado

`src/components/analytics/v2/modules/SimuladorImpactoModule.tsx`

## Mudanças

### 1. Expandir `SimulationResult` com novos campos

```typescript
// Novos campos:
totalImpactados: number;      // total de alunos no segmento
taxaConversao: number;        // newProficientes / totalImpactados * 100
eficiencia: number;           // newProficientes / improvement
```

### 2. Atualizar `simulateImpact()` para calcular novos outputs

- `totalImpactados = affectedStudents.length`
- `taxaConversao = totalImpactados > 0 ? (newProficientes / totalImpactados) * 100 : 0`
- `eficiencia = improvement > 0 ? newProficientes / improvement : 0`
- Cap: `Math.min(100, student.percentual + effectiveImprovement)`
- Adicionar `console.log('[ImpactSimulator]', { inputs, outputs })`

### 3. Redesenhar a seção de resultados (hierarquia da informação)

Nova ordem de exibição dos cards de resultado:

```text
┌─────────────────────────────────────────────┐
│  🎯 X alunos se tornam proficientes         │  ← KPI PRINCIPAL (grande, destaque)
│     de Y alunos impactados                  │
│     Taxa de conversão: Z%                   │
├─────────────────────────────────────────────┤
│  📊 Impacto institucional: +N pp            │  ← Secundário
│  Conceito: 2 → 3                            │
│  Eficiência: W alunos/pp aplicado           │
├─────────────────────────────────────────────┤
│  💡 Explicação dinâmica                     │
│  "Este tema representa 4/120 questões..."   │
├─────────────────────────────────────────────┤
│  👥 Lista de alunos recuperados             │
├─────────────────────────────────────────────┤
│  ℹ️ Premissas do cálculo                    │
└─────────────────────────────────────────────┘
```

### 4. KPI Principal — Card de destaque

Substituir o grid "Before vs After" por um card hero:
- Número grande e centralizado: `{result.newProficientes}` com label "alunos se tornam proficientes"
- Sub-info: "{totalImpactados} alunos impactados · Taxa de conversão: {taxaConversao}%"
- Cor verde se > 0, cinza se 0

### 5. Impacto institucional — Card secundário

Grid compacto horizontal com 3 métricas:
- Δ Taxa: `+{deltaPercent}pp`
- Conceito: `{current} → {simulated}`
- Eficiência: `{eficiencia.toFixed(1)} alunos/pp`

### 6. Explicação dinâmica (transparência)

Substituir o bloco de explicação por texto contextualizado:
- "O impacto é calculado com base na relevância do tema no simulado (peso) e aplicado proporcionalmente ao desempenho dos alunos."
- Exemplo dinâmico: "Este tema representa {targetNode.total} de {totalQuestions} questões ({weight}%). Uma melhoria de {improvement} pontos gera +{effectiveImprovement.toFixed(1)} pontos no score geral."

### 7. Responsividade

- Cards de KPI empilham verticalmente em mobile
- Grid de métricas secundárias: `grid-cols-1 sm:grid-cols-3`
- Slider já funciona em mobile (Radix)

### 8. Validações

- `Math.min(100, simulatedScore)` no loop de simulação
- Manter check `if (!totalStudents) return null`
- Resultado `null` renderiza estado vazio informativo

