

# Plano: Correlacao Estudo vs Desempenho

## Contexto e Objetivo

O card atual de "Performance Pedagogica" mostra acuracia por grande area nos simulados - informacao redundante com a aba Simulados. A proposta e transformar este card em um **"Correlacao Estudo x Desempenho"** que cruze dados de:
- **Aulas concluidas** (`study_progress`)
- **Desempenho em questoes** (`answer_progress` + `questoes_simulado`)

## Insight Principal a Gerar

**"Quem estuda mais, acerta mais?"** - Uma analise que mostre se existe correlacao positiva entre o volume de estudo e a acuracia nos simulados.

## Abordagem Tecnica

### Desafio: Nomenclatura Diferente

| Tabela | Campo | Exemplos |
|--------|-------|----------|
| `questoes_simulado` | `grande_area` | Cirurgia, Clinica Medica, Pediatria |
| `conteudos` / `study_progress` | `materia_id` | Cirurgia, Clinica Medica do adulto I, Saude da Crianca II |

**Solucao**: Criar um mapeamento fuzzy no frontend que agrupe materias por grande area:
- "Clinica Medica*", "Fisiopatologia*" -> Clinica Medica
- "Cirurgia*", "Tecnica Cirurgica*" -> Cirurgia
- "Pediatria", "Saude da Crianca*" -> Pediatria
- etc.

### Metricas de Correlacao

1. **Por Usuario**:
   - Agrupar usuarios em faixas de "aulas concluidas" (0, 1-5, 6-15, 16-30, 31+)
   - Calcular acuracia media de cada faixa
   - Mostrar se a acuracia sobe conforme o estudo aumenta

2. **Por Area** (Radar Chart reaproveitado):
   - Para cada grande area: % de aulas concluidas vs % de acuracia
   - Identificar "gaps pedagogicos": areas com muito estudo mas pouco acerto (problema de conteudo) ou pouco estudo e pouco acerto (oportunidade de ativacao)

3. **Insights Inteligentes**:
   - "Alunos que concluiram 10+ aulas tem 23% mais acuracia em media"
   - "Cirurgia: alto estudo (72%) mas baixa acuracia (48%) - revisar conteudo"
   - "Pediatria: baixo estudo (18%) e baixa acuracia (51%) - incentivar consumo"

## Novo Design do Card

```
+----------------------------------------------------------+
|  Correlacao Estudo x Desempenho              Coef: 0.72  |
|  O estudo impacta diretamente no desempenho              |
+----------------------------------------------------------+
|                          |  📚 Faixas de Estudo          |
|     [Radar Chart]        |  0 aulas:      43% acuracia   |
|     Estudo vs Acuracia   |  1-5 aulas:    51% acuracia   |
|     por Grande Area      |  6-15 aulas:   58% acuracia   |
|                          |  16-30 aulas:  67% acuracia   |
|                          |  31+ aulas:    74% acuracia   |
+----------------------------------------------------------+
|  ⚡ Insights                                              |
|  • Alunos com 16+ aulas concluidas tem +24% de acuracia  |
|  • Gap: Clinica Medica (68% estudo, 52% acuracia)        |
|  • Oportunidade: Pediatria (12% estudo, pode melhorar)   |
+----------------------------------------------------------+
```

## Arquivos a Modificar

### 1. `types.ts`
Atualizar `LearningVelocityData` para incluir:
```typescript
export interface StudyVsPerformanceData {
  // Correlacao por faixa de estudo
  studyBands: {
    band: string;      // "0", "1-5", "6-15", "16-30", "31+"
    avgAccuracy: number;
    userCount: number;
    lessonsCompleted: number;
  }[];
  
  // Correlacao por area
  areaCorrelation: {
    area: string;
    studyPercentage: number;    // % de aulas concluidas da area
    accuracy: number;            // % de acertos nas questoes
    gap: 'content' | 'activation' | 'balanced';
    lessonsCompleted: number;
    totalLessons: number;
    answersCorrect: number;
    totalAnswers: number;
  }[];
  
  // Metricas gerais
  correlationCoefficient: number;  // -1 a 1, quanto mais perto de 1, maior correlacao
  topInsights: string[];
}
```

### 2. `useJourneyAnalytics.ts`
Reescrever a query `learningQuery` para:
1. Buscar `study_progress` agrupado por `user_id` e `materia_id`
2. Buscar `answer_progress` com join em `questoes_simulado` para pegar `grande_area`
3. Mapear `materia_id` para `grande_area` usando funcao de mapeamento
4. Calcular correlacao por faixa de estudo e por area
5. Gerar insights automaticos

