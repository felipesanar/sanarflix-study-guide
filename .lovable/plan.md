
# Plano de Correção: Métrica "Ñ Resp." Inconsistente

## Diagnóstico Confirmado

A métrica de "Questões Não Respondidas" está oscilando porque:

1. **O fetch de `respostasRaw` depende de `participantUserIds`** - que é construído a partir de `iniciados` + `finalizados` filtrados por período
2. **Quando o período selecionado não tem novos eventos**, `participantUserIds` fica vazio ou parcial
3. **O `respostasRaw` retorna vazio ou incompleto** → código calcula incorretamente
4. **Resultado**: valores aleatórios (11.9, 28.0, 0.0) a cada refresh dependendo de timing/cache

## Dados Reais do Banco (confirmados via SQL)

| Simulado | Usuários | Questões | Média Não Resp. Real |
|----------|----------|----------|----------------------|
| 405e21e9 | 107 | 100 | **0.0** |
| ad913cfd | 108 | 100 | **0.0** |
| fb732f24 | 4 | 100 | **0.0** |

Todos os usuários responderam 100% das questões. A média correta é **0.0** para todos.

## Solução

Modificar o cálculo de `questoes_nao_respondidas_media` para:

1. Usar `simFinalizados` (já filtrados por período) como base de usuários - conforme confirmado com o usuário
2. Para cada usuário que finalizou, buscar TODAS as respostas dele em `answer_progress` diretamente (nova query dedicada ou usar `respostasRaw` corretamente)
3. O problema atual é que `respostasRaw` depende de `participantUserIds` que muda com o período

### Correção Técnica

O código atual (linhas 606-636) já usa `usersFinalizados` e `respostasRaw` mas o `respostasRaw` foi fetched com uma lista de userIds que pode estar incompleta. A correção é garantir que o `respostasRaw` sempre contenha dados de todos os usuários que finalizaram no período.

**Arquivo**: `src/hooks/useSimuladosAnalytics.ts`

**Mudança 1**: Garantir que `participantUserIds` inclua os IDs de `finalizados` mesmo quando `iniciados` estiver vazio para o período

**Mudança 2**: No cálculo de `questoesNaoRespondidasMedia`, filtrar diretamente de `respostasRaw` usando apenas `simulado` e `usersFinalizados`, sem depender de outras variáveis intermediárias

### Código Corrigido

```typescript
// Na construção de participantUserIds (linha ~419)
// Garantir que pegamos TODOS os user_ids necessários
const participantUserIds = Array.from(
  new Set([
    ...iniciados.map(i => i.user_id), 
    ...finalizados.map(f => f.user_id)
  ])
);

// No cálculo de questoesNaoRespondidasMedia (linhas 606-636)
// Usar simFinalizados como base e filtrar respostasRaw corretamente
const totalQuestoes = simQuestoes.length;
const usersFinalizados = new Set(simFinalizados.map(f => f.user_id));

// Filtrar respostas: apenas do simulado atual e de usuários que finalizaram
// IMPORTANTE: respostasRaw já foi buscado com os userIds corretos
const todasRespostasDoSimulado = respostasRaw.filter(
  r => r.simulado === s.id && usersFinalizados.has(r.user_id)
);

// Agrupar por usuário
const respostasPorUsuario = new Map<string, Set<string>>();
todasRespostasDoSimulado.forEach(r => {
  if (!respostasPorUsuario.has(r.user_id)) {
    respostasPorUsuario.set(r.user_id, new Set());
  }
  respostasPorUsuario.get(r.user_id)!.add(r.question_id);
});

// Calcular não respondidas por usuário
const naoRespondidasPorUsuario: number[] = [];
usersFinalizados.forEach(userId => {
  const questoesRespondidas = respostasPorUsuario.get(userId)?.size || 0;
  const naoRespondidas = totalQuestoes - questoesRespondidas;
  naoRespondidasPorUsuario.push(Math.max(0, naoRespondidas));
});

const questoesNaoRespondidasMedia = naoRespondidasPorUsuario.length > 0
  ? naoRespondidasPorUsuario.reduce((a, b) => a + b, 0) / naoRespondidasPorUsuario.length
  : 0;
```

### Problema Real Identificado

Ao revisar mais detalhadamente, o problema real é que o `fetchAllAnswerProgress` é chamado com `participantUserIds` que vem de `iniciados` + `finalizados`. Quando você filtra por um período sem eventos:

1. `iniciados` = vazio (nenhum início no período)
2. `finalizados` = vazio (nenhuma conclusão no período)
3. `participantUserIds` = vazio
4. `respostasRaw` = vazio (query com IN vazio retorna nada)
5. O cálculo falha

**Mas** quando há dados no período:
1. `finalizados` = lista de finalizações
2. `participantUserIds` = inclui esses usuários
3. `respostasRaw` busca as respostas deles
4. O cálculo funciona

O problema é que às vezes o filtro de período muda ou o cache invalida, causando oscilações.

### Solução Simplificada

Como a tabela `answer_progress` não tem timestamp, a única forma confiável é:

1. Identificar usuários que finalizaram no período (já temos via `simFinalizados`)
2. Usar `respostasRaw` que já foi buscado - garantindo que contenha dados desses usuários
3. A lógica atual está correta, mas o `respostasRaw` pode estar sendo buscado com IDs incorretos

**A correção real** é garantir que quando `finalizados` tem dados, os IDs deles estejam em `participantUserIds` mesmo que `iniciados` esteja vazio. Isso já deveria acontecer pela lógica atual, mas vamos garantir explicitamente.

### Teste de Validação

Adicionar logs temporários para debug:

```typescript
console.log('[SimuladoOverview] Debug:', {
  simuladoId: s.id,
  totalQuestoes,
  usersFinalizadosCount: usersFinalizados.size,
  respostasRawCount: respostasRaw.length,
  todasRespostasDoSimuladoCount: todasRespostasDoSimulado.length,
  respostasPorUsuarioSize: respostasPorUsuario.size,
  questoesNaoRespondidasMedia
});
```

## Resultado Esperado

- Valor consistente a cada refresh (0.0 para os simulados atuais onde todos responderam tudo)
- Funciona corretamente com qualquer filtro de período
- Valores precisos quando houver realmente questões não respondidas

## Arquivos a Modificar

- `src/hooks/useSimuladosAnalytics.ts`
