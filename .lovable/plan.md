
# Correcao do Cronometro para Usar Duracao Configurada

## Resumo do Problema

O cronometro do Modo Prova esta usando a **data de encerramento do simulado** em vez da **duracao configurada**. Isso faz com que um simulado configurado com 3 horas de duracao mostre 4h25 de tempo restante (tempo ate a data de encerramento).

## Analise do Codigo

| Arquivo | Problema |
|---------|----------|
| `simuladosApi.buscarDadosSimulado()` | Nao retorna `duracao_minutos` |
| `ModoProva.tsx` | Passa apenas `dataEncerramento` para o cronometro |
| `useCronometro.ts` | Calcula tempo baseado apenas no deadline |
| `useSimuladoStorage.ts` | Nao armazena o deadline individual do aluno |

## Logica Correta

O tempo disponivel para o aluno deve ser calculado assim:

```text
horaInicio = momento que o aluno inicia o simulado
deadlineIndividual = horaInicio + duracao_minutos
deadlineGlobal = data_encerramento do simulado

tempoDisponivel = MIN(deadlineIndividual, deadlineGlobal)
```

Exemplo:
- Simulado com duracao de 3h e encerramento as 18:00
- Aluno inicia as 15:30
- Deadline individual: 15:30 + 3h = 18:30
- Deadline global: 18:00
- Tempo disponivel: 18:00 (o menor dos dois)

Outro exemplo:
- Simulado com duracao de 3h e encerramento as 20:00  
- Aluno inicia as 14:00
- Deadline individual: 14:00 + 3h = 17:00
- Deadline global: 20:00
- Tempo disponivel: 17:00 (o menor dos dois)

---

## Implementacao

### 1. Modificar `simuladosApi.buscarDadosSimulado()`

**Arquivo:** `src/services/simuladosApi.ts`

Adicionar `duracao_minutos` ao retorno:

```typescript
async buscarDadosSimulado(simuladoId: string): Promise<{ 
  titulo: string; 
  dataEncerramento: string | null;
  duracaoMinutos: number;
}> {
  const { data, error } = await supabase
    .from('simulados_admin')
    .select('nome, data_encerramento, duracao_minutos')
    .eq('id', simuladoId)
    .single();

  if (error) throw error;
  return {
    titulo: data?.nome || '',
    dataEncerramento: data?.data_encerramento || null,
    duracaoMinutos: data?.duracao_minutos || 180 // Fallback de 3h
  };
}
```

### 2. Modificar `useSimuladoStorage.ts`

**Arquivo:** `src/hooks/useSimuladoStorage.ts`

Atualizar `inicializarEstado` para armazenar o deadline calculado:

```typescript
const inicializarEstado = useCallback((
  numeroQuestoes: number, 
  dataEncerramento: string | null,
  duracaoMinutos: number
): EstadoSimulado => {
  const agora = new Date();
  
  // Calcula o deadline individual baseado na duracao
  const deadlineIndividual = new Date(agora.getTime() + duracaoMinutos * 60 * 1000);
  
  // Determina o deadline efetivo (menor entre individual e global)
  let deadlineEfetivo: Date;
  if (dataEncerramento) {
    const deadlineGlobal = new Date(dataEncerramento);
    deadlineEfetivo = deadlineIndividual < deadlineGlobal 
      ? deadlineIndividual 
      : deadlineGlobal;
  } else {
    deadlineEfetivo = deadlineIndividual;
  }

  const novoEstado: EstadoSimulado = {
    simulado_id: simuladoId,
    questao_atual: 0,
    tempo_restante_segundos: 0,
    respostas: {},
    saidas_de_aba: 0,
    saidas_de_fullscreen: 0,
    iniciado_em: agora.toISOString(),
    deadline_efetivo: deadlineEfetivo.toISOString(), // NOVO CAMPO
    ultima_atualizacao: agora.toISOString()
  };
  salvarEstado(novoEstado);
  return novoEstado;
}, [simuladoId, salvarEstado]);
```

### 3. Atualizar tipo `EstadoSimulado`

**Arquivo:** `src/types/simulado.ts`

