
# Plano de Correção: Métrica "Ñ Resp." - IMPLEMENTADO ✓

## Problema Resolvido

A métrica de "Questões Não Respondidas" estava oscilando devido a:
1. Paginação paralela sem ordenação determinística
2. Dependência de `paresNoPeriodo` que ficava vazio em períodos sem novos eventos

## Correções Aplicadas

### 1. Paginação Determinística
- Adicionado `.order('answer_id', { ascending: true })` ao fetch de `answer_progress`
- Alterado de paginação paralela para sequencial para garantir consistência

### 2. Cálculo Corrigido
- Usa `simFinalizados` (já filtrados por data) como base de usuários
- Busca última tentativa por usuário (`ultimaFinalizacaoPorUsuario`)
- Combina `respostasRaw` + `historicoRaw` diretamente (não `historicoFiltrado`)
- Valida apenas `question_id` que existem em `questoes_simulado`
- Deduplica por `(user_id, question_id)` usando Set

### 3. Fórmula Final
```
Para cada usuário que finalizou no período:
  nao_respondidas = total_questoes_simulado - count(questoes_respondidas)

media = sum(nao_respondidas) / count(usuarios_finalizados)
```

## Resultado Esperado

- Valor **0.0** para simulados onde todos responderam 100%
- Consistente a cada refresh, independente do período selecionado
