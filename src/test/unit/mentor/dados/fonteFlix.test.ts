import { describe, expect, it } from 'vitest';
import { ErroFonte } from '@/features/mentor/api/fonte';
import { criarFonteFlix, type InvocarProxy } from '@/features/mentor/api/fonteFlix';

type Pedido = { metodo: string; caminho: string; corpo?: unknown };

function proxyFalso(responder: (p: Pedido) => { data?: unknown; error?: unknown }) {
  const pedidos: Pedido[] = [];
  const invocar: InvocarProxy = async (nome, opcoes) => {
    expect(nome).toBe('flix-mentoria-proxy');
    const p = opcoes.body as Pedido;
    pedidos.push(p);
    const r = responder(p);
    return { data: r.data ?? null, error: r.error ?? null };
  };
  return { invocar, pedidos };
}

/** Como o supabase-js entrega um FunctionsHttpError: `context` é o Response do proxy. */
function erroHttp(status: number, corpo: unknown) {
  return { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: new Response(JSON.stringify(corpo), { status }) };
}

describe('fonteFlix (contrato v2.1 via flix-mentoria-proxy)', () => {
  it('declara eventosNoServidor = false', () => {
    const f = criarFonteFlix(proxyFalso(() => ({})).invocar);
    expect(f.nome).toBe('flix');
    expect(f.eventosNoServidor).toBe(false);
  });

  it('me → GET /me, sem corpo', async () => {
    const me = { mentor: { id: 'm1', nome: 'Thiago', fotoUrl: null, bio: null, mote: null, googleEmail: null, ativo: true, modalidade: 'b2c' }, tribos: [{ id: 't1', nome: 'Carcará', slug: 'carcara', modalidade: 'b2c', papel: 'titular', mentoriaAtiva: true }] };
    const { invocar, pedidos } = proxyFalso(() => ({ data: me }));
    expect(await criarFonteFlix(invocar).me()).toEqual({ ...me, mentor: { ...me.mentor, agendaUrl: null }, portalMentor: true });
    expect(pedidos).toEqual([expect.objectContaining({ metodo: 'GET', caminho: '/me' })]);
  });

  it('PATCH /me envia apenas campos do Flix, incluindo null, sem agendaUrl do Academy', async () => {
    const mentor = { id: 'm1', nome: 'Thiago', fotoUrl: null, bio: null, mote: 'Mote', googleEmail: null, ativo: true, modalidade: 'b2c' };
    const { invocar, pedidos } = proxyFalso(() => ({ data: mentor }));
    expect(await criarFonteFlix(invocar).atualizarPerfil({ fotoUrl: null, bio: null, mote: 'Mote', googleEmail: null, agendaUrl: 'https://calendar.google.com/x' })).toEqual({ ...mentor, agendaUrl: null });
    expect(pedidos[0]).toMatchObject({ metodo: 'PATCH', caminho: '/me', corpo: { fotoUrl: null, bio: null, mote: 'Mote', googleEmail: null } });
    expect(pedidos[0].corpo).not.toHaveProperty('agendaUrl');
  });

  it('alunos percorre todas as páginas { data, nextCursor }', async () => {
    const { invocar, pedidos } = proxyFalso((p) => (p.caminho.includes('cursor=c2')
      ? { data: { data: [{ alunoId: 'u2' }], nextCursor: null } }
      : { data: { data: [{ alunoId: 'u1' }], nextCursor: 'c2' } }));
    const r = await criarFonteFlix(invocar).alunos('t1', 'ana');
    expect(r.map((a) => a.alunoId)).toEqual(['u1', 'u2']);
    expect(pedidos[0].caminho).toBe('/tribos/t1/alunos?limit=200&busca=ana');
    expect(pedidos[1].caminho).toBe('/tribos/t1/alunos?limit=200&busca=ana&cursor=c2');
  });

  it('escritas usam o método e o corpo do contrato', async () => {
    const { invocar, pedidos } = proxyFalso(() => ({ data: {} }));
    const f = criarFonteFlix(invocar);
    await f.criarPublicacao('t1', { tag: 'aviso', titulo: 'T', mensagem: 'M', link: null, status: 'publicada', destino: { tipo: 'tribo' }, registrarIntervencao: true });
    await f.editarSessao('s1', { status: 'realizada' });
    await f.excluirPublicacao('p1');
    await f.salvarGrupoTribo('t1', 'https://chat.whatsapp.com/x');
    await f.liberarAgenda('t1', 'u1', { titulo: 'Agenda', mensagem: 'Liberei' });
    await f.vincularGravacao('s1', { url: 'https://drive/x' });
    expect(pedidos).toEqual([
      // registrarIntervencao é do Academy e não vai para o Flix.
      { metodo: 'POST', caminho: '/tribos/t1/publicacoes', corpo: { tag: 'aviso', titulo: 'T', mensagem: 'M', link: null, status: 'publicada', destino: { tipo: 'tribo' } } },
      { metodo: 'PATCH', caminho: '/sessoes/s1', corpo: { status: 'realizada' } },
      { metodo: 'DELETE', caminho: '/publicacoes/p1' },
      { metodo: 'PUT', caminho: '/tribos/t1/canais/grupo_tribo', corpo: { url: 'https://chat.whatsapp.com/x' } },
      { metodo: 'POST', caminho: '/tribos/t1/convites', corpo: { alunoId: 'u1', mensagem: { titulo: 'Agenda', mensagem: 'Liberei' } } },
      { metodo: 'POST', caminho: '/sessoes/s1/gravacao', corpo: { url: 'https://drive/x', origem: 'manual' } },
    ].map((pedido) => expect.objectContaining(pedido)));
  });

  it('filtros viram query string sem chaves vazias', async () => {
    const { invocar, pedidos } = proxyFalso(() => ({ data: { data: [], nextCursor: null } }));
    await criarFonteFlix(invocar).sessoes('t1', { status: 'agendada', tipo: undefined });
    expect(pedidos[0].caminho).toBe('/tribos/t1/sessoes?status=agendada');
  });

  it('erro { error: { code, message, field } } do Flix vira ErroFonte', async () => {
    const { invocar } = proxyFalso(() => ({ error: erroHttp(422, { error: { code: 'validacao', message: 'Informe a data.', field: 'inicio' } }) }));
    const e = await criarFonteFlix(invocar).criarSessao('t1', { tipo: 'oficina', inicio: '' }).catch((x) => x);
    expect(e).toBeInstanceOf(ErroFonte);
    expect(e).toMatchObject({ status: 422, code: 'validacao', message: 'Informe a data.', field: 'inicio' });
  });

  it('falha de rede (sem Response) vira rede', async () => {
    const { invocar } = proxyFalso(() => ({ error: { name: 'FunctionsFetchError', message: 'Failed to send a request', context: new TypeError('fetch') } }));
    await expect(criarFonteFlix(invocar).me()).rejects.toMatchObject({ code: 'rede' });
  });

  it('5xx sem corpo de erro vira rede com o status', async () => {
    const { invocar } = proxyFalso(() => ({ error: erroHttp(502, 'bad gateway') }));
    await expect(criarFonteFlix(invocar).me()).rejects.toMatchObject({ code: 'rede', status: 502 });
  });
});
