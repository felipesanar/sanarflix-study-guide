

# Plano: Corrigir Indicador de Online para Resposta Imediata

## Problema Identificado

A implementação atual tem problemas de arquitetura que causam delay:

1. **Dois canais separados**: `usePresenceTracker` (no Layout) e `useOnlineUsersCount` (no Analytics) criam canais independentes
2. **Inicialização lenta**: Cada canal precisa fazer handshake WebSocket separado (~500ms-2s)
3. **Estado `isLoading=true`** mostra skeleton enquanto conecta

### Diagrama do Problema Atual

```
Layout monta → usePresenceTracker → conecta canal 1 → track()
                                    ↓
                              (já existe um canal)

Analytics monta → useOnlineUsersCount → conecta canal 2 → espera sync
                                        ↓
                                   (delay de 1-3 segundos)
```

---

## Solução: Canal Único e Compartilhado

Usar um **único canal de presença** que é compartilhado entre tracker e contador:

### Nova Arquitetura

```
Layout monta → usePresenceTracker → conecta canal único → track()
                                           ↓
                                    (canal já conectado)
                                           ↓
Analytics monta → useOnlineUsersCount → reutiliza canal → count IMEDIATO
```

---

## Implementação

### 1. Criar Serviço Singleton de Presença

Novo arquivo `src/services/presenceService.ts`:

```typescript
import { supabase } from '@/integrations/supabase/client';

const CHANNEL_NAME = 'online-users';

class PresenceService {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private subscribers = new Set<() => void>();
  private isConnected = false;

  getChannel() {
    if (!this.channel) {
      this.channel = supabase.channel(CHANNEL_NAME, {
        config: { presence: { key: 'shared' } },
      });
      
      this.channel
        .on('presence', { event: 'sync' }, () => this.notify())
        .on('presence', { event: 'join' }, () => this.notify())
        .on('presence', { event: 'leave' }, () => this.notify())
        .subscribe((status) => {
          this.isConnected = status === 'SUBSCRIBED';
          this.notify();
        });
    }
    return this.channel;
  }

  getState() {
    return this.channel?.presenceState() ?? {};
  }

  getCount() {
    const state = this.getState();
    return Object.keys(state).length;
  }

  getIsConnected() {
    return this.isConnected;
  }

  subscribe(callback: () => void) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify() {
    this.subscribers.forEach(cb => cb());
  }

  async track(userId: string, metadata: Record<string, any>) {
    const channel = this.getChannel();
    await channel.track({ user_id: userId, ...metadata });
  }

  async untrack() {
    await this.channel?.untrack();
  }
}

export const presenceService = new PresenceService();
```

### 2. Simplificar `usePresenceTracker`

Apenas registra o usuário no serviço compartilhado:

```typescript
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { presenceService } from '@/services/presenceService';

export const usePresenceTracker = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    // Conecta ao canal compartilhado e faz track
    presenceService.track(user.id, {
      email: user.email,
      name: user.nome || user.email?.split('@')[0],
      online_at: new Date().toISOString(),
    });

    return () => {
      presenceService.untrack();
    };
  }, [user?.id, user?.email, user?.nome]);
};
```

### 3. Simplificar `useOnlineUsersCount`

Usa o serviço já conectado:

```typescript
import { useState, useEffect, useSyncExternalStore } from 'react';
import { presenceService } from '@/services/presenceService';

export const useOnlineUsersCount = () => {
  // Inicia o canal imediatamente (sem esperar)
  presenceService.getChannel();

  const subscribe = (onStoreChange: () => void) => {
    return presenceService.subscribe(onStoreChange);
  };

  const getSnapshot = () => ({
    count: presenceService.getCount(),
    isConnected: presenceService.getIsConnected(),
  });

  const state = useSyncExternalStore(subscribe, getSnapshot);

  return {
    count: state.count,
    isConnected: state.isConnected,
    isLoading: false, // Nunca loading, mostra 0 enquanto conecta
  };
};
```

### 4. Atualizar `LiveUsersIndicator`

Sem skeleton, mostra valor imediato:

```typescript
export const LiveUsersIndicator = ({ sessionsCount, isConnected }) => {
  return (
    <Badge variant="outline" className="gap-1.5">
      <span className="relative flex h-2 w-2">
        {isConnected ? (
          <>
            <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative rounded-full h-2 w-2 bg-emerald-500" />
          </>
        ) : (
          <span className="relative rounded-full h-2 w-2 bg-amber-500 animate-pulse" />
        )}
      </span>
      <span className="text-xs font-medium tabular-nums">
        {sessionsCount} online
      </span>
    </Badge>
  );
};
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `src/services/presenceService.ts` | **CRIAR** - Singleton de presença |
| `src/hooks/usePresenceTracker.ts` | **SIMPLIFICAR** - Usar serviço |
| `src/hooks/useOnlineUsersCount.ts` | **SIMPLIFICAR** - Usar serviço |
| `src/components/analytics/LiveUsersIndicator.tsx` | **ATUALIZAR** - Remover skeleton |

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 1-3s delay com skeleton | **Instantâneo** (0 delay) |
| 2 canais WebSocket | 1 canal compartilhado |
| Loading state bloqueia UI | Mostra "0 online" e atualiza |
| Reconecta a cada página | Mantém conexão ativa |

---

## Benefícios

1. **Resposta imediata**: Contador aparece instantaneamente
2. **Menos conexões**: Um único WebSocket em vez de dois
3. **Estado consistente**: Mesmo número em todas as páginas
4. **Melhor UX**: Sem flickering de skeleton
5. **Performance**: `useSyncExternalStore` é otimizado para re-renders

