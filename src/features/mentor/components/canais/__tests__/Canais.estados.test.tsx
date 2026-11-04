/** Estados da tela Canais com os hooks mockados: carregando, erro, vazio, `null` e erro da fonte. */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ErroFonte, type MeFlix } from '@/features/mentor/api/fonte';
import * as Q from '@/features/mentor/api/queries';
import Canais from '@/features/mentor/routes/v2/Canais';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/features/mentor/api/queries', async (orig) => {
  const real = await orig<typeof import('@/features/mentor/api/queries')>();
  return {
    hojeRotina: real.hojeRotina,
    useMe: vi.fn(), useRotina: vi.fn(), useMarcarRotinaEnviada: vi.fn(), useCanais: vi.fn(), useSalvarGrupoTribo: vi.fn(),
    useMural: vi.fn(), usePublicar: vi.fn(), useAlunosB2b: vi.fn(), usePerolas: vi.fn(),
  };
});

type Q = Record<string, unknown>;
const consulta = (x: Q = {}) => ({ data: undefined, isPending: false, isLoading: false, isError: false, isFetching: false, error: null, refetch: vi.fn(), ...x });
const mutacao = (x: Q = {}) => ({ mutate: vi.fn(), isPending: false, variables: undefined, ...x });
function me(totalAlunos: number | null = 186): MeFlix {
  return {
    portalMentor: true,
    mentor: { id: 'm', nome: 'Beatriz Câmara', fotoUrl: null, agendaUrl: null, modalidade: 'b2b' },
    tribos: [{ id: 't', nome: 'UniAtenas Paracatu', slug: 'u', modalidade: 'b2b', papel: 'titular', iesNome: 'UniAtenas', totalAlunos }],
  };
}
function padrao() {
  vi.mocked(Q.useMe).mockReturnValue(consulta({ data: me() }) as never);
  vi.mocked(Q.useRotina).mockReturnValue(consulta({ data: [] }) as never);
  vi.mocked(Q.useMarcarRotinaEnviada).mockReturnValue(mutacao() as never);
  vi.mocked(Q.useCanais).mockReturnValue(consulta({ data: [] }) as never);
  vi.mocked(Q.useSalvarGrupoTribo).mockReturnValue(mutacao() as never);
  vi.mocked(Q.useMural).mockReturnValue(consulta({ data: { data: [], nextCursor: null } }) as never);
  vi.mocked(Q.usePublicar).mockReturnValue(mutacao() as never);
  vi.mocked(Q.useAlunosB2b).mockReturnValue(consulta({ data: [] }) as never);
  vi.mocked(Q.usePerolas).mockReturnValue(consulta({ data: [] }) as never);
}
const renderizar = () => render(<MemoryRouter initialEntries={['/mentor/canais']}><Canais /></MemoryRouter>);
const secao = (nome: string | RegExp) => screen.getByRole('region', { name: nome });

beforeEach(() => { vi.clearAllMocks(); padrao(); });

describe('Canais · carregando', () => {
  it('skeleton em cada bloco; título e ações continuam visíveis', () => {
    const carregando = consulta({ isPending: true, isLoading: true });
    vi.mocked(Q.useRotina).mockReturnValue(carregando as never);
    vi.mocked(Q.useCanais).mockReturnValue(carregando as never);
    vi.mocked(Q.useMural).mockReturnValue(carregando as never);
    vi.mocked(Q.useAlunosB2b).mockReturnValue(carregando as never);
    vi.mocked(Q.usePerolas).mockReturnValue(carregando as never);
    renderizar();
    expect(screen.getByRole('heading', { level: 1, name: 'Canais' })).toBeInTheDocument();
    for (const rotulo of ['Carregando a rotina da semana', 'Carregando os canais gerais', 'Carregando as últimas publicações', 'Carregando as sinalizações à IES', 'Carregando o banco de pérolas']) {
      expect(screen.getByRole('status', { name: rotulo })).toHaveAttribute('aria-busy', 'true');
    }
    expect(screen.getByRole('button', { name: 'Nova publicação' })).toBeInTheDocument();
  });
});

