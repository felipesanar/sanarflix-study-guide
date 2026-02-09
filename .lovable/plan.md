

# Plano: Indicador de Usuários Online no Header do Analytics

## Resumo

Remover a aba "Tempo Real" completa e adicionar um indicador compacto e elegante de acompanhamento em tempo real diretamente no header do Analytics.

---

## Mudanças Propostas

### O que será removido
- Aba "Tempo Real" da TabsList (6 abas -> 5 abas)
- TabsContent correspondente ao realtime
- Condicional de filtros `activeTab !== 'realtime'`

### O que será adicionado
- **Live Users Badge** no header com contador de sessões ativas
- Indicador visual de conexão (ponto pulsante verde quando conectado)
- Tooltip com mais detalhes ao passar o mouse

---

## Design do Indicador

```
+-------------------------------------------------------+
| [BarChart3] Analytics    [LiveBadge] [Refresh] [Export]
+-------------------------------------------------------+

LiveBadge (quando conectado):
+----------------------------------+
| ● 47 online                      |
| (ponto verde pulsante)           |
+----------------------------------+

Tooltip ao hover:
+----------------------------------+
| Usuários com sessão ativa hoje   |
| Atualizado em tempo real         |
+----------------------------------+

LiveBadge (quando desconectado):
+----------------------------------+
| ○ Offline                        |
| (ponto cinza, sem animação)      |
+----------------------------------+
```

---

## Implementação Técnica

### 1. Criar componente `LiveUsersIndicator`

Novo componente leve e reutilizável:

```typescript
// src/components/analytics/LiveUsersIndicator.tsx

interface LiveUsersIndicatorProps {
  sessionsCount: number;
  isConnected: boolean;
}

const LiveUsersIndicator = ({ sessionsCount, isConnected }: LiveUsersIndicatorProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1.5 px-2.5 py-1">
          {/* Ponto pulsante */}
          <span className="relative flex h-2 w-2">
            {isConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400" />
            )}
          </span>
          
          {/* Contador */}
          <span className="text-xs font-medium tabular-nums">
            {isConnected ? `${sessionsCount.toLocaleString('pt-BR')} online` : 'Offline'}
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isConnected 
          ? 'Sessões ativas hoje (tempo real)' 
          : 'Conexão realtime perdida'}</p>
      </TooltipContent>
    </Tooltip>
  );
};
```

### 2. Criar hook simplificado `useOnlineUsersCount`

Hook leve que só monitora o contador de sessões:

```typescript
// src/hooks/useOnlineUsersCount.ts

export const useOnlineUsersCount = () => {
  const [count, setCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Buscar contagem inicial
    const loadCount = async () => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const { count } = await supabase
        .from('user_sessions')
        .select('id', { count: 'exact', head: true })
        .gte('started_at', hoje.toISOString());
      
      setCount(count || 0);
    };
    
    loadCount();
    
    // Escutar novas sessões em tempo real
    const channel = supabase
      .channel('online-users-count')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'user_sessions' },
        () => setCount(prev => prev + 1)
      )
      .subscribe(status => setIsConnected(status === 'SUBSCRIBED'));
    
    return () => supabase.removeChannel(channel);
  }, []);

  return { count, isConnected };
};
```

### 3. Modificar `Analytics.tsx`

**Remover:**
- Import do `RealtimeDashboard`
- Import do ícone `Radio`
- Aba e conteúdo "realtime" da TabsList e TabsContent
- Condicional `activeTab !== 'realtime'`

**Adicionar:**
- Import do `LiveUsersIndicator` e `useOnlineUsersCount`
- Renderizar indicador no header entre o título e os botões

**Layout do header atualizado:**
```
+----------------------------------------------------------------+
| [BarChart3] Analytics                                           |
|                      [● 47 online] [Atualizar] [Status] [Export]|
+----------------------------------------------------------------+
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/analytics/LiveUsersIndicator.tsx` | **CRIAR** - Novo componente |
| `src/hooks/useOnlineUsersCount.ts` | **CRIAR** - Hook simplificado |
| `src/pages/Analytics.tsx` | **MODIFICAR** - Remover aba, adicionar indicador |

---

## Vantagens da Mudança

1. **Simplicidade**: Interface mais limpa com 5 abas ao invés de 6
2. **Visibilidade**: Informação de tempo real sempre visível no header
3. **Performance**: Hook mais leve que só monitora 1 métrica
4. **UX**: Usuário não precisa ir até uma aba separada para ver status online
5. **Consistência**: Grid de 5 colunas é mais balanceado visualmente

---

## Comportamento Esperado

| Estado | Visual |
|--------|--------|
| Conectado | Ponto verde pulsante + "47 online" |
| Desconectado | Ponto cinza estático + "Offline" |
| Carregando | Ponto cinza + "..." ou skeleton |