### 3. `LearningVelocityCard.tsx` -> `StudyCorrelationCard.tsx`
Transformar completamente o componente:
- Novo titulo: "Correlacao Estudo x Desempenho"
- Radar chart com duas series: Estudo (azul) e Desempenho (vermelho/laranja)
- Lista de faixas de estudo com barras de progresso
- Alertas de gaps pedagogicos
- Coeficiente de correlacao em destaque

### 4. `index.ts`
Atualizar export do componente renomeado

## Mapeamento de Materias para Grandes Areas

```typescript
const AREA_MAPPING: Record<string, string[]> = {
  'Clínica Médica': [
    'clínica médica', 'fisiopatologia', 'semiologia', 
    'farmacologia', 'medicina laboratorial', 'fisiologia'
  ],
  'Cirurgia': [
    'cirurgia', 'técnica cirúrgica', 'clínica cirúrgica',
    'urgência', 'emergência'
  ],
  'Pediatria': [
    'pediatria', 'saúde da criança', 'adolescente'
  ],
  'Ginecologia e Obstetrícia': [
    'ginecologia', 'obstetrícia', 'saúde da mulher', 'toco'
  ],
  'Saúde Mental': [
    'saúde mental', 'psiquiatria', 'psicologia médica'
  ],
  'Medicina Preventiva/Saúde Coletiva': [
    'saúde coletiva', 'epidemiologia', 'políticas públicas',
    'bioestatística', 'ciências sociais', 'saúde do trabalhador'
  ],
  'Medicina de Família e Comunidade': [
    'medicina da família', 'comunidade'
  ],
};
```

## Fluxo de Dados

```
study_progress (user_id, materia_id, completed)
        |
        v
    Mapeamento materia -> grande_area
        |
        v
    Agregacao por usuario: aulas por area
        |
        +----> Join com answer_progress por user_id
        |
        v
    Calculo de correlacao por:
      - Faixa de aulas (0, 1-5, 6-15, 16-30, 31+)
      - Grande area (% estudo vs % acuracia)
        |
        v
    Geracao de insights automaticos
```

## Insights Automaticos (Logica)

1. **Correlacao Geral**:
   - Se acuracia media da faixa 31+ for 20%+ maior que faixa 0: "Forte correlacao positiva"
   - Se for similar: "Correlacao fraca - investigar qualidade do conteudo"

2. **Gap de Conteudo** (area com alto estudo, baixa acuracia):
   - `studyPercentage > 60% && accuracy < 55%`
   - Insight: "Revisar conteudo de {area} - alto consumo mas baixa retenção"

3. **Oportunidade de Ativacao** (area com baixo estudo, baixa acuracia):
   - `studyPercentage < 30% && accuracy < 55%`
   - Insight: "Incentivar estudo de {area} - potencial de melhoria"

4. **Area Balanceada** (estudo proporcional ao desempenho):
   - Diferenca < 15% entre studyPercentage e accuracy
   - Insight: "{area} apresenta bom equilibrio entre consumo e resultado"

## Secao Tecnica Adicional

### Calculo do Coeficiente de Correlacao

Usando correlacao de Pearson simplificada:
```typescript
function calculateCorrelation(data: { study: number; accuracy: number }[]): number {
  const n = data.length;
  const sumX = data.reduce((s, d) => s + d.study, 0);
  const sumY = data.reduce((s, d) => s + d.accuracy, 0);
  const sumXY = data.reduce((s, d) => s + d.study * d.accuracy, 0);
  const sumX2 = data.reduce((s, d) => s + d.study * d.study, 0);
  const sumY2 = data.reduce((s, d) => s + d.accuracy * d.accuracy, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}
```

### Performance

- Cache de 10 minutos (staleTime)
- Queries paralelas para study_progress e answer_progress
- Mapeamento em memoria (O(n) para cada tabela)

## Beneficios

1. **Insight Unico**: Correlacao que nao existe em nenhuma outra aba
2. **Acao Clara**: Gestores sabem onde investir em ativacao vs onde revisar conteudo
3. **Visual Impactante**: Radar chart comparativo e coeficiente de correlacao em destaque
4. **Contexto B2B**: Foco em oportunidades institucionais, nao metricas individuais

## Entregaveis

1. Tipos atualizados com `StudyVsPerformanceData`
2. Hook `useJourneyAnalytics` com nova query de correlacao
3. Novo componente `StudyCorrelationCard.tsx` com radar comparativo
4. Mapeamento de materias para grandes areas
5. Engine de insights automaticos de correlacao

