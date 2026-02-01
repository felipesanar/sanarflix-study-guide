

# Plano: Correcao do Gargalo no Cronometro do Modo Prova

## Problema Identificado

Cada interacao no Modo Prova (selecionar alternativa, mudar de questao, marcar revisao) causa um pequeno travamento no cronometro. Isso acontece porque:

1. Operacoes sincronas de localStorage bloqueiam a thread principal
2. O callback `onAtualizarTempo` causa re-criacao do intervalo do cronometro
3. Cada interacao le e escreve o estado inteiro no localStorage
4. Re-renders desnecessarios afetam a fluidez

## Analise Tecnica Detalhada

| Problema | Causa | Impacto |
|----------|-------|---------|
| localStorage sincrono | `JSON.parse/stringify` em cada operacao | Bloqueia main thread ~10-50ms |
| Intervalo reinicializado | `onAtualizarTempo` nas dependencias do useEffect | Timer "pula" ao re-renderizar |
| Multiplas leituras por interacao | Padrao carregar-modificar-salvar | Operacoes duplicadas |
| Estado completo atualizado | `setEstado(novoEstado)` apos cada interacao | Re-render do componente inteiro |

## Solucao Proposta

### 1. Remover `onAtualizarTempo` do Cronometro

O tempo nao precisa ser salvo no localStorage a cada segundo. O deadline ja esta armazenado e o tempo restante pode ser recalculado a qualquer momento.

**Arquivo:** `src/pages/ModoProva.tsx`

Remover a prop `onAtualizarTempo` do hook useCronometro:

```typescript
// ANTES - causa re-render e re-criacao do intervalo a cada segundo
const cronometro = useCronometro({
  dataEncerramento,
  onTempoEsgotado: () => { ... },
  onAtualizarTempo: (tempo) => {
    storage.atualizarTempo(tempo); // REMOVE ISSO
  }
});

// DEPOIS - cronometro puro sem side-effects
const cronometro = useCronometro({
  dataEncerramento,
  onTempoEsgotado: () => { ... }
});
```

### 2. Tornar o Hook useCronometro Mais Estavel

**Arquivo:** `src/hooks/useCronometro.ts`

Modificar para nao aceitar `onAtualizarTempo` ou usa-lo com `useRef` para evitar re-criacao do intervalo:

```typescript
interface UseCronometroProps {
  dataEncerramento: string | null;
  onTempoEsgotado: () => void;
  // REMOVER: onAtualizarTempo - desnecessario
}

export const useCronometro = ({
  dataEncerramento,
  onTempoEsgotado
}: UseCronometroProps) => {
  // Usar ref para callback de tempo esgotado para evitar re-criacao do intervalo
  const onTempoEsgotadoRef = useRef(onTempoEsgotado);
  
  useEffect(() => {
    onTempoEsgotadoRef.current = onTempoEsgotado;
  }, [onTempoEsgotado]);

  useEffect(() => {
    if (!dataEncerramento) return;

    const atualizarTempo = () => {
      const novoTempo = calcularTempoRestante();
      setTempoRestante(novoTempo);
      
      if (novoTempo === 0 && !tempoEsgotadoRef.current) {
        tempoEsgotadoRef.current = true;
        onTempoEsgotadoRef.current(); // Usar ref em vez da dependencia direta
      }
    };

    atualizarTempo();
    intervalRef.current = setInterval(atualizarTempo, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [dataEncerramento, calcularTempoRestante]); // REMOVIDO: callbacks das dependencias
};
```

### 3. Otimizar Handlers com Debounce para localStorage

**Arquivo:** `src/hooks/useSimuladoStorage.ts`

Usar debounce para escritas no localStorage:

```typescript
const debouncedSave = useRef<NodeJS.Timeout | null>(null);
const pendingState = useRef<EstadoSimulado | null>(null);

const salvarEstadoOtimizado = useCallback((estado: EstadoSimulado) => {
  // Armazenar estado pendente
  pendingState.current = {
    ...estado,
    ultima_atualizacao: new Date().toISOString()
  };
  
  // Debounce de 100ms para agrupar escritas
  if (debouncedSave.current) clearTimeout(debouncedSave.current);
  debouncedSave.current = setTimeout(() => {
    if (pendingState.current) {
      try {
        localStorage.setItem(getEstadoKey(), JSON.stringify(pendingState.current));
      } catch (error) {
        console.error('Erro ao salvar estado:', error);
      }
    }
  }, 100);
}, [simuladoId]);
```

### 4. Usar Estado Local para Respostas (Evitar Re-leitura)

**Arquivo:** `src/pages/ModoProva.tsx`

Manter o estado de respostas em memoria e sincronizar com localStorage de forma assincrona:

```typescript
// Atualizar estado local imediatamente, salvar no localStorage depois
const handleSelecionarAlternativa = useCallback((alternativa: 'A' | 'B' | 'C' | 'D') => {
  if (!questaoAtualData || !podeInteragir) return;

  setEstado(prevEstado => {
    if (!prevEstado) return prevEstado;
    
    const novoEstado = {
      ...prevEstado,
      respostas: {
        ...prevEstado.respostas,
        [questaoAtualData.id]: {
          questao_id: questaoAtualData.id,
          resposta: alternativa,
          marcada_revisao: prevEstado.respostas[questaoAtualData.id]?.marcada_revisao || false,
          alternativas_eliminadas: prevEstado.respostas[questaoAtualData.id]?.alternativas_eliminadas || []
        }
      }
    };
    
    // Salvar de forma assincrona (nao bloqueia render)
    storage.salvarEstadoDebounced(novoEstado);
    
    return novoEstado;
  });
}, [questaoAtualData, podeInteragir, storage]);
```

### 5. Remover Funcao atualizarTempo do Storage

**Arquivo:** `src/hooks/useSimuladoStorage.ts`

Remover a funcao `atualizarTempo` que salva o tempo restante a cada segundo - isso e desnecessario pois o tempo e calculado dinamicamente a partir do deadline.

---

## Fluxo Otimizado

```text
ANTES (problematico):
[Clique] -> salvarResposta() -> [localStorage READ + WRITE síncrono]
         -> carregarEstado() -> [localStorage READ síncrono]
         -> setEstado() -> [Re-render]
         -> useCronometro recria intervalo -> [Timer trava]

DEPOIS (otimizado):
[Clique] -> setEstado() -> [Re-render imediato com novo estado]
         -> salvarEstadoDebounced() -> [100ms depois: localStorage WRITE]
         -> useCronometro continua inalterado -> [Timer fluido]
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useCronometro.ts` | Remover dependencia de callback, usar refs |
| `src/hooks/useSimuladoStorage.ts` | Adicionar debounce, remover atualizarTempo |
| `src/pages/ModoProva.tsx` | Otimizar handlers, remover onAtualizarTempo |

---

## Beneficios

- Cronometro nao sera mais afetado por interacoes
- UI mais responsiva e fluida
- Menos operacoes de localStorage
- Mesma garantia de persistencia (dados salvos a cada 100ms de inatividade)

## Validacao

1. Iniciar simulado e observar se o cronometro flui sem travamentos
2. Selecionar alternativas rapidamente e verificar fluidez
3. Navegar entre questoes e confirmar que o timer nao trava
4. Fechar e reabrir a aba para confirmar que o estado foi persistido

