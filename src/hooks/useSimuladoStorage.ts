import { useState, useEffect, useCallback } from 'react';
import { EstadoSimulado, RespostaSimulado } from '@/types/simulado';

const STORAGE_PREFIX = 'simulado_';

export const useSimuladoStorage = (simuladoId: string) => {
  const getEstadoKey = () => `${STORAGE_PREFIX}${simuladoId}_estado`;
  
  const carregarEstado = useCallback((): EstadoSimulado | null => {
    try {
      const estadoStr = localStorage.getItem(getEstadoKey());
      if (!estadoStr) return null;
      return JSON.parse(estadoStr);
    } catch (error) {
      console.error('Erro ao carregar estado do simulado:', error);
      return null;
    }
  }, [simuladoId]);

  const salvarEstado = useCallback((estado: EstadoSimulado) => {
    try {
      localStorage.setItem(getEstadoKey(), JSON.stringify({
        ...estado,
        ultima_atualizacao: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Erro ao salvar estado do simulado:', error);
    }
  }, [simuladoId]);

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
    salvarEstado(novoEstado);
  }, [carregarEstado, salvarEstado]);

  const marcarRevisao = useCallback((questaoId: string, marcar: boolean) => {
    const estado = carregarEstado();
    if (!estado) return;

    const respostaAtual = estado.respostas[questaoId] || {
      questao_id: questaoId,
      resposta: null,
      marcada_revisao: false,
      alternativas_eliminadas: []
    };

    salvarResposta(questaoId, {
      ...respostaAtual,
      marcada_revisao: marcar
    });
  }, [carregarEstado, salvarResposta]);

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

    salvarResposta(questaoId, {
      ...respostaAtual,
      alternativas_eliminadas: eliminadas
    });
  }, [carregarEstado, salvarResposta]);

  const atualizarTempo = useCallback((tempoRestante: number) => {
    const estado = carregarEstado();
    if (!estado) return;

    salvarEstado({
      ...estado,
      tempo_restante_segundos: tempoRestante
    });
  }, [carregarEstado, salvarEstado]);

  const registrarSaidaAba = useCallback(() => {
    const estado = carregarEstado();
    if (!estado) return;

    salvarEstado({
      ...estado,
      saidas_de_aba: estado.saidas_de_aba + 1
    });
  }, [carregarEstado, salvarEstado]);

  const registrarSaidaFullscreen = useCallback(() => {
    const estado = carregarEstado();
    if (!estado) return;

    salvarEstado({
      ...estado,
      saidas_de_fullscreen: (estado.saidas_de_fullscreen || 0) + 1
    });
  }, [carregarEstado, salvarEstado]);

  const limparEstado = useCallback(() => {
    localStorage.removeItem(getEstadoKey());
  }, [simuladoId]);

  const inicializarEstado = useCallback((numeroQuestoes: number, dataEncerramento: string | null): EstadoSimulado => {
    const novoEstado: EstadoSimulado = {
      simulado_id: simuladoId,
      questao_atual: 0,
      tempo_restante_segundos: 0, // Será calculado dinamicamente com base no deadline
      respostas: {},
      saidas_de_aba: 0,
      saidas_de_fullscreen: 0,
      iniciado_em: new Date().toISOString(),
      ultima_atualizacao: new Date().toISOString()
    };
    salvarEstado(novoEstado);
    return novoEstado;
  }, [simuladoId, salvarEstado]);

  const prepararRespostasCompletas = useCallback((totalQuestoes: string[]) => {
    const estado = carregarEstado();
    if (!estado) return [];

    return totalQuestoes.map(questaoId => {
      const respostaExistente = estado.respostas[questaoId];
      
      if (respostaExistente && respostaExistente.resposta !== null) {
        // Questão respondida
        return {
          questao_id: questaoId,
          resposta: respostaExistente.resposta,
          marcada_revisao: respostaExistente.marcada_revisao,
          alternativas_eliminadas: respostaExistente.alternativas_eliminadas,
          respondida: true
        };
      } else {
        // Questão não respondida
        return {
          questao_id: questaoId,
          resposta: null,
          marcada_revisao: false,
          alternativas_eliminadas: [],
          respondida: false
        };
      }
    });
  }, [carregarEstado]);

  return {
    carregarEstado,
    salvarEstado,
    salvarResposta,
    marcarRevisao,
    eliminarAlternativa,
    atualizarTempo,
    registrarSaidaAba,
    registrarSaidaFullscreen,
    limparEstado,
    inicializarEstado,
    prepararRespostasCompletas
  };
};
