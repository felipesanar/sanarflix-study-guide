/**
 * Ordem das ações compostas (docs/07 § Quem guarda o quê): fonte primeiro; se a fonte não grava o
 * evento no servidor, `registrar_evento_mentor` depois; se a fonte falhar, nada no Academy.
 */
import { describe, expect, it, vi } from 'vitest';
import { ErroFonte, type FonteMentoria } from '@/features/mentor/api/fonte';
import type { EventoSql } from '@/features/mentor/api/fonteAcademy';
import {
  criarSessaoComposto,
  liberarAgendaComposto,
  marcarRealizadaComposto,
  publicarComposto,
  type CtxComposto,
} from '@/features/mentor/api/queries';
import type { Publicacao, Sessao } from '@/features/mentor/api/types';

const PUB: Publicacao = { id: 'p1', tag: 'aviso', titulo: 'Aviso', mensagem: 'm', link: null, anexoUrl: null, destino: { tipo: 'selecionados', alunoIds: ['u1'] }, status: 'publicada', publicadaEm: '2026-10-01T00:00:00Z' };
const SESSAO: Sessao = { id: 's1', tipo: 'individual', data: '2026-10-20', hora: '19:00', tema: 'Plano', alunoId: 'u1', link: null, status: 'agendada', gravacaoUrl: null, pauta: [] };

function montar(eventosNoServidor: boolean, falhar = false) {
  const ordem: string[] = [];
  const falha = new ErroFonte(503, 'rede', 'Flix fora');
  const resolve = <T>(nome: string, v: T) => async () => {
    ordem.push(nome);
    if (falhar) throw falha;
    return v;
  };
  const fonte = {
    nome: eventosNoServidor ? 'academy' : 'flix',
    eventosNoServidor,
    criarPublicacao: vi.fn(resolve('fonte.criarPublicacao', PUB)),
    liberarAgenda: vi.fn(resolve('fonte.liberarAgenda', { id: 'conv-1', alunoId: 'u1', publicacaoId: 'p7', ativo: true, liberadoEm: '2026-10-01T00:00:00Z' })),
    criarSessao: vi.fn(resolve('fonte.criarSessao', { ...SESSAO, warnings: [] })),
    editarSessao: vi.fn(resolve('fonte.editarSessao', { ...SESSAO, status: 'realizada' as const })),
  } as unknown as FonteMentoria;
  const registrarEvento = vi.fn(async (e: EventoSql) => { ordem.push(`academy.${e.tipo}`); return { intervencaoId: 'i1', duplicado: false }; });
  const ctx: CtxComposto = {
    fonte,
    dados: { registrarEvento },
    resolverEmails: async () => (id: string) => `${id}@x.com`,
  };
  return { ctx, ordem, registrarEvento, falha };
}

