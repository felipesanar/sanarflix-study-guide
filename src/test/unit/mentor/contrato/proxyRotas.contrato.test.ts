import { describe, expect, it } from 'vitest';
import { operacoes, resolverOperacao } from '@/test/mentoria/contrato/especificacao';
import { validarRota } from '../../../../../supabase/functions/flix-mentoria-proxy/rotas';
import { ROTAS } from '../../../../../supabase/functions/flix-mentoria-proxy/rotas.gerado';

const id = '00000000-0000-4000-8000-00000000000a';
const faltantes = new Set(['atualizarMe', 'listarPublicacoes', 'listarSessoes', 'criarHorarios', 'cancelarSessao']);
const valores: Record<string, string> = { limit: '200', cursor: '0', busca: 'Ana', status: 'agendada', tag: 'aviso', de: '2026-11-12T00:00:00Z', ate: '2026-11-13T00:00:00Z', tipo: 'individual' };

describe('[T3] lista do proxy versus todas as operacoes v2.3', () => {
  for (const operacao of operacoes) {
    const caminho = operacao.modelo.replace(/\{[^}]+\}/g, id);
    const query = new URLSearchParams(operacao.parametrosDeQuery.map((nome) => [nome, nome === 'status' && operacao.operationId === 'listarPublicacoes' ? 'publicada' : valores[nome]]));
    const executar = () => {
      for (const exemplo of [caminho, `${caminho}${query.size ? `?${query}` : ''}`]) {
        expect(validarRota(operacao.metodo, exemplo).ok, exemplo).toBe(operacao.tag === 'academy');
      }
    };
    if (faltantes.has(operacao.operationId)) {
      it(`[T3] ${operacao.operationId} aceita caminho e todos os parametros`, executar);
    } else {
      it(`[T3] ${operacao.operationId} ${operacao.tag === 'academy' ? 'aceita' : 'recusa'} caminho e todos os parametros`, executar);
    }
  }

  it('[T3] a lista do proxy tem exatamente as operacoes academy da especificacao', () => {
    expect(ROTAS.map((r) => r.operationId).sort()).toEqual(operacoes.filter((o) => o.tag === 'academy').map((o) => o.operationId).sort());
  });

  it('[T3] rotas de convite, que saem na v2.3, sao recusadas', () => {
    for (const [metodo, caminho] of [['GET', `/tribos/${id}/convites`], ['POST', `/tribos/${id}/convites`], ['DELETE', `/convites/${id}`]]) {
      expect(validarRota(metodo, caminho).ok, `${metodo} ${caminho}`).toBe(false);
      expect(resolverOperacao(metodo, caminho)).toBeNull();
    }
  });
});
