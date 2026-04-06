

# Simulador de Impacto Híbrido (Dual Mode)

## Resumo

Adicionar um **Modo Meta** (goal-driven) ao simulador existente, mantendo o **Modo Exploração** atual. O gestor poderá alternar entre "Se eu agir aqui, quantos alunos recupero?" e "Quantos alunos quero recuperar e qual esforço isso exige?".

## Arquivo modificado

`src/components/analytics/v2/modules/SimuladorImpactoModule.tsx` — unico arquivo alterado.

## Mudanças

### 1. Novo tipo e estado de modo

```typescript
type SimulationMode = 'effort' | 'goal';
// Novo campo no SimulationScenario:
desiredRecovered: number; // usado apenas no modo goal
```

Estado adicional: `const [mode, setMode] = useState<SimulationMode>('effort');`

### 2. Nova funcao `simulateByGoal()`

Logica reversa:
1. Filtrar alunos elegiveis (`percentual < 60`) no segmento selecionado
2. Calcular gap de cada um (`60 - percentual`)
3. Ordenar por proximidade (menor gap primeiro)
4. Selecionar os N primeiros (input do usuario)
5. Calcular esforco necessario: `requiredEffort = Math.max(...selected.map(s => gap / weight))`
6. Clamp entre 0-100; se > 100 marcar como "inviavel"
7. Depois rodar `simulateByEffort` com o `requiredEffort` calculado para obter todos os outputs unificados

### 3. UI — Toggle de modo no topo do card de configuracao

Usar `ToggleGroup` (ja importado no projeto) com duas opcoes:
- "Explorar impacto" (modo effort)
- "Definir meta" (modo goal)

### 4. UI — Slider condicional

- **Modo effort**: slider existente (1-30pp de melhoria)
- **Modo goal**: novo slider com `min=1`, `max=totalAlunosAbaixo60`, `step=1`, label "Quantos alunos voce quer tornar proficientes?"

### 5. Resultados — outputs unificados

Ambos os modos produzem o mesmo `SimulationResult`, exibido na mesma hierarquia:
1. Hero KPI (alunos recuperados)
2. Metricas secundarias (delta, conceito, eficiencia)
3. Explicacao dinamica
4. Lista de alunos
5. Premissas

### 6. Explicacao dinamica por modo

- **Effort**: "Voce simulou uma melhoria de Xpp neste tema, que representa Y% da prova."
- **Goal**: "Para recuperar X alunos, voce precisa melhorar aproximadamente Ypp neste tema."

### 7. Estados especiais (modo goal)

- `requiredEffort > 100`: card de aviso "Nao e possivel atingir essa meta apenas com este tema. Considere combinar com outros temas ou reduzir a meta."
- `requiredEffort < 1`: badge "Meta atingivel com esforco minimo"
- `desiredRecovered > eligible`: clamp automatico ao maximo elegivel

### 8. Logs

```
console.log('[ImpactSimulator][Mode]', mode);
console.log('[ImpactSimulator][Goal]', { desiredRecovered, requiredEffort });
```

### 9. Responsividade

- ToggleGroup empilha em telas < sm se necessario
- Slider de meta funcional em touch (Radix)
- Cards empilhados verticalmente em mobile (ja implementado)

