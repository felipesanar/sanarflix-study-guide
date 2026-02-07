
# Diagnóstico: Inconsistência na Média de Questões Não Respondidas

## Problema Identificado

A média de questões não respondidas (`questoes_nao_respondidas_media`) varia a cada atualização porque o cálculo depende do **filtro de período** selecionado, que afeta a lista de usuários considerados.

### Causa Raiz

O código aplica um filtro temporal chamado `paresNoPeriodo` que:

1. Busca apenas `iniciados` e `finalizados` dentro do dateRange selecionado
2. Cria um Set de pares `user_id_simulado_id` que atuaram no período
3. Filtra as respostas (`answer_progress`) para incluir apenas esses pares

**O problema**: A tabela `answer_progress` **não tem coluna de timestamp**. Por isso:

- Quando o período selecionado é "hoje" e não há nenhum início/finalização nesse dia, `paresNoPeriodo` fica vazio
- Com `paresNoPeriodo` vazio, nenhuma resposta é incluída em `simRespostas`
- O cálculo `usersWithResponses` fica com Map vazio
- Resultado: média = 0

### Comportamento Observado

| Período Selecionado | iniciados | finalizados | paresNoPeriodo | Média Calculada |
|---------------------|-----------|-------------|----------------|-----------------|
| Hoje (07/02) | 0 | 0 | vazio | 0 (incorreto) |
| Esta semana | 108 | 219 | 327 pares | ~4-6 (correto) |
| Último mês | 200+ | 300+ | 500+ pares | ~4-6 (correto) |

### Por que oscila entre atualizações?

O filtro de data padrão provavelmente usa `new Date()` que muda a cada refresh, às vezes pegando início/fim do dia de forma diferente (especialmente com timezone de Brasília).

---

## Solução Proposta

Corrigir a lógica de cálculo de `questoes_nao_respondidas_media` para que utilize os **usuários que finalizaram** (tabela `simulados_finalizados`) como base, não os que têm respostas no período.

### Mudança no Hook

Modificar a lógica em `useSimuladosAnalytics.ts` (linhas 606-624):

**Antes (problemático)**:
```typescript
// Usa simRespostas que depende de paresNoPeriodo
const usersWithResponses = new Map<string, Set<string>>();
simRespostas.forEach(r => {
  // ...calcula questões respondidas por usuário
});
```

**Depois (corrigido)**:
```typescript
// Usa simFinalizados como fonte de usuários participantes
// E busca todas as respostas desses usuários (sem filtro temporal)
const usersFinalizados = simFinalizados.map(f => f.user_id);
const todasRespostasDoSimulado = respostasRaw.filter(
  r => r.simulado === s.id && usersFinalizados.includes(r.user_id)
);
```

### Lógica Corrigida

1. **Base de usuários**: Usuários que **finalizaram** o simulado no período (já filtrado por data)
2. **Respostas contadas**: Todas as respostas desses usuários para o simulado específico (sem filtro `paresNoPeriodo`)
3. **Cálculo**: Para cada usuário finalizado, contar quantas questões do simulado ele NÃO respondeu

### Detalhes da Implementação

```text
┌─────────────────────────────────────────────────────────────┐
│ CÁLCULO ATUAL (INCORRETO)                                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Filtra respostas por paresNoPeriodo (temporal)          │
│ 2. Agrupa respostas por user_id                            │
│ 3. Calcula: total_questoes - questoes_respondidas          │
│ 4. ❌ Quando paresNoPeriodo vazio → resultado 0            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CÁLCULO CORRIGIDO                                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Obtém lista de user_ids de simFinalizados (já filtrado) │
│ 2. Para cada user, busca TODAS respostas em answer_progress│
│ 3. Calcula: total_questoes - questoes_respondidas          │
│ 4. ✓ Consistente independente do período                   │
└─────────────────────────────────────────────────────────────┘
```

### Arquivos a Modificar

**`src/hooks/useSimuladosAnalytics.ts`** (linhas 606-625):

- Modificar o cálculo de `questoesNaoRespondidasMedia` dentro do `.map()` de `simuladosOverview`
- Usar `simFinalizados` como base de usuários
- Filtrar diretamente de `respostasRaw` sem passar por `paresNoPeriodo`

### Vantagens da Correção

- Consistência: mesmo resultado independente de quando a página é carregada
- Precisão: conta corretamente questões não respondidas por quem finalizou
- Performance: mantém a mesma lógica, apenas ajusta a fonte de dados

---

## Teste de Validação

Após implementação, o valor esperado pode ser verificado com esta query:

```sql
-- Para o simulado 405e21e9
SELECT 
  100 - AVG(questoes_respondidas) as media_nao_respondidas
FROM (
  SELECT 
    ap.user_id,
    COUNT(DISTINCT ap.question_id) as questoes_respondidas
  FROM answer_progress ap
  WHERE ap.simulado = '405e21e9-7896-4c9f-86f7-5e21c27e22d8'
    AND ap.user_id IN (
      SELECT user_id FROM simulados_finalizados 
      WHERE simulado_id = '405e21e9-7896-4c9f-86f7-5e21c27e22d8'
    )
  GROUP BY ap.user_id
) sub
```

Resultado esperado: ~0 (pois 100 questões e a maioria respondeu todas)
