

## Bug: Dropdown de Semestres Incompleto (Global)

### Causa Raiz
A query `listSemestresOnly` na Edge Function `get-study-contents` busca a coluna `semestre` da tabela `conteudos` **sem limite explícito**. O Supabase aplica um limite padrão de **1000 linhas**. Para IES com mais de 1000 registros (Claretiano tem 3853), os semestres que aparecem apenas apos a linha 1000 nunca sao retornados -- por isso so aparecem 1, 2 e 3.

### Correcao

**Arquivo:** `supabase/functions/get-study-contents/index.ts`

Na secao `listSemestresOnly` (por volta da linha 87), a query precisa de um mecanismo para garantir que **todos** os registros sejam considerados. A solucao mais simples e eficiente:

```text
Antes:
  .select('semestre')
  .eq('id_ies', userData.id_ies)

Depois:
  .select('semestre')
  .eq('id_ies', userData.id_ies)
  .limit(10000)
```

Adicionar `.limit(10000)` garante que ate 10.000 linhas sejam retornadas (cobertura suficiente para qualquer IES). O `new Set()` ja existente no codigo faz a deduplicacao em memoria.

### Alternativa mais eficiente (opcional)
Uma abordagem mais elegante seria usar paginacao como ja e feito na query principal, ou criar uma RPC no banco com `SELECT DISTINCT semestre FROM conteudos WHERE id_ies = $1`. Porem, dado que a coluna `semestre` tem poucos valores distintos e o `.limit(10000)` resolve o problema de forma simples e segura, essa e a correcao recomendada.

### Impacto
- Corrige o problema para **todas as IES** com mais de 1000 registros de conteudo
- Nenhuma mudanca no frontend necessaria -- o dropdown ja exibe todos os valores retornados

### Arquivo afetado
| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/get-study-contents/index.ts` | Adicionar `.limit(10000)` na query `listSemestresOnly` |

