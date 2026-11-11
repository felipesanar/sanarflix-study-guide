import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarProxy, ErroConfiguracaoProxy, type DependenciasProxy, type EntradaProxy } from '../../../supabase/functions/flix-mentoria-proxy/nucleo';

const resposta = (status = 200, corpo: unknown = { tribos: [{ id: 'a' }] }) => ({ status, text: async () => JSON.stringify(corpo), cancelar: vi.fn(async () => {}) });
function preparar() {
  const deps: DependenciasProxy = {
    usuarioDoJwt: vi.fn(async () => ({ id: 'usuario', email: 'privado@teste.com' })),
    flixMentorId: vi.fn(async () => 'mentor'),
    buscar: vi.fn(async () => resposta()),
    config: () => ({ flixUrl: 'https://flix.test/', flixToken: 'token-secreto' }),
    novoId: vi.fn(() => 'uuid-gerado'), agora: vi.fn(() => 0), registrar: vi.fn(),
  };
  const entrada: EntradaProxy = { metodoHttp: 'POST', origin: null, corsPermitido: false, authorization: 'Bearer jwt-secreto', requestId: null, corpo: { metodo: 'GET', caminho: '/me' } };
  return { deps, entrada, proxy: criarProxy(deps) };
}
afterEach(() => vi.useRealTimers());
describe('nucleo do proxy de mentoria', () => {
  it('recusa JWT ausente sem chamar dependencias externas', async () => {
    const { deps, entrada, proxy } = preparar();
    expect(await proxy({ ...entrada, authorization: null })).toMatchObject({ status: 401 });
    expect(deps.usuarioDoJwt).not.toHaveBeenCalled();
    expect(deps.buscar).not.toHaveBeenCalled();
  });
  it('recusa JWT rejeitado ou cuja verificacao falhou', async () => {
    const { deps, entrada, proxy } = preparar();
    vi.mocked(deps.usuarioDoJwt).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('jwt-secreto'));
    expect((await proxy(entrada)).status).toBe(401);
    expect((await proxy(entrada)).status).toBe(401);
  });
  it('recusa mentor sem vinculo', async () => {
    const { deps, entrada, proxy } = preparar();
    vi.mocked(deps.flixMentorId).mockResolvedValue(null);
    expect((await proxy(entrada)).status).toBe(403);
    expect(deps.buscar).not.toHaveBeenCalled();
  });
  it('recusa tribo de outro mentor sem executar a operacao', async () => {
    const { deps, entrada, proxy } = preparar();
    const saida = await proxy({ ...entrada, corpo: { metodo: 'GET', caminho: '/tribos/outra/alunos' } });
    expect(saida.status).toBe(403);
    expect(JSON.parse(saida.corpo!).error.code).toBe('sem_acesso_tribo');
    expect(deps.buscar).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deps.buscar).mock.calls[0][0]).toBe('https://flix.test/mentoria/v1/me');
  });
  it('repassa tribo permitida com headers de servico e redirect manual', async () => {
    const { deps, entrada, proxy } = preparar();
    expect((await proxy({ ...entrada, corpo: { metodo: 'GET', caminho: '/tribos/a/alunos' } })).status).toBe(200);
    expect(deps.buscar).toHaveBeenLastCalledWith('https://flix.test/mentoria/v1/tribos/a/alunos', expect.objectContaining({ method: 'GET', redirect: 'manual', headers: expect.objectContaining({ Authorization: 'Bearer token-secreto', 'X-Mentor-Id': 'mentor' }) }));
  });
  it('cacheia por mentor e expira exatamente em 60 segundos', async () => {
    const { deps, entrada, proxy } = preparar();
    entrada.corpo = { metodo: 'GET', caminho: '/tribos/a/alunos' };
    await proxy(entrada);
    vi.mocked(deps.agora).mockReturnValue(59_999);
    await proxy(entrada);
    expect(deps.buscar).toHaveBeenCalledTimes(3);
    vi.mocked(deps.agora).mockReturnValue(60_000);
    await proxy(entrada);
    expect(deps.buscar).toHaveBeenCalledTimes(5);
    vi.mocked(deps.flixMentorId).mockResolvedValue('outro-mentor');
    await proxy(entrada);
    expect(deps.buscar).toHaveBeenCalledTimes(7);
  });
  it.each([null, 'curto', 'invalido\nrequest', 'request_123\n', 'a'.repeat(65)])('gera, repassa e devolve requestId para %s', async (requestId) => {
    const { deps, entrada, proxy } = preparar();
    expect((await proxy({ ...entrada, requestId })).headers['X-Request-Id']).toBe('uuid-gerado');
    expect(deps.buscar).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: expect.objectContaining({ 'X-Request-Id': 'uuid-gerado' }) }));
  });
  it('preserva requestId valido inclusive nos erros', async () => {
    const { entrada, proxy } = preparar();
    const saida = await proxy({ ...entrada, requestId: 'request_123', authorization: null });
    expect(saida.headers).toMatchObject({ 'X-Request-Id': 'request_123', 'Cache-Control': 'no-store' });
    expect(JSON.parse(saida.corpo!).error.requestId).toBe('request_123');
  });
  it('repassa chave e corpo nas escritas', async () => {
    const { deps, entrada, proxy } = preparar();
    await proxy({ ...entrada, corpo: { metodo: 'PATCH', caminho: '/me', idempotencyKey: 'chave_12345678901', corpo: { nome: 'Nome' } } });
    expect(deps.buscar).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'PATCH', body: '{"nome":"Nome"}', headers: expect.objectContaining({ 'Idempotency-Key': 'chave_12345678901' }) }));
  });
  it.each([undefined, '', 'curta', 'a'.repeat(65), 'a'.repeat(16) + '\n', 'a'.repeat(15) + '/', 123])('recusa escrita com chave invalida %s', async (idempotencyKey) => {
    const { deps, entrada, proxy } = preparar();
    const saida = await proxy({ ...entrada, corpo: { metodo: 'POST', caminho: '/tribos/a/publicacoes', idempotencyKey } });
    expect(saida.status).toBe(400);
    expect(JSON.parse(saida.corpo!).error).toMatchObject({ code: 'validacao', field: 'idempotencyKey' });
    expect(deps.buscar).not.toHaveBeenCalled();
  });
  it('registra falha sem credenciais, email ou corpo', async () => {
    const { deps, entrada, proxy } = preparar();
    vi.mocked(deps.buscar).mockResolvedValue(resposta(422, { error: { code: 'validacao', message: 'dado-aluno' } }));
    await proxy(entrada);
    expect(deps.registrar).toHaveBeenCalledWith({ requestId: 'uuid-gerado', operationId: 'obterMe', metodo: 'GET', status: 422, code: 'validacao', mentorId: 'mentor', duracaoMs: 0 });
    const log = JSON.stringify(vi.mocked(deps.registrar).mock.calls);
    for (const segredo of ['token-secreto', 'jwt-secreto', 'privado@teste.com', 'dado-aluno']) expect(log).not.toContain(segredo);
  });
  it.each([500, 503, 301, 307])('converte status Flix %s em rede e cancela resposta', async (status) => {
    const { deps, entrada, proxy } = preparar();
    const falha = resposta(status);
    vi.mocked(deps.buscar).mockResolvedValue(falha);
    const saida = await proxy(entrada);
    expect(saida.status).toBe(502);
    expect(JSON.parse(saida.corpo!).error.code).toBe('rede');
    expect(falha.cancelar).toHaveBeenCalled();
  });
  it.each([403, 500])('falha de GET /me interno %s retorna rede e nao autoriza', async (status) => {
    const { deps, entrada, proxy } = preparar();
    vi.mocked(deps.buscar).mockResolvedValueOnce(resposta(status));
    expect((await proxy({ ...entrada, corpo: { metodo: 'GET', caminho: '/tribos/a/alunos' } })).status).toBe(502);
    expect(deps.buscar).toHaveBeenCalledTimes(1);
  });
  it('recusa resposta de tribos malformada sem cachear', async () => {
    const { deps, entrada, proxy } = preparar();
    vi.mocked(deps.buscar).mockResolvedValueOnce(resposta(200, {}));
    entrada.corpo = { metodo: 'GET', caminho: '/tribos/a/alunos' };
    expect((await proxy(entrada)).status).toBe(502);
    expect((await proxy(entrada)).status).toBe(200);
  });
  it('timeout de 15 segundos retorna rede e registra excecao', async () => {
    vi.useFakeTimers();
    const { deps, entrada, proxy } = preparar();
    vi.mocked(deps.buscar).mockImplementation(async (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('token-secreto')))));
    const pendente = proxy(entrada);
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await pendente).status).toBe(502);
    expect(deps.registrar).toHaveBeenCalledWith(expect.objectContaining({ code: 'rede', status: 502 }));
  });
  it.each([
    [{ origin: 'https://invalida.test' }, 403],
    [{ metodoHttp: 'OPTIONS' }, 204],
    [{ metodoHttp: 'GET' }, 405],
    [{ corpo: null }, 400],
    [{ corpo: { metodo: 'GET', caminho: '/invalido' } }, 400],
  ])('mantem controles de entrada %j', async (alteracoes, status) => {
    const { deps, entrada, proxy } = preparar();
    const saida = await proxy({ ...entrada, ...alteracoes });
    expect(saida.status).toBe(status);
    expect(saida.headers['X-Request-Id']).toBe('uuid-gerado');
    expect(deps.buscar).not.toHaveBeenCalled();
    if (status >= 400) expect(deps.registrar).toHaveBeenCalledTimes(1);
    else expect(saida.corpo).toBeNull();
  });
  it('configuracao Flix ausente retorna 503', async () => {
    const { deps, entrada, proxy } = preparar();
    deps.config = () => ({ flixUrl: null, flixToken: null });
    expect((await proxy(entrada)).status).toBe(503);
  });
  it('configuracao Supabase ausente mantem 500 com registro e requestId', async () => {
    const { deps, entrada, proxy } = preparar();
    vi.mocked(deps.usuarioDoJwt).mockImplementation(async () => { throw new ErroConfiguracaoProxy(); });
    const saida = await proxy(entrada);
    expect(saida.status).toBe(500);
    expect(JSON.parse(saida.corpo!).error).toMatchObject({ code: 'configuracao', requestId: 'uuid-gerado' });
    expect(deps.registrar).toHaveBeenCalledWith(expect.objectContaining({ code: 'configuracao', status: 500 }));
  });
  it.each([204, 205])('preserva resposta vazia %s', async (status) => {
    const { deps, entrada, proxy } = preparar();
    vi.mocked(deps.buscar).mockResolvedValue(resposta(status));
    expect(await proxy(entrada)).toMatchObject({ status, corpo: null });
    expect(deps.registrar).not.toHaveBeenCalled();
  });
});
