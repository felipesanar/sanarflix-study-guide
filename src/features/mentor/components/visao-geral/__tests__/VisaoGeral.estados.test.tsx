/**
 * Estados da Visão Geral com os hooks de `api/queries.ts` controlados: carregando, erro, vazio, lista
 * curta, `null` (nunca zero) e erro da fonte nas ações.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErroFonte } from '@/features/mentor/api/fonte';
import * as Q from '@/features/mentor/api/queries';
import type { AlunoB2b, TemaTurmaMentor, VisaoGeralB2b } from '@/features/mentor/api/types';
import VisaoGeral from '@/features/mentor/routes/v2/VisaoGeral';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/features/gestor/hooks/useCountUp', () => ({ useCountUp: (v: number | null) => v }));
vi.mock('@/features/gestor/hooks/useDelayedLoading', () => ({ useDelayedLoading: (v: boolean) => v }));
vi.mock('@/features/mentor/api/queries', () => ({
  useVisaoGeralB2b: vi.fn(), useTemasTurmaB2b: vi.fn(), useAlunosB2b: vi.fn(), useQuestoesB2b: vi.fn(),
  useSessoes: vi.fn(), useEditarSessao: vi.fn(), useRegistrarEvento: vi.fn(),
}));

type R<T> = Q.ResultadoMentor<T>;
const res = <T,>(data: T | undefined, extra: Partial<R<T>> = {}): R<T> => ({
  data, meta: undefined, isLoading: data === undefined, isError: false, isPlaceholderData: false, isFetching: false,
  refetch: vi.fn(), error: null, ...extra,
});
const erro = <T,>(refetch = vi.fn()): R<T> => res<T>(undefined, { isLoading: false, isError: true, refetch, error: new ErroFonte(500, 'rede', 'x') });

const visao = (p: Partial<VisaoGeralB2b> = {}): VisaoGeralB2b => ({
  simulados: [
    { id: 's3', ordem: 3, nome: '3º Simulado ENAMED', data: '2026-08-27', status: 'realizado', participantes: 163 },
    { id: 's4', ordem: 4, nome: '4º Simulado ENAMED', data: '2026-10-01', status: 'realizado', participantes: 171 },
    { id: 's5', ordem: 5, nome: '5º Simulado ENAMED', data: null, status: 'previsto', participantes: null },
  ],
  simuladoReferenciaId: 's4',
  conceitoEnamed: { valor: 3, delta: 1, serie: [{ rotulo: '3º', valor: 2 }, { rotulo: '4º', valor: 3 }] },
  triProjetado: { valor: 61.2, delta: 2, serie: [{ rotulo: '3º', valor: 59.2 }, { rotulo: '4º', valor: 61.2 }] },
  proficientesPct: { valor: 55, delta: 3, serie: [] },
  proficientes: 94, participantes: 171, totalAlunos: 186, acertoPct: 61.8, simuladosRealizados: 4, simuladosContratados: 6,
  ...p,
});
const tema = (i: number, p: Partial<TemaTurmaMentor> = {}): TemaTurmaMentor => ({
  id: `t${i}`, tema: `Tema ${i}`, especialidade: 'Esp', grandeArea: 'Preventiva', prevalencia: 'alta', peso: 3, respostas: 40,
  acertoPct: 30 + i, alunosAbaixo50: ['a'], critico: true, serie: [], ...p,
});
const aluno: AlunoB2b = {
  email: 'ana@x.com', nome: 'Ana', semestre: null, telefone: null, proficiencias: [{ simuladoId: 's4', ordem: 4, valor: null }],
  acertoUltimoPct: null, ultimaAtividade: null, diasSemAtividade: null, perfil: null, grupo: null, sinalizadoEm: null,
};

const mutacao = (extra: Record<string, unknown> = {}) => ({ mutate: vi.fn(), isPending: false, ...extra });
function hooks(p: { visao?: R<VisaoGeralB2b>; temas?: R<TemaTurmaMentor[]>; alunos?: R<AlunoB2b[]>; sessoes?: unknown; editar?: unknown; evento?: unknown } = {}) {
  vi.mocked(Q.useVisaoGeralB2b).mockReturnValue(p.visao ?? res(visao()));
  vi.mocked(Q.useTemasTurmaB2b).mockReturnValue(p.temas ?? res([tema(1)]));
  vi.mocked(Q.useAlunosB2b).mockReturnValue(p.alunos ?? res([aluno]));
  vi.mocked(Q.useQuestoesB2b).mockReturnValue(res([]));
  vi.mocked(Q.useSessoes).mockReturnValue((p.sessoes ?? { data: { data: [], nextCursor: null }, isLoading: false, isError: false }) as ReturnType<typeof Q.useSessoes>);
  vi.mocked(Q.useEditarSessao).mockReturnValue((p.editar ?? mutacao()) as unknown as ReturnType<typeof Q.useEditarSessao>);
  vi.mocked(Q.useRegistrarEvento).mockReturnValue((p.evento ?? mutacao()) as unknown as ReturnType<typeof Q.useRegistrarEvento>);
}
const montar = (caminho = '/mentor/visao-geral') =>
  render(<TooltipProvider><MemoryRouter initialEntries={[caminho]}><VisaoGeral /></MemoryRouter></TooltipProvider>);

beforeEach(() => { vi.clearAllMocks(); hooks(); });

describe('carregando', () => {
  it('título e período continuam visíveis; blocos em skeleton (temas: 3 linhas)', () => {
    hooks({ visao: res<VisaoGeralB2b>(undefined), temas: res<TemaTurmaMentor[]>(undefined), alunos: res<AlunoB2b[]>(undefined) });
    montar();
    expect(screen.getByRole('heading', { level: 1, name: 'Visão Geral' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Período' })).toBeVisible();
    expect(screen.getByRole('status', { name: 'Carregando a projeção para o ENAMED' })).toBeVisible();
    expect(screen.getAllByRole('status', { name: 'Carregando temas críticos' })).toHaveLength(3);
    expect(screen.getByRole('status', { name: 'Carregando alunos' })).toBeVisible();
    expect(screen.queryByText(/simulados? no período/)).not.toBeInTheDocument();
  });
});

describe('erro', () => {
  it('cada bloco falha sozinho com "Tentar novamente" que refaz só a sua consulta', () => {
    const rv = vi.fn(); const rt = vi.fn(); const ra = vi.fn();
    hooks({ visao: erro(rv), temas: erro(rt), alunos: erro(ra) });
    montar();
    const botoes = screen.getAllByRole('button', { name: 'Tentar novamente' });
    expect(botoes).toHaveLength(3);
    botoes.forEach((b) => fireEvent.click(b));
    expect(rv).toHaveBeenCalledTimes(1);
    expect(rt).toHaveBeenCalledTimes(1);
    expect(ra).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: /Temas críticos da turma/ })).toBeVisible();
  });
});

describe('vazio e lista curta', () => {
  it('sem temas: mensagem do protótipo', () => {
    hooks({ temas: res([tema(1, { acertoPct: 72 })]) });
    montar();
    expect(screen.getByRole('heading', { name: /Temas críticos da turma/ })).toHaveTextContent('0');
    expect(screen.getByText('Nenhum tema crítico neste recorte')).toBeVisible();
    expect(screen.getByText('Nenhum tema abaixo de 50% de acerto.')).toBeVisible();
  });
  it('lista curta (3 temas) não tem botão de expandir', () => {
    hooks({ temas: res([tema(1), tema(2), tema(3)]) });
    montar();
    expect(screen.getByText('Mostrando 3 de 3')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Mostrar mais|Recolher para/ })).not.toBeInTheDocument();
  });
  it('sem simulado no período: vazio no lugar dos indicadores, com volta ao período padrão', () => {
    hooks({ visao: res(visao({ simuladoReferenciaId: null, triProjetado: { valor: null, delta: null, serie: [] }, conceitoEnamed: { valor: null, delta: null, serie: [] } })) });
    montar('/mentor/visao-geral?periodo=30d');
    expect(screen.getByText('Nenhum simulado realizado neste período.')).toBeVisible();
    expect(screen.queryByRole('link', { name: /Detalhar este simulado/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver últimos 6 meses' }));
    expect(screen.getByRole('button', { name: 'Últimos 6 meses' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('null nunca vira zero', () => {
  it('indicadores nulos mostram —, sem régua nem delta com 1 ponto válido', () => {
    hooks({
      visao: res(visao({
        conceitoEnamed: { valor: null, delta: null, serie: [{ rotulo: '4º', valor: null }] },
        triProjetado: { valor: 57, delta: 1, serie: [{ rotulo: '3º', valor: null }, { rotulo: '4º', valor: 57 }] },
        proficientesPct: { valor: null, delta: null, serie: [] }, proficientes: null, participantes: null, totalAlunos: null, acertoPct: null,
        simuladosContratados: null,
      })),
    });
    montar();
    const conceito = screen.getByTestId('kpi-conceito-enamed');
    expect(within(conceito).getByTestId('kpi-valor')).toHaveTextContent('—');
    expect(within(conceito).queryByTestId('kpi-regua')).not.toBeInTheDocument();
    const tri = screen.getByTestId('kpi-tri-projetado');
    expect(within(tri).getByTestId('kpi-valor')).toHaveTextContent('57');
    expect(within(tri).queryByTestId('kpi-delta')).not.toBeInTheDocument();
    expect(within(tri).queryByTestId('kpi-regua')).not.toBeInTheDocument();
    const obs = screen.getByRole('region', { name: 'Resultados observados' });
    expect(within(obs).getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(within(obs).queryByText(/não fizeram/)).not.toBeInTheDocument();
    expect(within(obs).queryByText(/0%/)).not.toBeInTheDocument();
  });

  it('"faltam X alunos para o conceito N" só quando a RPC traz faltam_para_proximo_conceito', () => {
    hooks({ visao: res({ ...visao(), faltamParaProximoConceito: 7 } as VisaoGeralB2b) });
    const { unmount } = montar();
    expect(within(screen.getByTestId('kpi-conceito-enamed')).getByText(/faltam 7 alunos para o conceito 4/)).toBeVisible();
    unmount();
    hooks({ visao: res({ ...visao(), conceitoEnamed: { valor: 5, delta: null, serie: [] }, faltamParaProximoConceito: null } as VisaoGeralB2b) });
    montar();
    expect(screen.queryByText(/alunos para o conceito/)).not.toBeInTheDocument();
  });

  it('TRI ≥ 60: texto diz que o corte foi atingido (cor nunca é o único sinal)', () => {
    montar();
    const tri = screen.getByTestId('kpi-tri-projetado');
    expect(within(tri).getByText('média da turma no corte de proficiente (60) ou acima')).toBeVisible();
    expect(within(tri).getByTestId('kpi-valor')).toHaveStyle({ color: 'var(--gp-success-on)' });
  });

  it('aluno sem dado: semestre, proficiência, acerto e acesso como —/nunca; grupo —', () => {
    montar();
    const linha = screen.getByRole('button', { name: 'Ana' }).closest('[role="row"]') as HTMLElement;
    expect(linha).toHaveTextContent('nunca');
    expect(within(linha).getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });
});

describe('ações dos temas', () => {
  it('sem oficina agendada, a ação fica desabilitada com o motivo', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Tema 1' }));
    expect(screen.getByRole('button', { name: 'Nenhuma oficina agendada' })).toBeDisabled();
  });
  it('erro da fonte ao criar intervenção aparece inline via mensagemErro', () => {
    const mutate = vi.fn((_e: unknown, o: { onError: (e: unknown) => void }) => o.onError(new ErroFonte(403, 'sem_acesso_tribo', 'x')));
    hooks({ evento: mutacao({ mutate }) });
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Tema 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar intervenção' }));
    expect(mutate).toHaveBeenCalledWith(
      { tipo: 'intervencao_tema', temaId: 't1', tema: 'Tema 1', acertoPct: 31, origem: 'tema_critico' }, expect.anything(),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Você não tem acesso a esta turma.');
  });
  it('levar para a oficina grava o tema na pauta da próxima oficina', () => {
    const mutate = vi.fn();
    const oficina = { id: 'of', tipo: 'oficina', data: '2999-11-19', hora: '20:00', tema: null, alunoId: null, link: null, status: 'agendada', gravacaoUrl: null,
      pauta: [{ id: 'p1', origem: 'livre', referenciaId: null, texto: 'Abertura' }] };
    hooks({ sessoes: { data: { data: [oficina], nextCursor: null }, isLoading: false, isError: false }, editar: mutacao({ mutate }) });
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Tema 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Levar para a próxima oficina (19/11)' }));
    expect(mutate).toHaveBeenCalledWith({
      id: 'of', mudancas: { pauta: [
        { texto: 'Abertura', origem: 'livre', ordem: 0 },
        { texto: 'Tema 1 · 31% de acerto', origem: 'tema_critico', referenciaId: 't1', ordem: 1 },
      ] },
    }, expect.anything());
  });
});

describe('acessibilidade', () => {
  it('sem violações de axe na tela com dados', async () => {
    const { container } = montar();
    expect(await axe(container)).toHaveNoViolations();
  });
});
