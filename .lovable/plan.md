
# Plano: Tornar "O Que Estudar Hoje" Imediato como a Home

## Problema Identificado

O card "O Que Estudar Hoje" na página do Guia de Estudos demora a carregar porque o hook `useCalendarSync` aguarda uma resposta do banco de dados antes de exibir os dados, mesmo tendo um cache local disponível.

### Fluxo Atual (Lento)

```
1. Página carrega
2. useCalendarSync inicia com subjects = []
3. loading = true (mostra skeleton)
4. Aguarda loadFromDatabase() (chamada de rede)
5. Só então subjects = dados (mostra conteúdo)
```

### Fluxo da Home (Rápido)

```
1. Página carrega
2. readCacheSync() lê sessionStorage ANTES do useState
3. Estados inicializados COM dados do cache
4. loading = false (mostra conteúdo imediatamente)
5. Background: atualiza dados do servidor
```

---

## Solução

Aplicar a mesma estratégia "cache-first" do `useHomeData` no `useCalendarSync`:

1. **Leitura síncrona do cache** no início do hook (antes do `useState`)
2. **Inicialização do estado com dados do cache**
3. **Loading = false** se tiver cache
4. **Background refresh** para buscar dados atualizados do servidor

---

## Arquivo a Modificar

**`src/hooks/useCalendarSync.ts`**

### Mudanças

1. **Adicionar função de leitura síncrona** (similar ao `readCacheSync` da Home):

```typescript
// Leitura síncrona do cache ANTES do useState
const readCacheSync = (): CalendarSubject[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const data: StoredData = JSON.parse(stored);
    // Verificar se o cache é recente (últimos 30 minutos)
    const CACHE_TTL = 30 * 60 * 1000;
    if (data.subjects && data.lastUpdated && (Date.now() - data.lastUpdated) < CACHE_TTL) {
      return data.subjects;
    }
    return [];
  } catch {
    return [];
  }
};
```

2. **Modificar a inicialização do hook**:

```typescript
export const useCalendarSync = () => {
  const { user } = useAuth();
  
  // Leitura síncrona do cache ANTES do useState
  const cachedSubjects = useMemo(() => readCacheSync(), []);
  
  // Inicializar estado COM dados do cache (evita loading)
  const [subjects, setSubjects] = useState<CalendarSubject[]>(cachedSubjects);
  const [loading, setLoading] = useState(cachedSubjects.length === 0);
  // ...
```

3. **Modificar o useEffect de inicialização** para fazer refresh em background:

```typescript
useEffect(() => {
  const initialize = async () => {
    if (user?.id) {
      // Se já tem cache, não mostrar loading (atualiza em background)
      if (cachedSubjects.length > 0) {
        // Atualizar em background sem mostrar loading
        const serverSubjects = await loadFromDatabase();
        setSubjects(serverSubjects);
        saveToLocalStorage(serverSubjects);
      } else {
        // Sem cache: loading normal
        setLoading(true);
        const serverSubjects = await loadFromDatabase();
        setSubjects(serverSubjects);
        saveToLocalStorage(serverSubjects);
        setLoading(false);
      }
    } else {
      // Usuário não autenticado
      if (cachedSubjects.length === 0) {
        const localSubjects = loadFromLocalStorage();
        setSubjects(localSubjects);
      }
      setLoading(false);
    }
  };

  initialize();
}, [user, loadFromDatabase, loadFromLocalStorage, saveToLocalStorage]);
```

---

## Fluxo Após Correção

```
ANTES (Lento):
┌─────────────────────────────────────────────────────────┐
│ 1. useCalendarSync inicia                               │
│ 2. subjects = [] (vazio)                                │
│ 3. loading = true                                       │
│ 4. Mostra skeleton ⏳                                   │
│ 5. Aguarda loadFromDatabase() (300-800ms)               │
│ 6. subjects = dados                                     │
│ 7. loading = false                                      │
│ 8. Mostra conteúdo ✅                                   │
└─────────────────────────────────────────────────────────┘

DEPOIS (Imediato):
┌─────────────────────────────────────────────────────────┐
│ 1. readCacheSync() (síncrono, < 1ms)                    │
│ 2. subjects = dados do cache                            │
│ 3. loading = false                                      │
│ 4. Mostra conteúdo imediatamente ✅                     │
│ 5. Background: loadFromDatabase()                       │
│ 6. Atualiza subjects se houver diferença                │
└─────────────────────────────────────────────────────────┘
```

---

## Benefícios

- **Experiência instantânea**: O card mostra os dados imediatamente em revisitas
- **Consistência**: Mesma estratégia usada na Home
- **Dados atualizados**: Background refresh garante sincronização com o servidor
- **Zero flicker**: Sem skeleton desnecessário quando há cache

---

## Detalhes Técnicos

| Aspecto | Valor |
|---------|-------|
| Cache TTL | 30 minutos (localStorage) |
| Leitura síncrona | `readCacheSync()` antes do useState |
| Background refresh | Sempre busca do servidor, mesmo com cache |
| Fallback | Se cache expirado/vazio, mostra loading normalmente |
