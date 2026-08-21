import { useState, useEffect, useCallback, useRef } from 'react';
import { EstadoSimulado, RespostaSimulado } from '@/types/simulado';
import { Logger } from '@/utils/logger';

const STORAGE_PREFIX = 'simulado_';

export const useSimuladoStorage = (simuladoId: string) => {
  const getEstadoKey = () => `${STORAGE_PREFIX}${simuladoId}_estado`;
  
  // Refs para debounce
  const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<EstadoSimulado | null>(null);
  
  const carregarEstado = useCallback((): EstadoSimulado | null => {
    try {
      const estadoStr = localStorage.getItem(getEstadoKey());
      if (!estadoStr) return null;
      return JSON.parse(estadoStr);
    } catch (error) {
      Logger.error('Erro ao carregar estado do simulado:', error);
      return null;
    }
  }, [simuladoId]);

  // Contadores de saída são monotônicos dentro de uma tentativa. O merge no
  // momento da escrita impede que um estado React defasado (que não acompanha
  // registrarSaidaAba/registrarSaidaFullscreen, que escrevem direto no
  // localStorage) sobrescreva uma contagem já registrada — sem isso, responder
  // uma questão depois de uma saída de aba zerava o contador.
  const mesclarContadores = useCallback((estado: EstadoSimulado): EstadoSimulado => {
    const atual = carregarEstado();
    if (!atual) return estado;
    return {
      ...estado,
      saidas_de_aba: Math.max(estado.saidas_de_aba, atual.saidas_de_aba),
      saidas_de_fullscreen: Math.max(estado.saidas_de_fullscreen || 0, atual.saidas_de_fullscreen || 0)
    };
  }, [carregarEstado]);

  // Salvar síncrono - usado apenas quando necessário imediatamente
  const salvarEstado = useCallback((estado: EstadoSimulado) => {
    try {
      localStorage.setItem(getEstadoKey(), JSON.stringify({
        ...mesclarContadores(estado),
        ultima_atualizacao: new Date().toISOString()
      }));
    } catch (error) {
      Logger.error('Erro ao salvar estado do simulado:', error);
    }
  }, [simuladoId, mesclarContadores]);

  // Salvar com debounce - não bloqueia a UI
  const salvarEstadoDebounced = useCallback((estado: EstadoSimulado) => {
    pendingStateRef.current = {
      ...estado,
      ultima_atualizacao: new Date().toISOString()
    };
    
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }
    
    debouncedSaveRef.current = setTimeout(() => {
      if (pendingStateRef.current) {
        try {
          localStorage.setItem(getEstadoKey(), JSON.stringify(mesclarContadores(pendingStateRef.current)));
        } catch (error) {
          Logger.error('Erro ao salvar estado:', error);
        }
      }
    }, 100);
  }, [simuladoId, mesclarContadores]);

  // Força a persistência imediata (usado antes de fechar/finalizar)
  const flushPendingState = useCallback(() => {
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }
    if (pendingStateRef.current) {
      try {
        localStorage.setItem(getEstadoKey(), JSON.stringify(mesclarContadores(pendingStateRef.current)));
      } catch (error) {
        Logger.error('Erro ao forçar salvamento:', error);
      }
    }
  }, [simuladoId, mesclarContadores]);

  const salvarResposta = useCallback((questaoId: string, resposta: RespostaSimulado) => {
    const estado = carregarEstado();
    if (!estado) return;

    const novoEstado: EstadoSimulado = {
      ...estado,
      respostas: {
        ...estado.respostas,
        [questaoId]: resposta
      }
    };
    salvarEstadoDebounced(novoEstado);
  }, [carregarEstado, salvarEstadoDebounced]);

  const marcarRevisao = useCallback((questaoId: string, marcar: boolean) => {
    const estado = carregarEstado();
    if (!estado) return;

    const respostaAtual = estado.respostas[questaoId] || {
      questao_id: questaoId,
      resposta: null,
      marcada_revisao: false,
      alternativas_eliminadas: []
    };

    const novoEstado: EstadoSimulado = {
      ...estado,
      respostas: {
        ...estado.respostas,
        [questaoId]: {
          ...respostaAtual,
          marcada_revisao: marcar
        }
      }
    };
    salvarEstadoDebounced(novoEstado);
  }, [carregarEstado, salvarEstadoDebounced]);

  const eliminarAlternativa = useCallback((questaoId: string, alternativa: 'A' | 'B' | 'C' | 'D', eliminar: boolean) => {
    const estado = carregarEstado();
    if (!estado) return;

    const respostaAtual = estado.respostas[questaoId] || {
      questao_id: questaoId,
      resposta: null,
      marcada_revisao: false,
      alternativas_eliminadas: []
    };

    const eliminadas = eliminar
      ? [...respostaAtual.alternativas_eliminadas, alternativa]
      : respostaAtual.alternativas_eliminadas.filter(a => a !== alternativa);

    const novoEstado: EstadoSimulado = {
      ...estado,
      respostas: {
        ...estado.respostas,
        [questaoId]: {
          ...respostaAtual,
          alternativas_eliminadas: eliminadas
        }
      }
    };
    salvarEstadoDebounced(novoEstado);
  }, [carregarEstado, salvarEstadoDebounced]);

  const registrarSaidaAba = useCallback((): number | null => {
    const estado = carregarEstado();
    if (!estado) return null;

    const novoValor = estado.saidas_de_aba + 1;

    salvarEstado({
      ...estado,
      saidas_de_aba: novoValor
    });

    return novoValor;
  }, [carregarEstado, salvarEstado]);

  const registrarSaidaFullscreen = useCallback(() => {
    const estado = carregarEstado();
    if (!estado) return;

    const novoValor = (estado.saidas_de_fullscreen || 0) + 1;
    Logger.info(`[Storage] Registrando saída de fullscreen #${novoValor}`);

    salvarEstado({
      ...estado,
      saidas_de_fullscreen: novoValor
    });
  }, [carregarEstado, salvarEstado]);

  const limparEstado = useCallback(() => {
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }
    localStorage.removeItem(getEstadoKey());
  }, [simuladoId]);

  const inicializarEstado = useCallback((
    numeroQuestoes: number, 
    dataEncerramento: string | null,
    duracaoMinutos: number
  ): EstadoSimulado => {
    const agora = new Date();
    
    // Calcula o deadline individual baseado na duração configurada
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
      deadline_efetivo: deadlineEfetivo.toISOString(),
      ultima_atualizacao: agora.toISOString()
    };
    salvarEstado(novoEstado);
    return novoEstado;
  }, [simuladoId, salvarEstado]);

  const prepararRespostasCompletas = useCallback((totalQuestoes: string[]) => {
    // Força salvar qualquer estado pendente antes de preparar
    flushPendingState();
    
    const estado = carregarEstado();
    if (!estado) return [];

    return totalQuestoes.map(questaoId => {
      const respostaExistente = estado.respostas[questaoId];
      
      if (respostaExistente && respostaExistente.resposta !== null) {
        return {
          questao_id: questaoId,
          resposta: respostaExistente.resposta,
          marcada_revisao: respostaExistente.marcada_revisao,
          alternativas_eliminadas: respostaExistente.alternativas_eliminadas,
          respondida: true
        };
      } else {
        return {
          questao_id: questaoId,
          resposta: null,
          marcada_revisao: false,
          alternativas_eliminadas: [],
          respondida: false
        };
      }
    });
  }, [carregarEstado, flushPendingState]);

  return {
    carregarEstado,
    salvarEstado,
    salvarEstadoDebounced,
    flushPendingState,
    salvarResposta,
    marcarRevisao,
    eliminarAlternativa,
    registrarSaidaAba,
    registrarSaidaFullscreen,
    limparEstado,
    inicializarEstado,
    prepararRespostasCompletas
  };
};
