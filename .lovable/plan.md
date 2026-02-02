
# Plano: Corrigir Recarregamento de Skeleton ao Trocar Aba/Minimizar

## Problema Identificado

Quando o usuário troca de aba no navegador, minimiza/restaura a janela, ou navega entre páginas e volta, as telas reexibem o skeleton loading mesmo já tendo carregado anteriormente na sessão.

### Causa Raiz

1. **PageWrapper reinicia `isLoading = true`**: O componente usa `useState(true)` como valor inicial, então toda remontagem mostra o skeleton
2. **Páginas internas com loading próprio**: Home, StudyGuide e SimuladoDesempenho têm `useState(true)` interno que reseta ao remontar
3. **Cache não utilizado corretamente**: useHomeData tem cache em sessionStorage mas ainda inicia com `loading = true` antes de ler o cache

---

## Arquivos Afetados

| Arquivo | Problema | Solucao |
|---------|----------|---------|
| `src/components/PageWrapper.tsx` | Inicia com `isLoading = true` | Usar sessionStorage para inicializar como `false` se ja carregou |
| `src/pages/Home.tsx` | Mostra skeleton quando `loading` do hook e true | Confiar no cache do hook |
| `src/hooks/useHomeData.ts` | Inicia `loading = true` antes de ler cache | Ler cache sincronamente antes do estado inicial |
| `src/pages/StudyGuide.tsx` | Inicia `isLoading = true` | Ler cache do SWR sincronamente |
| `src/pages/SimuladoDesempenho.tsx` | Inicia `loading = true` | Usar React Query em vez de useEffect manual |

---

## Solucao Proposta

### 1. Corrigir PageWrapper

O PageWrapper deve verificar se a pagina ja foi visitada ANTES de definir o estado inicial:

```tsx
// ANTES
const [isLoading, setIsLoading] = useState(true);
const isFirstVisit = useRef(
  !sessionStorage.getItem(`visited_${location.pathname}`)
).current;

// DEPOIS
const wasVisited = sessionStorage.getItem(`visited_${location.pathname}`);
const [isLoading, setIsLoading] = useState(!wasVisited);
```

Alem disso, verificar se ha dados em cache do React Query antes de mostrar skeleton:

```tsx
const queryClient = useQueryClient();
const hasCachedData = useMemo(() => {
  const queries = queryClient.getQueryCache().getAll();
  return queries.some(q => q.state.data !== undefined && q.state.status === 'success');
}, []);

// Se ha dados em cache, nao mostrar loading
if (hasCachedData && wasVisited) {
  return <PageTransition>{children}</PageTransition>;
}
```

### 2. Corrigir useHomeData

Ler cache de forma sincrona para definir o estado inicial corretamente:

```tsx
// Funcao para ler cache sincronamente
const readCacheSync = (userId: string) => {
  try {
    const raw = sessionStorage.getItem(`home_data_cache_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp) < CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch {}
  return null;
};

// Estado inicial baseado no cache
const cachedData = user ? readCacheSync(user.id) : null;
const [loading, setLoading] = useState(!cachedData);
const [meuDiaItems, setMeuDiaItems] = useState<MeuDiaItem[]>(cachedData?.meuDiaItems || []);
// ... demais estados inicializados com cache
```

### 3. Corrigir Home.tsx

A pagina Home nao deve mostrar skeleton se ha dados em cache:

```tsx
// ANTES
if (loading) {
  return <HomePageSkeleton />;
}

// DEPOIS - Mostrar skeleton apenas se realmente nao ha dados
const hasData = meuDiaItems.length > 0 || simuladoData || Object.keys(rankings).length > 0;
if (loading && !hasData) {
  return <HomePageSkeleton />;
}
```

### 4. Corrigir StudyGuide.tsx

Usar o mesmo padrao - ler cache do SWR sincronamente:

```tsx
// Ler cache do performanceCache de forma sincrona
const cachedContents = useMemo(() => {
  try {
    const cacheKey = `study_contents_${user?.id_ies}_${user?.semestre}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.data && parsed.timestamp && (Date.now() - parsed.timestamp) < 2 * 60 * 60 * 1000) {
        return parsed.data;
      }
    }
  } catch {}
  return null;
}, [user?.id_ies, user?.semestre]);

const [conteudos, setConteudos] = useState<ConteudoData[]>(cachedContents || []);
const [isLoading, setIsLoading] = useState(!cachedContents);
```

### 5. Corrigir SimuladoDesempenho.tsx

Migrar para React Query que ja tem cache integrado:

```tsx
// Usar React Query em vez de useEffect manual
const { data: simuladoData, isLoading } = useQuery({
  queryKey: ['simulado-desempenho', selectedSimuladoId, selectedTentativa],
  queryFn: () => fetchSimuladoDesempenho(selectedSimuladoId, selectedTentativa),
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
});
```

---

## Resumo das Alteracoes

### Arquivos a Modificar

1. **src/components/PageWrapper.tsx**
   - Ler sessionStorage sincronamente para estado inicial
   - Verificar cache do React Query antes de mostrar skeleton
   - Nunca remontar como loading se dados existem

2. **src/hooks/useHomeData.ts**
   - Ler cache sincronamente para definir estados iniciais
   - Retornar `loading = false` se ha cache valido

3. **src/pages/Home.tsx**
   - Verificar se ha dados antes de mostrar skeleton

4. **src/pages/StudyGuide.tsx**
   - Ler cache do SWR sincronamente
   - Iniciar com dados do cache se disponivel

5. **src/pages/SimuladoDesempenho.tsx**
   - Migrar fetching para React Query
   - Aproveitar cache automatico

---

## Secao Tecnica

### Por que isso acontece?

React remonta componentes quando:
- O usuario navega entre rotas
- O componente pai re-renderiza
- A aba do navegador perde e ganha foco (em alguns casos)

Quando um componente remonta, todos os `useState` voltam ao valor inicial. Se o valor inicial for `true` para loading, o skeleton aparece novamente.

### Solucao tecnica

A chave e **inicializar o estado com o valor correto desde o primeiro render**:

```tsx
// Ruim - sempre comeca como true
const [loading, setLoading] = useState(true);

// Bom - verifica cache antes
const hasCache = sessionStorage.getItem('cache') !== null;
const [loading, setLoading] = useState(!hasCache);
```

### React Query ja resolve parte disso

O React Query mantem cache em memoria e nao refaz requests desnecessarios. Mas o problema e que as paginas ainda mostram skeleton enquanto verificam se ha dados.

A solucao e confiar no React Query e mostrar skeleton apenas quando `!data && isLoading`:

```tsx
// Ruim
if (isLoading) return <Skeleton />;

// Bom
if (isLoading && !data) return <Skeleton />;
```

### Ordem de implementacao

1. Corrigir PageWrapper (resolve 80% do problema)
2. Corrigir useHomeData (resolve Home)
3. Corrigir StudyGuide
4. Corrigir SimuladoDesempenho

---

## Comportamento Esperado Apos Correcao

| Cenario | Antes | Depois |
|---------|-------|--------|
| Primeira visita a pagina | Mostra skeleton | Mostra skeleton |
| Voltar a pagina visitada | Mostra skeleton | Mostra conteudo imediatamente |
| Trocar aba e voltar | Mostra skeleton | Mantem conteudo |
| Minimizar/restaurar | Mostra skeleton | Mantem conteudo |
| Refresh (F5) | Mostra skeleton | Mostra skeleton (correto) |

