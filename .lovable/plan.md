

# Correcao: Skeleton Desaparece + Otimizacao de Performance do Guia de Estudos

## Problemas Identificados

### 1. Tela preta durante carregamento (bug critico)

O fluxo atual na primeira visita (sem cache):

```text
1. isLoading = true          --> Skeleton aparece
2. swrFetch() retorna null   --> Sem cache disponivel
3. finally { isLoading = false }  --> Skeleton SOME
4. ... aguardando resposta da Edge Function ...
5. onUpdate(data) chega      --> Dados aparecem, mas tela ficou preta no intervalo
```

O `swrFetch` retorna `null` imediatamente quando nao ha cache. O bloco `finally` desliga o loading antes dos dados chegarem. Resultado: tela preta sem nenhum indicador de progresso.

### 2. Edge Function carrega TODOS os registros (3853 linhas)

A Edge Function `get-study-contents` busca todos os conteudos da IES sem filtrar por semestre. Para o Claretiano, sao 3853 registros em 4 queries sequenciais de 1000 linhas cada. O aluno tipicamente precisa de apenas 1 semestre (~200-400 linhas).

### 3. Paginacao sequencial na Edge Function

As 4 paginas de 1000 registros sao buscadas uma apos a outra (while loop). Isso pode ser paralelizado.

---

## Solucao

### Parte 1: Corrigir o skeleton que desaparece prematuramente

**Arquivo**: `src/pages/StudyGuide.tsx`

Ajustar a logica de loading para que `isLoading` so seja desligado quando os dados realmente chegam:

- Mover `setIsLoading(false)` para dentro do callback `onUpdate` do `swrFetch` e para dentro do bloco `if (cached)`.
- Remover o `setIsLoading(false)` do bloco `finally` e substitui-lo por uma logica condicional: so desliga se ja tem dados (`hasLoadedData.current === true`) ou se ocorreu erro.
- Adicionar um **timeout de seguranca** (15s) para evitar loading infinito caso a Edge Function falhe silenciosamente.

Fluxo corrigido:

```text
1. isLoading = true          --> Skeleton aparece
2. swrFetch() retorna null   --> Sem cache, skeleton CONTINUA
3. ... aguardando resposta ...
4. onUpdate(data) chega      --> setIsLoading(false), conteudo aparece
```

### Parte 2: Filtrar por semestre na Edge Function

**Arquivo**: `supabase/functions/get-study-contents/index.ts`

- Aceitar um parametro opcional `semestre` via query string ou body JSON.
- Quando fornecido, adicionar `.eq('semestre', semestre)` a query, reduzindo de ~3853 para ~200-400 registros.
- Quando nao fornecido, manter o comportamento atual (buscar tudo) para retrocompatibilidade.

**Arquivo**: `src/pages/StudyGuide.tsx`

- Na primeira carga, buscar apenas o semestre do usuario (rapido).
- Ao trocar de semestre, buscar os dados daquele semestre especifico se nao estiverem em cache.
- Manter cache por semestre com chave `study_contents_{iesId}_{semestre}`.

### Parte 3: Skeleton persistente com indicador de progresso

**Arquivo**: `src/components/guia-estudos/GuideSkeletons.tsx`

- Adicionar uma mensagem de texto animada ao `GuidePageSkeleton` ("Carregando seu guia de estudos...") para dar feedback visual claro de que a pagina esta ativa.

---

## Detalhes Tecnicos

### Mudancas no `StudyGuide.tsx`

O efeito `fetchConteudos` sera reestruturado:

```text
fetchConteudos:
  1. Se tem cache local (readStudyGuideCache), usar imediatamente e setar isLoading=false
  2. Chamar Edge Function com semestre do usuario
  3. Ao receber resposta: setar dados, setar isLoading=false
  4. Timeout de 15s: se nao recebeu resposta, setar isLoading=false e mostrar erro
  5. Bloco catch: setar isLoading=false e mostrar toast de erro
```

### Mudancas na Edge Function `get-study-contents`

- Ler `semestre` de `URL.searchParams` ou do corpo JSON
- Se presente: `query.eq('semestre', semestre)` -- elimina paginacao (resultado < 1000 linhas)
- Se ausente: manter loop de paginacao atual

### Mudancas no `GuidePageSkeleton`

- Adicionar texto "Carregando seu guia..." com animacao de pulso abaixo dos skeletons de cards

---

## Resumo de Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/pages/StudyGuide.tsx` | Corrigir timing do isLoading; passar semestre para Edge Function; timeout de seguranca |
| `supabase/functions/get-study-contents/index.ts` | Aceitar filtro opcional de semestre na query |
| `src/components/guia-estudos/GuideSkeletons.tsx` | Adicionar mensagem de carregamento visivel |