describe('mutations compostas · Flix (eventosNoServidor = false)', () => {
  it('publicar com "Registrar como intervenção": fonte primeiro, evento depois, com e-mail do Academy', async () => {
    const { ctx, ordem, registrarEvento } = montar(false);
    await publicarComposto(ctx, 't1', { pub: { tag: 'aviso', titulo: 'Aviso', mensagem: 'm', link: null, status: 'publicada', destino: { tipo: 'alunos', alunoIds: ['u1'] } }, registrarIntervencao: true });
    expect(ordem).toEqual(['fonte.criarPublicacao', 'academy.mural_publicado']);
    expect(registrarEvento.mock.calls[0][0]).toMatchObject({ tipo: 'mural_publicado', referencia_id: 'p1', alunos: ['u1@x.com'], registrar_intervencao: true });
  });

  it('publicar sem registrar (ou rascunho) não grava evento', async () => {
    const { ctx, registrarEvento } = montar(false);
    await publicarComposto(ctx, 't1', { pub: { tag: 'aviso', titulo: 'A', mensagem: 'm', link: null, status: 'publicada', destino: { tipo: 'tribo' } }, registrarIntervencao: false });
    await publicarComposto(ctx, 't1', { pub: { tag: 'aviso', titulo: 'A', mensagem: 'm', link: null, status: 'rascunho', destino: { tipo: 'tribo' } }, registrarIntervencao: true });
    expect(registrarEvento).not.toHaveBeenCalled();
  });

  it('liberar agenda: convite no Flix, depois agenda_liberada com o id do convite', async () => {
    const { ctx, ordem, registrarEvento } = montar(false);
    await liberarAgendaComposto(ctx, 't1', { aluno: { alunoId: 'u1', nome: 'Bruno Teles' }, titulo: 'Agenda', mensagem: 'Liberei' });
    expect(ordem).toEqual(['fonte.liberarAgenda', 'academy.agenda_liberada']);
    expect(registrarEvento.mock.calls[0][0]).toMatchObject({ referencia_id: 'conv-1', alunos: ['u1@x.com'] });
  });

  it('criar sessão e marcar realizada: fonte primeiro, depois sessao_criada / sessao_realizada', async () => {
    const { ctx, ordem } = montar(false);
    await criarSessaoComposto(ctx, 't1', { sessao: { tipo: 'individual', inicio: '2026-10-20T22:00:00Z', alunoId: 'u1' }, alunoNome: 'Bruno' });
    await marcarRealizadaComposto(ctx, 't1', 's1');
    expect(ordem).toEqual(['fonte.criarSessao', 'academy.sessao_criada', 'fonte.editarSessao', 'academy.sessao_realizada']);
  });

  it.each([
    ['publicar', (c: CtxComposto) => publicarComposto(c, 't1', { pub: { tag: 'aviso', titulo: 'A', mensagem: 'm', link: null, status: 'publicada', destino: { tipo: 'tribo' } }, registrarIntervencao: true })],
    ['liberar agenda', (c: CtxComposto) => liberarAgendaComposto(c, 't1', { aluno: { alunoId: 'u1', nome: 'B' }, titulo: 't', mensagem: 'm' })],
    ['criar sessão', (c: CtxComposto) => criarSessaoComposto(c, 't1', { sessao: { tipo: 'oficina', inicio: '2026-10-22T23:00:00Z' } })],
    ['marcar realizada', (c: CtxComposto) => marcarRealizadaComposto(c, 't1', 's1')],
  ])('%s: se a fonte falhar, registrar_evento_mentor não é chamado e o erro sobe', async (_n, acao) => {
    const { ctx, registrarEvento, falha } = montar(false, true);
    await expect(acao(ctx)).rejects.toBe(falha);
    expect(registrarEvento).not.toHaveBeenCalled();
  });
});

describe('mutations compostas · Academy (eventosNoServidor = true)', () => {
  it('nenhuma ação chama registrar_evento_mentor: o servidor já criou/moveu o card', async () => {
    const { ctx, registrarEvento, ordem } = montar(true);
    await publicarComposto(ctx, 't1', { pub: { tag: 'aviso', titulo: 'A', mensagem: 'm', link: null, status: 'publicada', destino: { tipo: 'tribo' } }, registrarIntervencao: true });
    await liberarAgendaComposto(ctx, 't1', { aluno: { alunoId: 'u1@x.com', nome: 'B' }, titulo: 't', mensagem: 'm' });
    await criarSessaoComposto(ctx, 't1', { sessao: { tipo: 'oficina', inicio: '2026-10-22T23:00:00Z' } });
    await marcarRealizadaComposto(ctx, 't1', 's1');
    expect(registrarEvento).not.toHaveBeenCalled();
    expect(ordem).toEqual(['fonte.criarPublicacao', 'fonte.liberarAgenda', 'fonte.criarSessao', 'fonte.editarSessao']);
  });

  it('o pedido de registrar intervenção vai para a própria fonte (mentor_mural_salvar)', async () => {
    const { ctx } = montar(true);
    await publicarComposto(ctx, 't1', { pub: { tag: 'aviso', titulo: 'A', mensagem: 'm', link: null, status: 'publicada', destino: { tipo: 'tribo' } }, registrarIntervencao: true });
    expect(vi.mocked(ctx.fonte.criarPublicacao).mock.calls[0][1]).toMatchObject({ registrarIntervencao: true });
  });
});
