
# Plano: Corrigir Rastreamento de Saídas de Fullscreen no Modo Prova

## Problema Identificado

O sistema de contabilização de saídas de fullscreen apresenta **duas falhas**:

| Problema | Local | Impacto |
|----------|-------|---------|
| **Bug de Stale Closure** | `useFocusControl.ts` | Nem todas as saídas de fullscreen são detectadas devido ao uso de estado desatualizado no callback |
| **Exibição incompleta** | `LiberacoesTab.tsx` | A coluna "Saídas" mostra apenas `saidas_de_aba`, ignorando `saidas_de_fullscreen` |

### Evidência
- Banco de dados registra `saidas_de_fullscreen: 1` mas usuário saiu **2 vezes**
- Admin mostra "0 saídas" porque só consulta `saidas_de_aba` (não inclui fullscreen)

---

## Análise Técnica Detalhada

### Bug 1: Stale Closure no useCallback

```typescript
// useFocusControl.ts - CÓDIGO ATUAL COM BUG
const handleFullscreenChange = useCallback(() => {
  const isFullscreen = !!document.fullscreenElement;
  const wasInFullscreen = !foraDeTelaCheia; // ❌ BUG: foraDeTelaCheia é stale!
  
  setForaDeTelaCheia(!isFullscreen);
  
  if (wasInFullscreen && !isFullscreen && onSaidaFullscreen) {
    onSaidaFullscreen();
  }
}, [foraDeTelaCheia, onSaidaFullscreen]); // Dependencies causam re-render
```

**Por que falha?**
1. Quando o componente renderiza, `foraDeTelaCheia = false` (fullscreen ativo)
2. Usuário pressiona Esc → `handleFullscreenChange` executa
3. `wasInFullscreen = !foraDeTelaCheia = true` ✅ Primeira saída detectada
4. `setForaDeTelaCheia(true)` é chamado → Causa RE-RENDER
5. O re-render recria `handleFullscreenChange` com novo valor de `foraDeTelaCheia`
6. **MAS**: O event listener ainda aponta para a versão ANTIGA do callback
7. Usuário entra fullscreen novamente → `setForaDeTelaCheia(false)`
8. Usuário sai novamente → callback antigo ainda tem `foraDeTelaCheia` desatualizado

### Bug 2: Exibição incompleta no Admin

```typescript
// LiberacoesTab.tsx - CÓDIGO ATUAL
interface SimuladoFinalizado {
  saidas_de_aba: number;
  // ❌ FALTA: saidas_de_fullscreen: number
}

// Na renderização:
<TableCell>
  {f.saidas_de_aba > 0 ? (
    <Badge variant="destructive">{f.saidas_de_aba}</Badge>
  ) : (
    <Badge variant="secondary">0</Badge>
  )}
</TableCell>
// ❌ Ignora completamente saidas_de_fullscreen
```

---

## Solução Proposta

### Correção 1: Usar `useRef` para estado real-time

Substituir a lógica que depende de state por uma que use `ref` para tracking sem stale closure:

```typescript
// useFocusControl.ts - CÓDIGO CORRIGIDO
const wasInFullscreenRef = useRef(false);

useEffect(() => {
  // Sincroniza ref com estado atual do fullscreen na montagem
  wasInFullscreenRef.current = !!document.fullscreenElement;
}, []);

const handleFullscreenChange = useCallback(() => {
  const isFullscreen = !!document.fullscreenElement;
  const wasInFullscreen = wasInFullscreenRef.current;
  
  // Atualiza ref ANTES de qualquer callback
  wasInFullscreenRef.current = isFullscreen;
  
  setForaDeTelaCheia(!isFullscreen);
  
  // Detecta saída: estava em fullscreen e agora não está
  if (wasInFullscreen && !isFullscreen && onSaidaFullscreen) {
    console.log('[FocusControl] Saída de fullscreen detectada');
    onSaidaFullscreen();
  }
}, [onSaidaFullscreen]); // Removido foraDeTelaCheia das deps
```

### Correção 2: Adicionar suporte a prefixed events (Safari/Firefox)

```typescript
useEffect(() => {
  const fullscreenEvents = [
    'fullscreenchange',
    'webkitfullscreenchange', // Safari
    'mozfullscreenchange'     // Firefox antigo
  ];
  
  fullscreenEvents.forEach(event => {
    document.addEventListener(event, handleFullscreenChange);
  });

  return () => {
    fullscreenEvents.forEach(event => {
      document.removeEventListener(event, handleFullscreenChange);
    });
  };
}, [handleFullscreenChange]);
```

### Correção 3: Atualizar interface e exibição no Admin

```typescript
// LiberacoesTab.tsx
interface SimuladoFinalizado {
  // ...
  saidas_de_aba: number;
  saidas_de_fullscreen: number; // ✅ ADICIONAR
}

// Na coluna "Saídas", mostrar AMBOS os valores:
<TableCell>
  <div className="flex flex-col gap-1">
    <Badge variant={totalSaidas > 0 ? 'destructive' : 'secondary'}>
      {totalSaidas} total
    </Badge>
    {(f.saidas_de_aba > 0 || f.saidas_de_fullscreen > 0) && (
      <span className="text-[10px] text-muted-foreground">
        {f.saidas_de_aba} aba / {f.saidas_de_fullscreen} fullscreen
      </span>
    )}
  </div>
</TableCell>
```

### Correção 4: Adicionar logging para debug

Incluir logs de console no `registrarSaidaFullscreen` para facilitar verificação:

```typescript
// useSimuladoStorage.ts
const registrarSaidaFullscreen = useCallback(() => {
  const estado = carregarEstado();
  if (!estado) return;

  const novoValor = (estado.saidas_de_fullscreen || 0) + 1;
  console.log(`[Storage] Registrando saída de fullscreen #${novoValor}`);
  
  salvarEstado({
    ...estado,
    saidas_de_fullscreen: novoValor
  });
}, [carregarEstado, salvarEstado]);
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useFocusControl.ts` | Corrigir stale closure usando `useRef`, adicionar suporte cross-browser |
| `src/hooks/useSimuladoStorage.ts` | Adicionar logging para debug |
| `src/components/admin/LiberacoesTab.tsx` | Incluir `saidas_de_fullscreen` na interface e exibição |

---

## Resultado Esperado

1. **Todas as saídas de fullscreen serão registradas** - 2 saídas = 2 registros
2. **Admin mostrará contagem correta** - Coluna "Saídas" exibirá total (aba + fullscreen) com breakdown
3. **Cross-browser** - Funcionará em Chrome, Safari e Firefox
4. **Debug facilitado** - Logs de console mostrarão cada registro

---

## Diagrama de Fluxo Corrigido

```text
+------------------+     +---------------------+     +------------------+
|  Usuário aperta  | --> |  fullscreenchange   | --> |  Callback com    |
|  ESC             |     |  evento dispara     |     |  ref atualizado  |
+------------------+     +---------------------+     +------------------+
                                                              |
                                                              v
                                   +---------------------------+
                                   |  wasInFullscreenRef.current|
                                   |  = valor REAL do momento   |
                                   +---------------------------+
                                              |
                                              v
                          +------------------+---------------------+
                          |  Se estava em fullscreen E saiu:      |
                          |  → onSaidaFullscreen()                |
                          |  → registrarSaidaFullscreen()         |
                          |  → salvarEstado() com contador +1     |
                          +---------------------------------------+
```
