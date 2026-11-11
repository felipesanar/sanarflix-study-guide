import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarClienteFlix, erroDoProxy, type InvocarProxy, type Metodo } from '@/features/mentor/api/flixClient';
import { ErroFonte } from '@/features/mentor/api/fonte';
import { criarRegistroDeIntencoes } from '@/features/mentor/api/idempotencia';
import { Logger } from '@/utils/logger';
import { criarSimuladorFlix } from '@/test/mentoria/contrato/simuladorFlix';

function erroHttp(status: number, requestId?: string) {
  return { context: new Response(JSON.stringify({ error: { code: 'validacao', message: 'Invalido', requestId } }), { status }) };
}

describe('cliente Flix', () => {
  beforeEach(() => { vi.spyOn(Logger, 'warn').mockImplementation(() => undefined); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('GET leva requestId UUID e nao leva chave nem corpo ausente', async () => {
    const invocar = vi.fn<InvocarProxy>().mockResolvedValue({ data: [], error: null });
    await criarClienteFlix(invocar).chamar('GET', '/me');
    expect(invocar).toHaveBeenCalledWith('flix-mentoria-proxy', { body: {
      metodo: 'GET', caminho: '/me', requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    } });
  });

  it.each<Metodo>(['POST', 'PUT', 'PATCH', 'DELETE'])('%s leva chave e ID injetado', async (metodo) => {
    const invocar = vi.fn<InvocarProxy>().mockResolvedValue({ data: {}, error: null });
    const intencoes = criarRegistroDeIntencoes();
    const chave = intencoes.chavePara(metodo, '/itens', { nome: 'A' });
    await criarClienteFlix(invocar, { intencoes, novoRequestId: () => 'pedido-1' }).chamar(metodo, '/itens', { nome: 'A' });
    expect(invocar).toHaveBeenCalledWith('flix-mentoria-proxy', { body: { metodo, caminho: '/itens', corpo: { nome: 'A' }, idempotencyKey: chave, requestId: 'pedido-1' } });
    expect(intencoes.chavePara(metodo, '/itens', { nome: 'A' })).not.toBe(chave);
  });

  it.each([0, 408, 429, 500, 502, 503, 504])('reusa chave depois de falha transitoria %s e gera outro ID', async (status) => {
    const invocar = vi.fn<InvocarProxy>()
      .mockResolvedValueOnce({ data: null, error: status ? erroHttp(status) : new TypeError('rede') })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    let sequencia = 0;
    const cliente = criarClienteFlix(invocar, { novoRequestId: () => `pedido-${++sequencia}` });
    await expect(cliente.chamar('POST', '/itens', { a: 1 })).rejects.toBeInstanceOf(ErroFonte);
    await cliente.chamar('POST', '/itens', { a: 1 });
    const [primeiro, segundo] = invocar.mock.calls.map(([, opcoes]) => opcoes.body);
    expect(primeiro).toMatchObject({ idempotencyKey: expect.any(String), requestId: 'pedido-1' });
    expect(segundo).toMatchObject({ idempotencyKey: (primeiro as { idempotencyKey: string }).idempotencyKey, requestId: 'pedido-2' });
  });

  it.each([400, 401, 403, 404, 409, 422, 499])('renova chave depois de erro definitivo %s', async (status) => {
    const invocar = vi.fn<InvocarProxy>()
      .mockResolvedValueOnce({ data: null, error: erroHttp(status) })
      .mockResolvedValueOnce({ data: {}, error: null });
    const cliente = criarClienteFlix(invocar);
    await expect(cliente.chamar('POST', '/itens')).rejects.toBeInstanceOf(ErroFonte);
    await cliente.chamar('POST', '/itens');
    const chaves = invocar.mock.calls.map(([, opcoes]) => (opcoes.body as { idempotencyKey: string }).idempotencyKey);
    expect(chaves[0]).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(chaves[1]).not.toBe(chaves[0]);
  });

  it('renova a chave depois do sucesso', async () => {
    const invocar = vi.fn<InvocarProxy>().mockResolvedValue({ data: {}, error: null });
    const cliente = criarClienteFlix(invocar);
    await cliente.chamar('POST', '/itens');
    await cliente.chamar('POST', '/itens');
    const chaves = invocar.mock.calls.map(([, opcoes]) => (opcoes.body as { idempotencyKey: string }).idempotencyKey);
    expect(chaves[0]).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(chaves[1]).not.toBe(chaves[0]);
  });

  it('preserva requestId do servidor e usa o enviado na falta dele', async () => {
    expect(await erroDoProxy(erroHttp(422, 'servidor-1'), 'enviado-1')).toMatchObject({ requestId: 'servidor-1' });
    expect(await erroDoProxy(erroHttp(422), 'enviado-1')).toMatchObject({ requestId: 'enviado-1' });
    expect(await erroDoProxy(new TypeError('rede'), 'enviado-1')).toMatchObject({ requestId: 'enviado-1', status: 0 });
    const existente = new ErroFonte(422, 'validacao', 'Invalido', undefined, 'original');
    expect(await erroDoProxy(existente, 'enviado-1')).toBe(existente);
    expect(await erroDoProxy(new ErroFonte(422, 'validacao', 'Invalido'), 'enviado-1')).toMatchObject({ requestId: 'enviado-1' });
  });

  it('converte excecao do invoke e registra uma linha sem query nem corpo', async () => {
    const invocar = vi.fn<InvocarProxy>().mockRejectedValue(erroHttp(422, 'servidor-1'));
    await expect(criarClienteFlix(invocar).chamar('POST', '/itens?email=privado', { segredo: 'privado' })).rejects.toMatchObject({ requestId: 'servidor-1' });
    expect(Logger.warn).toHaveBeenCalledExactlyOnceWith('[mentor/flixClient] chamada falhou', {
      requestId: 'servidor-1', metodo: 'POST', caminho: '/itens', status: 422, code: 'validacao',
    });
  });

  it('resposta perdida apos PUT aplicado repete a resposta original sem reaplicar o efeito', async () => {
    const simulador = criarSimuladorFlix();
    const caminho = `/tribos/${simulador.semente.triboId}/canais/grupo_tribo`;
    const corpo = { url: 'https://chat.whatsapp.com/abc' };
    let primeira = true;
    let respostaOriginal: unknown;
    const invocar: InvocarProxy = async (nome, opcoes) => {
      const resposta = await simulador.invocar(nome, opcoes);
      if (primeira) {
        primeira = false;
        expect(resposta.error).toBeNull();
        respostaOriginal = resposta.data;
        // Altera o estado entre tentativas: um PUT reaplicado apagaria esta alteracao.
        const alteracao = await simulador.invocar(nome, { body: { metodo: 'PUT', caminho, corpo: { url: 'https://chat.whatsapp.com/outro' }, idempotencyKey: 'outra-intencao-0001' } });
        expect(alteracao.error).toBeNull();
        return { data: null, error: new TypeError('resposta perdida') };
      }
      return resposta;
    };
    const cliente = criarClienteFlix(invocar);
    await expect(cliente.chamar('PUT', caminho, corpo)).rejects.toMatchObject({ status: 0 });
    expect(await cliente.chamar('PUT', caminho, corpo)).toEqual(respostaOriginal);
    expect(simulador.pedidos[0].chaveIdempotencia).toBe(simulador.pedidos[2].chaveIdempotencia);
    const canais = await cliente.chamar<{ tipo: string; url: string }[]>('GET', `/tribos/${simulador.semente.triboId}/canais`);
    expect(canais.find((canal) => canal.tipo === 'grupo_tribo')?.url).toBe('https://chat.whatsapp.com/outro');
  });
});
