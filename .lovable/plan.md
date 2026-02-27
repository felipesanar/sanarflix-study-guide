

## Correcao Sistematica do Flickering na Pagina "Seu Guia"

### Problema
Apos upload de novo guia e reload, a pagina pisca, mostra skeleton, some, e nao exibe conteudo. O problema e causado por multiplos ciclos de re-render e race conditions no carregamento de dados.

### Causas Raiz Identificadas

**1. `conteudos.length` na dependency array do useEffect principal (linha 386)**
O efeito que busca conteudos depende de `conteudos.length`. Quando `swrFetch` dispara a revalidacao em background e chama `onUpdate -> applyData -> setConteudos`, o tamanho muda, re-disparando o efeito. Isso cria um loop:
- Efeito roda -> busca dados -> `setConteudos` -> `conteudos.length` muda -> efeito roda de novo
- O guard `hasLoadedData.current` deveria impedir, mas combinado com a logica de merge em `applyData`, ha momentos onde o estado fica instavel

**2. `swrFetch` retorna `null` na primeira carga sem cache**
Quando nao ha cache, `swrFetch` retorna `null` imediatamente. O `if (cached && cached.length > 0)` falha, e `applyData` so e chamado quando o `onUpdate` do background fetch dispara. Mas ate la, o efeito pode re-executar por mudanca de dependencias, chamando `setIsLoading(true)` novamente (linha 321), causando flash do skeleton.

**3. `setTimeout` dentro de `useMemo` (linhas 822-825)**
O `selectedMateriaContents` usa `setTimeout(() => handleSemestreChange(...))` dentro de um `useMemo`, causando side effects em uma funcao pura e re-renders em cascata.

**4. Efeito de progresso reativo ao `selectedSemestre` (linhas 243-249)**
Quando `applyData` define `selectedSemestre`, o efeito de progresso dispara `loadAllProgress` que seta `loading = true`, adicionando mais flicker.

### Correcoes Planejadas

**Arquivo: `src/pages/StudyGuide.tsx`**

1. **Remover `conteudos.length` da dependency array do fetchConteudos** (linha 386)
   - Antes: `[user?.id_ies, user?.semestre, analytics, conteudos.length]`
   - Depois: `[user?.id_ies, user?.semestre]`
   - O `analytics` tambem e removido pois muda a cada render (nao e estavel)
   - Usar `analytics` via ref para evitar dependencia

2. **Substituir `swrFetch` por fetch direto com cache manual**
   - O padrao SWR com `onUpdate` e problematico aqui porque causa double-apply
   - Novo fluxo: tentar cache local -> se encontrar, aplicar e parar loading -> fazer fetch em background sem re-setar `isLoading(true)` -> quando chegar, atualizar silenciosamente

3. **Remover `setTimeout` do `useMemo` `selectedMateriaContents`** (linhas 822-825)
   - Substituir por um `useEffect` separado que reage a mudanca de `selectedEventMateria`
   - O `useMemo` deve ser puro (sem side effects)

4. **Estabilizar referencia de `analytics`**
   - Armazenar em ref para nao causar re-execucao de effects

5. **Proteger `isLoading` contra re-set desnecessario**
   - Adicionar guard: so setar `setIsLoading(true)` se realmente nao temos dados ainda
   - Usar `conteudos` via ref funcional (`setConteudos(prev => ...)`) em vez de depender do valor externo

6. **Desacoplar `loadAllProgress` do flicker**
   - O `loadAllProgress` nao deve setar `loading` no hook principal se ja temos dados visiveis
   - Ou: nao usar o `loading` do progress para condicionar a UI principal

### Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/StudyGuide.tsx` | Remover `conteudos.length` e `analytics` das deps do fetch effect |
| `src/pages/StudyGuide.tsx` | Substituir `swrFetch` por fetch direto com cache-first sem double-apply |
| `src/pages/StudyGuide.tsx` | Extrair side effect do `useMemo` `selectedMateriaContents` para `useEffect` |
| `src/pages/StudyGuide.tsx` | Proteger `setIsLoading(true)` com guard de dados existentes |
| `src/pages/StudyGuide.tsx` | Estabilizar `analytics` via ref |

### Resultado Esperado
- Sem flicker ao carregar a pagina (cache-first instantaneo ou skeleton unico)
- Dados novos atualizam silenciosamente em background sem piscar tela
- Side effects removidos de funcoes puras (useMemo)
- Ciclos de re-render eliminados por deps estabilizadas
