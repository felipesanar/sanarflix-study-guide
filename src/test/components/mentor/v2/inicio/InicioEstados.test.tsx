/**
 * Estados do Início (carregando, erro, sem simulado V0, vazio, null) com os hooks de `queries.ts` mockados.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as Q from '@/features/mentor/api/queries';
import { ErroFonte, type MeFlix } from '@/features/mentor/api/fonte';
import type { AlunoTurmaAcademy, DesempenhoTurmaB2c } from '@/features/mentor/api/types';
import Inicio from '@/features/mentor/routes/v2/Inicio';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/features/mentor/api/queries', async () => {
  const real = await vi.importActual<typeof import('@/features/mentor/api/queries')>('@/features/mentor/api/queries');
  return {
    hojeRotina: real.hojeRotina,
    useMe: vi.fn(), useDesempenhoTurma: vi.fn(), useSerieTurma: vi.fn(), useTurmaAcademy: vi.fn(), useEngajamentoTurma: vi.fn(),
    useSessoes: vi.fn(), useIntervencoes: vi.fn(), useAlunos: vi.fn(), useVisaoGeralB2b: vi.fn(), useAlunosB2b: vi.fn(),
    useRotina: vi.fn(), useMarcarRotinaEnviada: vi.fn(),
  };
});

const refetch = vi.fn();
function dag<T>(data: T | undefined, extra: Record<string, unknown> = {}) {
  return { data, meta: undefined, isLoading: false, isError: false, isPlaceholderData: false, isFetching: false, refetch, error: null, ...extra };
}
function query<T>(data: T | undefined, extra: Record<string, unknown> = {}) {
  return { data, isLoading: false, isPending: false, isError: false, isFetching: false, refetch, error: null, ...extra } as never;
}
function me(modalidade: 'b2c' | 'b2b'): MeFlix {
  return {
    portalMentor: true,
    mentor: { id: 'm', nome: 'Thiago Taniguchi', fotoUrl: null, agendaUrl: null, modalidade, bio: null, mote: null, googleEmail: null, ativo: true },
    tribos: [{ id: 't', nome: modalidade === 'b2c' ? 'Carcará' : 'UniAtenas Paracatu', slug: modalidade === 'b2c' ? 'carcara' : 'x', modalidade, papel: 'titular', mentoriaAtiva: false, lema: 'Nota 90+', iesNome: 'UniAtenas', campus: 'Paracatu' }],
  };
}
function aluno(email: string, dias: number | null): AlunoTurmaAcademy {
  const vazio = { respondidas: null, acertos: null, erros: null, pctAcerto: null };
  return {
    email, nome: email, telefone: null, semestre: null, acessoAte: null, b2b: false, academyUserId: null, sanarflixUserId: null,
    ultimaAtividade: null, diasSemAtividade: dias, segmento: 'ativo', meta: null, conteudos7d: { videos: null, documentos: null, total: null },
    conteudos30d: { videos: null, documentos: null, total: null }, temDadoConsumo: false, questoes7d: vazio, questoes30d: vazio, temDadoQuestoes: false,
  };
}
const semSimulado: DesempenhoTurmaB2c = { alunos: [], possivelAprovacaoPct: null, acertoMedioUltimo: null, simulados: [], participacaoUltimo: { simuladoId: null, fizeram: 0, total: 3 } };

function base(modalidade: 'b2c' | 'b2b') {
  vi.mocked(Q.useMe).mockReturnValue(query(me(modalidade)));
  vi.mocked(Q.useDesempenhoTurma).mockReturnValue(dag(semSimulado));
  vi.mocked(Q.useSerieTurma).mockReturnValue(dag([]));
  vi.mocked(Q.useTurmaAcademy).mockReturnValue(dag([aluno('a@x', 20), aluno('b@x', 10), aluno('c@x', 2)]));
  vi.mocked(Q.useEngajamentoTurma).mockReturnValue(dag([]));
  vi.mocked(Q.useSessoes).mockReturnValue(query({ data: [], nextCursor: null }));
  vi.mocked(Q.useIntervencoes).mockReturnValue(query({ cards: [], planejadas: 0, realizadas: 0 }));
  vi.mocked(Q.useAlunos).mockReturnValue(query([]));
  vi.mocked(Q.useVisaoGeralB2b).mockReturnValue(dag(undefined, { isLoading: modalidade === 'b2b' }));
  vi.mocked(Q.useAlunosB2b).mockReturnValue(dag(undefined, { isLoading: modalidade === 'b2b' }));
  vi.mocked(Q.useRotina).mockReturnValue(query([]));
  vi.mocked(Q.useMarcarRotinaEnviada).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
}
const renderInicio = () => render(<MemoryRouter initialEntries={['/mentor']}><Inicio /></MemoryRouter>);

beforeEach(() => { vi.clearAllMocks(); base('b2c'); });

describe('Início · estados', () => {
  it('carregando: faixa visível e skeletons na anatomia', () => {
    vi.mocked(Q.useDesempenhoTurma).mockReturnValue(dag(undefined, { isLoading: true }));
    renderInicio();
    expect(screen.getByRole('heading', { level: 1, name: /, Thiago$/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Publicar no mural' })).toBeVisible();
    expect(screen.getAllByRole('status', { name: /Carregando/ }).length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByRole('region', { name: 'Quem precisa de você' })).not.toBeInTheDocument();
  });

  it('erro: faixa de erro global com "Tentar novamente"; a faixa da tribo e as ações continuam', async () => {
    vi.mocked(Q.useTurmaAcademy).mockReturnValue(dag(undefined, { isError: true, error: new ErroFonte(500, 'rede', 'x') }));
    renderInicio();
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar os dados da turma.');
    await userEvent.click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Nova intervenção' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Visão geral da tribo' })).not.toBeInTheDocument();
  });

  it('erro B2B usa o texto dos indicadores', () => {
    base('b2b');
    vi.mocked(Q.useVisaoGeralB2b).mockReturnValue(dag(undefined, { isError: true, error: new ErroFonte(500, 'rede', 'x') }));
    vi.mocked(Q.useAlunosB2b).mockReturnValue(dag([]));
    renderInicio();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os indicadores.');
  });

  it('sem simulado (V0): indicadores de engajamento, faixa informativa e só Sumiram/Esfriando', async () => {
    renderInicio();
    const visao = screen.getByRole('region', { name: 'Visão geral da tribo' });
    expect(within(visao).getByText('últimos 7 dias')).toBeVisible();
    expect(within(visao).getByText('Ativos na semana')).toBeVisible();
    expect(within(visao).getByText('Questões por aluno ativo')).toBeVisible();
    expect(within(visao).getByText('Sem acesso há 15+ dias')).toBeVisible();
    expect(within(visao).getByText('mesmo corte do alerta')).toBeVisible();
    expect(screen.getByText('Simulados ainda não disponíveis. Por enquanto, só alertas de engajamento.')).toBeVisible();
    const lista = screen.getByRole('region', { name: 'Quem precisa de você' });
    expect(within(lista).getByRole('button', { name: /Sumiram/ })).toBeVisible();
    expect(within(lista).getByRole('button', { name: /Esfriando/ })).toHaveTextContent('Sem acesso entre 8 e 14 dias');
    expect(within(lista).queryByRole('button', { name: /Regrediram/ })).not.toBeInTheDocument();
    expect(within(lista).getByText(/2 alertas/)).toBeVisible();
  });

  it('null nunca vira zero: questões sem dado mostram —', () => {
    renderInicio();
    const visao = screen.getByRole('region', { name: 'Visão geral da tribo' });
    const celula = within(visao).getByText('Questões por aluno ativo').closest('div')!;
    expect(celula).toHaveTextContent('—');
    expect(celula).not.toHaveTextContent('0');
  });

  it('vazios: sem sessões e sem cards em A fazer', () => {
    renderInicio();
    expect(within(screen.getByRole('region', { name: 'Próximas sessões' })).getByText('Nenhuma sessão agendada.')).toBeVisible();
    expect(within(screen.getByRole('region', { name: /A fazer/ })).getByText('Nada pendente.')).toBeVisible();
  });

  it('erro só nas sessões fica no bloco, sem derrubar a tela', async () => {
    vi.mocked(Q.useSessoes).mockReturnValue(query(undefined, { isError: true, error: new ErroFonte(500, 'rede', 'x') }));
    renderInicio();
    const bloco = screen.getByRole('region', { name: 'Próximas sessões' });
    await userEvent.click(within(bloco).getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Quem precisa de você' })).toBeVisible();
  });

  it('foco visível nos controles (anel de 2px da marca)', () => {
    renderInicio();
    for (const b of [screen.getByRole('button', { name: 'Ver agenda' }), screen.getByRole('button', { name: 'Abrir kanban' }), screen.getByRole('button', { name: /Ver turma/ })]) {
      expect(b.className).toMatch(/focus-visible:outline-2/);
    }
  });
});
