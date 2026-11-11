import { expect, vi } from 'vitest';
import type { InvocarProxy } from '@/features/mentor/api/flixClient';
import { criarFonteFlix } from '@/features/mentor/api/fonteFlix';
import { criarSimuladorFlix, type PedidoSimulado } from '@/test/mentoria/contrato/simuladorFlix';
import { resolverOperacao } from '@/test/mentoria/contrato/especificacao';
import { validarEsquema } from '@/test/mentoria/contrato/validarEsquema';
import { validarRota } from '../../../../../supabase/functions/flix-mentoria-proxy/rotas';

export const AGORA = new Date('2026-11-11T15:00:00Z');
export const JANELA = { inicio: '2026-11-12T17:00:00.000Z', fim: '2026-11-12T19:00:00.000Z', duracaoMin: 30 as const };
export const PUBLICACAO = { tag: 'aviso' as const, titulo: 'Vamos estudar', mensagem: 'Revise o plano de estudos.', link: null, destino: { tipo: 'tribo' as const }, status: 'publicada' as const };
export const SESSAO = { tipo: 'encontro_tribo' as const, inicio: JANELA.inicio, duracaoMin: 60, tema: 'Revisao' };

export function preparar() {
  const simulador = criarSimuladorFlix({ agora: () => AGORA });
  const pedidos: PedidoSimulado[] = [];
  const invocar = vi.fn<InvocarProxy>(async (nome, opcoes) => {
    expect(nome).toBe('flix-mentoria-proxy');
    const pedido = opcoes.body as PedidoSimulado;
    pedidos.push(pedido);
    const operacao = resolverOperacao(pedido.metodo, pedido.caminho)?.operacao;
    if (operacao?.esquemaCorpo) expect(validarEsquema(operacao.esquemaCorpo, pedido.corpo)).toEqual([]);
    const rota = validarRota(pedido.metodo, pedido.caminho);
    if (rota.ok === false) return { data: null, error: { name: 'FunctionsHttpError', context: new Response(JSON.stringify(rota.corpo), { status: rota.status }) } };
    // Como no adaptador original do simulador, a chave automatica permite testar
    // o formato sem mascarar tudo pela falta de idempotencia (testada em T13).
    return simulador.invocar(nome, { body: { ...pedido, caminho: rota.caminho } });
  });
  const fonte = criarFonteFlix(invocar);
  let sequencia = 0;
  function responder(metodo: string, caminho: string, corpo?: unknown) {
    return simulador.responder({ metodo, caminho, corpo, chaveIdempotencia: `teste-intencao-${String(++sequencia).padStart(8, '0')}` });
  }
  function conferirPedidos() {
    expect(pedidos.length).toBeGreaterThan(0);
    for (const pedido of pedidos) {
      const resolvida = resolverOperacao(pedido.metodo, pedido.caminho);
      expect(resolvida, `${pedido.metodo} ${pedido.caminho}`).not.toBeNull();
      if (resolvida?.operacao.esquemaCorpo) expect(validarEsquema(resolvida.operacao.esquemaCorpo, pedido.corpo)).toEqual([]);
    }
  }
  function criarPublicacao(corpo: object = PUBLICACAO) {
    const r = responder('POST', `/tribos/${simulador.semente.triboId}/publicacoes`, corpo);
    expect(r.status).toBe(201);
    return r.corpo as { publicacao: { id: string }; warnings: unknown[]; desafixadaId: string | null };
  }
  function criarSessao(corpo: object = SESSAO) {
    const r = responder('POST', `/tribos/${simulador.semente.triboId}/sessoes`, corpo);
    expect(r.status).toBe(201);
    return r.corpo as { id: string };
  }
  function criarHorarios() {
    const r = responder('POST', `/tribos/${simulador.semente.triboId}/horarios`, JANELA);
    expect(r.status).toBe(201);
    return (r.corpo as { data: { id: string }[] }).data;
  }
  return { simulador, fonte, invocar, pedidos, responder, conferirPedidos, criarPublicacao, criarSessao, criarHorarios, ...simulador.semente };
}

// Caminhos variaveis impedem que o Vite resolva modulos futuros na carga da suite.
// A importacao ocorre dentro de cada teste, conforme o contrato da tarefa.
export const MODULOS = {
  horarios: '@/features/mentor/lib/horarios',
  brasilia: '@/features/mentor/lib/horarioBrasilia',
  grupos: '@/features/mentor/lib/gruposStatus',
  destinatarios: '@/features/mentor/lib/destinatarios',
  idempotencia: '@/features/mentor/api/idempotencia',
};

export type FonteFutura = ReturnType<typeof preparar>['fonte'] & {
  criarHorarios(triboId: string, janela: typeof JANELA): Promise<{ data: { id: string }[] }>;
  excluirHorario(id: string): Promise<void>;
  cancelarSessao(id: string, motivo?: string): Promise<{ sessao: { status: string }; avisoPublicacaoId: string }>;
};