describe('Canais · erro', () => {
  it('EstadoErro com "Tentar novamente" refaz só a consulta do bloco', async () => {
    const user = userEvent.setup();
    const erro = (refetch = vi.fn()) => consulta({ isError: true, error: new ErroFonte(503, 'rede', 'x'), refetch });
    const r = { rotina: vi.fn(), canais: vi.fn(), mural: vi.fn(), perolas: vi.fn(), alunos: vi.fn() };
    vi.mocked(Q.useRotina).mockReturnValue(erro(r.rotina) as never);
    vi.mocked(Q.useCanais).mockReturnValue(erro(r.canais) as never);
    vi.mocked(Q.useMural).mockReturnValue(erro(r.mural) as never);
    vi.mocked(Q.usePerolas).mockReturnValue(erro(r.perolas) as never);
    vi.mocked(Q.useAlunosB2b).mockReturnValue(erro(r.alunos) as never);
    renderizar();
    expect(screen.getAllByRole('alert')).toHaveLength(5);
    expect(screen.getAllByText('Não foi possível carregar agora. Tente novamente.')).toHaveLength(5);
    await user.click(within(secao(/Grupo de WhatsApp/)).getByRole('button', { name: 'Tentar novamente' }));
    expect(r.rotina).toHaveBeenCalledTimes(1);
    expect(r.perolas).not.toHaveBeenCalled();
    await user.click(within(secao('Banco de pérolas · rodízio entre mentores')).getByRole('button', { name: 'Tentar novamente' }));
    expect(r.perolas).toHaveBeenCalledTimes(1);
    // Sem canais, o "Abrir grupo" não aparece.
    expect(screen.queryByRole('link', { name: /Abrir grupo/ })).toBeNull();
  });

  it('erro da fonte ao marcar como enviado aparece inline no item', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T15:00:00Z'));
    try {
      vi.mocked(Q.useRotina).mockReturnValue(consulta({ data: [{ id: 'q', semana: '2026-10-12', dia: 'qui', tipo: 'resposta', conteudo: '', enviadoEm: null }] }) as never);
      const mutate = vi.fn((_id: string, o: { onError: (e: unknown) => void }) => o.onError(new ErroFonte(400, 'validacao', 'Envio não encontrado')));
      vi.mocked(Q.useMarcarRotinaEnviada).mockReturnValue(mutacao({ mutate }) as never);
      renderizar();
      await user.click(screen.getByRole('button', { name: /Marcar como enviado/ }));
      expect(mutate).toHaveBeenCalledWith('q', expect.anything());
      expect(within(secao(/Grupo de WhatsApp/)).getByRole('alert')).toHaveTextContent('Envio não encontrado');
    } finally {
      vi.useRealTimers();
    }
  });

  it('erro da fonte ao publicar fica no composer e não fecha', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_e: unknown, o: { onError: (e: unknown) => void }) => o.onError(new ErroFonte(403, 'sem_acesso_tribo', 'x')));
    vi.mocked(Q.usePublicar).mockReturnValue(mutacao({ mutate }) as never);
    renderizar();
    const mural = secao('Mural no Academy');
    await user.click(within(mural).getByRole('button', { name: 'Nova publicação' }));
    await user.type(within(mural).getByRole('textbox', { name: 'Título' }), 'T');
    await user.type(within(mural).getByRole('textbox', { name: 'Mensagem' }), 'M');
    await user.click(within(mural).getByRole('button', { name: 'Publicar para 186' }));
    expect(mutate.mock.calls[0][0]).toEqual({
      pub: { tag: 'fique_por_dentro', titulo: 'T', mensagem: 'M', link: null, status: 'publicada', destino: { tipo: 'tribo' } },
      registrarIntervencao: false,
    });
    expect(within(mural).getByRole('alert')).toHaveTextContent('Você não tem acesso a esta turma.');
    expect(within(mural).getByRole('textbox', { name: 'Título' })).toHaveValue('T');
  });
});

describe('Canais · vazio', () => {
  it('cada bloco diz que não há dado, sem inventar números', () => {
    renderizar();
    expect(screen.getByText('Sem rotina cadastrada nesta semana.')).toBeInTheDocument();
    expect(screen.getByText('Canais gerais ainda não configurados.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma publicação no mural ainda.')).toBeInTheDocument();
    expect(screen.getByText('Sinalizações à IES · 0')).toBeInTheDocument();
    expect(screen.getByText('Nenhum aluno sinalizado neste ciclo.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma pérola no rodízio ainda.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('grupo sem link cadastrado: sem "Abrir grupo", com "Cadastrar link"', () => {
    vi.mocked(Q.useCanais).mockReturnValue(consulta({ data: [{ tipo: 'grupo_turma', url: '', editavel: true, configurado: false }] }) as never);
    renderizar();
    const grupo = secao(/Grupo de WhatsApp/);
    expect(within(grupo).queryByRole('link', { name: /Abrir grupo/ })).toBeNull();
    expect(within(grupo).getByRole('button', { name: 'Cadastrar link' })).toBeInTheDocument();
  });
});

describe('Canais · null nunca vira zero', () => {
  it('sem total de alunos, sem data e sem nome: "a turma" e "—"', () => {
    vi.mocked(Q.useMe).mockReturnValue(consulta({ data: me(null) }) as never);
    vi.mocked(Q.useMural).mockReturnValue(consulta({ data: { data: [{ id: 'p', tag: 'aviso', titulo: 'Sem data', mensagem: 'm', link: null, anexoUrl: null, destino: { tipo: 'turma' }, status: 'publicada', publicadaEm: null }], nextCursor: null } }) as never);
    vi.mocked(Q.useAlunosB2b).mockReturnValue(consulta({ data: [{ email: 'x@ies.br', nome: null, sinalizadoEm: '2026-10-02T12:00:00Z', proficiencias: [] }] }) as never);
    vi.mocked(Q.usePerolas).mockReturnValue(consulta({ data: [{ id: 'z', texto: 'ECG com QRS largo', tema: null, criadaEm: '2026-10-01T00:00:00Z' }] }) as never);
    renderizar();
    const pub = within(secao('Mural no Academy')).getByRole('listitem');
    expect(pub).toHaveTextContent('Sem data');
    expect(pub).toHaveTextContent('—');
    expect(within(secao(/Comitê pedagógico/)).getByRole('listitem')).toHaveTextContent('x@ies.br02/10');
    const [, linha] = within(secao(/Banco de pérolas/)).getAllByRole('row');
    expect(linha).toHaveTextContent('——ECG com QRS largo');
    expect(linha).not.toHaveTextContent('0');
  });

  it('sem total de alunos o composer publica "para a turma"', async () => {
    const user = userEvent.setup();
    vi.mocked(Q.useMe).mockReturnValue(consulta({ data: me(null) }) as never);
    renderizar();
    await user.click(screen.getByRole('button', { name: 'Nova publicação' }));
    expect(screen.getByRole('button', { name: 'Publicar para a turma' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Mensagem' })).toHaveAttribute('placeholder', 'Mensagem para a turma');
  });
});
