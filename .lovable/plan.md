

# Plano: Corrigir Indicador de Usuários Online

## Problema Identificado

O número **124 online** está completamente errado. O hook atual conta **todas as sessões iniciadas hoje**, não os usuários realmente online.

### Dados Reais do Banco

| Métrica | Valor |
|---------|-------|
| Sessões iniciadas hoje | 23 |
| Sessões sem `ended_at` (potencialmente ativas) | 17 |
| Sessões ativas nos últimos 15min | 6 |
| Sessões ativas nos últimos 5min | 2 |

### Problema no Código Atual

```typescript
// ERRADO - conta TODAS as sessões do dia
const { count: sessionsCount } = await supabase
  .from('user_sessions')
  .select('id', { count: 'exact', head: true })
  .gte('started_at', hoje.toISOString()); // <- conta sessões já finalizadas
```

---

## Solução Proposta

### Definição de "Online"

Usuário é considerado **online** se:
1. `ended_at IS NULL` (sessão não finalizada)
2. **E** `started_at` ou última atividade foi nos últimos **15 minutos**

Isso evita contar sessões "fantasmas" (usuário fechou aba sem finalizar sessão).

---

## Implementação

### 1. Corrigir Query do Hook

**Antes:**
```typescript
.gte('started_at', hoje.toISOString())
```

**Depois:**
```typescript
// Sessões ativas = ended_at IS NULL + atividade recente (15min)
const quinzeMinAtras = new Date(Date.now() - 15 * 60 * 1000).toISOString();

const { count } = await supabase
  .from('user_sessions')
  .select('id', { count: 'exact', head: true })
  .is('ended_at', null)
  .gte('started_at', quinzeMinAtras);
```

### 2. Atualizar Real-time

Além de escutar INSERTs, também escutar:
- **UPDATE** (quando sessão é atualizada com atividade)
- **DELETE** (quando sessão é encerrada)

E fazer **refresh periódico** a cada 30 segundos para precisão.

### 3. Melhorar o Indicador Visual

Adicionar contexto mais claro ao tooltip:

```
"X usuários ativos nos últimos 15 minutos"
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useOnlineUsersCount.ts` | Corrigir query para contar apenas sessões realmente ativas |

---

## Código Final do Hook

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ACTIVITY_WINDOW_MINUTES = 15;
const REFRESH_INTERVAL_MS = 30000; // 30 segundos

export const useOnlineUsersCount = () => {
  const [count, setCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadCount = useCallback(async () => {
    try {
      // Janela de atividade: últimos 15 minutos
      const activityThreshold = new Date(
        Date.now() - ACTIVITY_WINDOW_MINUTES * 60 * 1000
      ).toISOString();
      
      const { count: sessionsCount, error } = await supabase
        .from('user_sessions')
        .select('id', { count: 'exact', head: true })
        .is('ended_at', null) // Sessão não finalizada
        .gte('started_at', activityThreshold); // Atividade recente
      
      if (error) {
        console.error('Error fetching sessions count:', error);
        return;
      }
      
      setCount(sessionsCount || 0);
    } catch (err) {
      console.error('Error in loadCount:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCount();
    
    // Refresh periódico para precisão
    const interval = setInterval(loadCount, REFRESH_INTERVAL_MS);
    
    // Real-time para atualizações imediatas
    const channel = supabase
      .channel('online-users-count')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'user_sessions' },
        () => loadCount() // Recarrega em qualquer mudança
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadCount]);

  return { count, isConnected, isLoading };
};
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 124 online (errado) | ~6 online (correto) |
| Conta todas sessões do dia | Conta apenas sessões ativas |
| Atualiza só em INSERT | Atualiza em qualquer mudança + polling |

---

## Melhoria no Tooltip

Atualizar o `LiveUsersIndicator` para mostrar:

```
"X usuários ativos (últimos 15 min)"
```

Isso dá contexto sobre o que significa "online".

