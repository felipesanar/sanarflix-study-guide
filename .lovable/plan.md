
# Plano de Melhoria: Card "Questões que Mais Derrubam Desempenho"

## Problema Identificado

O scroll não funciona porque o `ScrollArea` está usando `max-h-[500px]` em vez de `h-[500px]`. O Radix `ScrollArea` requer uma altura fixa para calcular a barra de rolagem corretamente.

---

## Melhorias Propostas

### 1. Corrigir Scroll (Bug Principal)

**Problema**: `max-h-[500px]` não força altura fixa, impedindo o scroll de aparecer.

**Solução**: Substituir por `h-[500px]` no `ScrollArea` e adicionar overflow adequado.

---

### 2. Adicionar Ranking Visual

Mostrar posição no ranking (1º, 2º, 3º...) para cada questão problemática com badges coloridos:

- Top 5: badge vermelho (mais crítico)
- 6-10: badge laranja (atenção)
- 11-20: badge amarelo (monitorar)

---

### 3. Exibir Distribuição de Alternativas

O hook já retorna `distribuicao: { alternativa: string; count: number; percent: number }[]`, mas está vindo como array vazio. 

**Melhoria**: Quando houver dados, exibir mini gráfico de barras horizontais mostrando quantos % erraram em cada alternativa - identificando "alternativas armadilha".

---

### 4. Botões de Ação no Drawer

Adicionar botões de ação rápida no conteúdo expandido:
- "Ver questão completa" (abre modal ou link)
- "Anular questão" (se for admin)
- "Copiar ID" para referência

---

### 5. Indicador de Simulado de Origem

Mostrar de qual simulado a questão faz parte para contexto completo.

---

### 6. Filtros Avançados

Adicionar filtros no header:
- Por Grande Área
- Por Dificuldade
- Por faixa de taxa de erro (50-70%, 70-90%, 90%+)

---

### 7. Melhorias de UX/Visual

| Item | Descrição |
|------|-----------|
| Gradient no badge de erro | Cores progressivas (vermelho intenso para 90%+) |
| Animações suaves | Framer Motion para expandir/colapsar |
| Skeleton melhorado | Skeletons que refletem o layout real |
| Empty state enriquecido | Ilustração e CTA quando não há questões |
| Contagem no header | Badge mostrando quantas questões estão na lista |

---

### 8. Acessibilidade

- Melhorar keyboard navigation
- Adicionar `aria-expanded` nos colapsáveis
- Garantir contraste nos badges

---

## Detalhes Técnicos

### Arquivos a Modificar

1. **`src/components/analytics/simulados/QuestoesProblematicasCard.tsx`**
   - Corrigir altura do ScrollArea: `max-h-[500px]` → `h-[500px]`
   - Adicionar ranking visual
   - Melhorar estados de loading/empty
   - Implementar filtros básicos
   - Adicionar distribuição de alternativas (preparado para dados futuros)

2. **`src/hooks/useSimuladosAnalytics.ts`** (opcional)
   - Calcular distribuição de alternativas por questão para enriquecer insights
   - Incluir `simulado_id` no tipo `QuestaoProblematica`

### Estrutura do Card Revisada

```text
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Questões que Mais Derrubam Desempenho  (20)   [ℹ️]       │
│                                                             │
│ [Filtros: Grande Área ▾] [Dificuldade ▾]   [🔘 Anuladas (2)]│
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ #1  NVT, 50 anos, apresenta achado...         [97% erro]│ │
│ │     Ginecologia • Difícil • n=108                       │ │
│ │     ████████████████████████████████████░░  (progress)  │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ #2  Paciente com dor torácica...              [92% erro]│ │
│ │     Cardiologia • Médio • n=85                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                        [scroll ↕]                           │
└─────────────────────────────────────────────────────────────┘
```

### Priorização

| Prioridade | Item | Complexidade |
|------------|------|--------------|
| Alta | Corrigir scroll | Simples |
| Alta | Adicionar ranking visual (#1, #2...) | Simples |
| Média | Filtros por área/dificuldade | Média |
| Média | Melhorar skeletons e empty state | Simples |
| Baixa | Distribuição de alternativas | Média (requer dados) |
| Baixa | Botões de ação | Média |

---

## Resultado Esperado

- Scroll funcionando imediatamente
- Card mais informativo com ranking visual
- Filtros para análise focada
- Preparação para features futuras (distribuição, ações)