Adicionar campo para o deadline calculado:

```typescript
export interface EstadoSimulado {
  simulado_id: string;
  questao_atual: number;
  tempo_restante_segundos: number;
  respostas: Record<string, RespostaSimulado>;
  saidas_de_aba: number;
  saidas_de_fullscreen: number;
  iniciado_em: string;
  deadline_efetivo: string; // NOVO - deadline calculado no inicio
  ultima_atualizacao: string;
}
```

### 4. Modificar `ModoProva.tsx`

**Arquivo:** `src/pages/ModoProva.tsx`

Usar o deadline efetivo armazenado no estado:

```typescript
const inicializarSimulado = async () => {
  setLoading(true);
  try {
    const questoesData = await simuladosApi.buscarQuestoesSimulado(simuladoId);
    setQuestoes(questoesData);

    const { titulo, dataEncerramento: deadline, duracaoMinutos } = 
      await simuladosApi.buscarDadosSimulado(simuladoId);
    setSimuladoTitulo(titulo);

    // Track simulado start (only once per session)
    if (!hasTrackedStart.current) {
      hasTrackedStart.current = true;
      trackSimuladoStart(simuladoId, titulo);
    }

    let estadoAtual = storage.carregarEstado();
    if (!estadoAtual) {
      // Inicializa com deadline calculado baseado na duracao
      estadoAtual = storage.inicializarEstado(
        questoesData.length, 
        deadline, 
        duracaoMinutos
      );
    }

    // Usa o deadline efetivo armazenado no estado
    setDataEncerramento(estadoAtual.deadline_efetivo);
    setEstado(estadoAtual);
    setQuestaoAtual(estadoAtual.questao_atual);
  } catch (error) {
    console.error('Erro ao inicializar simulado:', error);
    toast.error('Erro ao carregar o simulado');
    navigate('/simulados');
  } finally {
    setLoading(false);
  }
};
```

### 5. Modificar `useCronometro.ts`

**Arquivo:** `src/hooks/useCronometro.ts`

Renomear o parametro para refletir que e o deadline efetivo (opcional, para clareza):

O hook ja esta correto - ele recebe uma data e calcula o tempo restante. A mudanca e que agora recebera o `deadline_efetivo` em vez do `data_encerramento` global.

---

## Secao Tecnica

### Fluxo de Calculo do Tempo

```text
Aluno clica "Iniciar Prova"
          |
          v
buscarDadosSimulado() retorna:
  - titulo
  - dataEncerramento (global)
  - duracaoMinutos
          |
          v
storage.inicializarEstado() calcula:
  deadlineIndividual = agora + duracaoMinutos
  deadlineEfetivo = MIN(deadlineIndividual, dataEncerramento)
          |
          v
Armazena deadline_efetivo no localStorage
          |
          v
useCronometro recebe deadline_efetivo
          |
          v
Cronometro exibe tempo ate deadline_efetivo
```

### Casos de Borda

| Cenario | Comportamento |
|---------|---------------|
| Aluno inicia com tempo suficiente | Deadline = inicio + duracao |
| Aluno inicia proximo ao encerramento | Deadline = data_encerramento |
| Estado ja existe (retomada) | Usa deadline_efetivo salvo |
| Simulado sem data_encerramento | Deadline = inicio + duracao |

### Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/services/simuladosApi.ts` | Adicionar `duracaoMinutos` ao retorno |
| `src/types/simulado.ts` | Adicionar `deadline_efetivo` ao `EstadoSimulado` |
| `src/hooks/useSimuladoStorage.ts` | Calcular deadline efetivo na inicializacao |
| `src/pages/ModoProva.tsx` | Usar `deadline_efetivo` do estado armazenado |

---

## Validacao

1. Criar simulado com duracao de 30 minutos e encerramento em 2 horas
2. Iniciar o simulado - deve mostrar 30 minutos
3. Criar simulado com duracao de 3 horas e encerramento em 1 hora
4. Iniciar o simulado - deve mostrar 1 hora
5. Recarregar a pagina durante o simulado - tempo deve continuar do ponto correto
6. Verificar que simulados ja iniciados mantem seu deadline original
