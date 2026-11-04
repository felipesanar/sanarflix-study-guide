import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { criarMock } from '@/features/mentor/api/fonteMock';
import { ErroFonte } from '@/features/mentor/api/fonte';
import type {
  AlunoTurmaAcademy, DesempenhoTurmaB2c, DetalhamentoMentor, EngajamentoAluno, PontoSerieTurma, TemaTurmaMentor,
} from '@/features/mentor/api/types';
import {
  useDesempenhoTurma, useDetalhamento, useEngajamentoTurma, useRegistrarEvento, useSerieTurma, useTemasTurma, useTurmaAcademy,
} from '@/features/mentor/api/queries';
import MinhaTurma from '@/features/mentor/routes/v2/MinhaTurma';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/features/gestor/hooks/useCountUp', () => ({ useCountUp: (v: number | null) => v }));
vi.mock('@/features/mentor/api/queries', () => ({
  useTurmaAcademy: vi.fn(), useDesempenhoTurma: vi.fn(), useSerieTurma: vi.fn(), useEngajamentoTurma: vi.fn(),
  useTemasTurma: vi.fn(), useDetalhamento: vi.fn(), useRegistrarEvento: vi.fn(),
}));

interface Dados {
  turma: AlunoTurmaAcademy[];
  desempenho: DesempenhoTurmaB2c;
  serie: PontoSerieTurma[];
  engajamento: EngajamentoAluno[];
  temas: TemaTurmaMentor[];
  detalhamento: DetalhamentoMentor;
}
let PROTO: Dados;
beforeAll(async () => {
  // Fixtures = dados do protótipo B2C (fonte mock), sem latência.
  const { dados } = criarMock('b2c', { latenciaMs: 0 });
  PROTO = {
    turma: (await dados.turma()).data,
    desempenho: (await dados.desempenhoTurma(null)).data,
    serie: (await dados.serieTurma(null)).data,
    engajamento: (await dados.engajamentoTurma(8)).data,
    temas: (await dados.temasTurma(null)).data,
    detalhamento: (await dados.detalhamento(['mock-sim-5'])).data,
  };
});

const refetch = vi.fn();
const mutateAsync = vi.fn();
function res<T>(data: T | undefined, extra: Record<string, unknown> = {}) {
  return { data, meta: undefined, isLoading: false, isError: false, isPlaceholderData: false, isFetching: false, refetch, error: null, ...extra };
}
type H = ReturnType<typeof vi.fn>;
function mockar(d: Partial<Dados> = {}, estados: Partial<Record<keyof Dados, Record<string, unknown>>> = {}) {
  const x = { ...PROTO, ...d };
  (useTurmaAcademy as unknown as H).mockReturnValue(res(x.turma, estados.turma));
  (useDesempenhoTurma as unknown as H).mockReturnValue(res(x.desempenho, estados.desempenho));
  (useSerieTurma as unknown as H).mockReturnValue(res(x.serie, estados.serie));
  (useEngajamentoTurma as unknown as H).mockReturnValue(res(x.engajamento, estados.engajamento));
  (useTemasTurma as unknown as H).mockReturnValue(res(x.temas, estados.temas));
  (useDetalhamento as unknown as H).mockImplementation((s: string[]) => res(s.length ? x.detalhamento : undefined, estados.detalhamento));
  (useRegistrarEvento as unknown as H).mockReturnValue({ mutateAsync, isPending: false });
}

function Local() {
  const l = useLocation();
  return <output data-testid="url">{l.pathname + l.search}</output>;
}
function montar(path = '/mentor/turma') {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/mentor/*" element={<MinhaTurma />} /></Routes>
        <Local />
      </MemoryRouter>
    </TooltipProvider>,
  );
}
const url = () => screen.getByTestId('url').textContent ?? '';
const tabelaAlunos = () => screen.getByRole('table', { name: 'Alunos da turma' });
const linhaDe = (nome: string) => within(tabelaAlunos()).getByRole('button', { name: nome }).closest('[role="row"]') as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  mutateAsync.mockResolvedValue({ intervencaoId: 'c1', duplicado: false });
  mockar();
});

describe('Minha Turma · com simulados', () => {
  it('cabeçalho, KPIs com régua 1º · anterior · atual e link para o último simulado', () => {
    montar();
    expect(screen.getByRole('heading', { level: 1, name: 'Minha Turma' })).toBeVisible();
    const detalhar = screen.getByRole('link', { name: /Detalhar 5º Simulado PRO/ });
    expect(detalhar).toHaveAttribute('href', '/mentor/detalhamento?s=mock-sim-4%2Cmock-sim-5');
    const aprov = within(screen.getByTestId('kpi-possivel-aprovacao'));
    expect(aprov.getByTestId('kpi-valor')).toHaveTextContent('34%');
    expect(aprov.getByTestId('kpi-delta')).toHaveTextContent('+6 vs anterior');
    expect(within(aprov.getByTestId('kpi-regua')).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['1º19%', 'Anterior28%', 'Atual34%']);
    expect(within(screen.getByTestId('kpi-acerto-medio')).getByTestId('kpi-valor')).toHaveTextContent('79%');
    expect(within(screen.getByTestId('kpi-acerto-medio')).getByTestId('kpi-rodape')).toHaveTextContent('média dos 9 participantes');
    const part = within(screen.getByTestId('kpi-participacao'));
    expect(part.getByTestId('kpi-valor')).toHaveTextContent('9');
    expect(part.getByTestId('kpi-sufixo')).toHaveTextContent('/ 12');
    expect(part.getByTestId('kpi-rodape')).toHaveTextContent('3 não fizeram · fechou em 21/09');
    expect(within(screen.getByTestId('kpi-questoes-semana')).getByTestId('kpi-rodape')).toHaveTextContent('últimos 7 dias');
  });

  it('tabela sem semestre: Questões · acesso, meta, notas por simulado, vs corte e último acesso', () => {
    montar();
    const t = tabelaAlunos();
    const cab = within(t).getAllByRole('columnheader').map((c) => c.textContent);
    expect(cab).toEqual(expect.arrayContaining(['Aluno', 'Questões · acesso', 'Meta · corte mais difícil', '% de acerto por simulado', 'vs corte', 'Último acesso']));
    expect(cab.join(' ')).not.toMatch(/Semestre/);
    const bia = within(linhaDe('Beatriz Sampaio'));
    // Regra "constantemente acima" (todas as notas ≥ corte): 81 < 84 → Em variação.
    expect(bia.getByText('Em variação')).toBeVisible();
    expect(bia.getByText('260 em 30 dias')).toBeVisible();
    expect(bia.getByText('acesso até dez/26')).toBeVisible();
    expect(bia.getByText('USP-SP · 84%')).toBeVisible();
    expect(bia.getByText('81% · 84% · 85% · 85% ·')).toBeVisible();
    expect(bia.getByText('87%')).toBeVisible();
    expect(bia.getByText('+3 p.p.')).toBeVisible();
    expect(bia.getByText('hoje')).toBeVisible();
    const marina = within(linhaDe('Marina Albuquerque'));
    expect(marina.getByText('não fez')).toBeVisible();
    expect(marina.getByText('há 17 dias')).toHaveStyle({ fontWeight: '650' });
    expect(screen.getByText('Mostrando 12 de 12')).toBeVisible();
  });

  it('vindo de um alerta do Início: chip removível e lista filtrada', () => {
    montar('/mentor/turma?alerta=sumiram');
    expect(screen.getByText('Alerta: Sumiram · 3')).toBeVisible();
    expect(screen.getByText('vindo do Início')).toBeVisible();
    expect(within(tabelaAlunos()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Marina Albuquerque', 'João Siqueira', 'Renata Bastos Albuquerque de Melo']);
    expect(screen.getByText('Mostrando 3 de 3')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro de alerta' }));
    expect(screen.queryByText(/Alerta:/)).not.toBeInTheDocument();
    expect(url()).toBe('/mentor/turma');
    expect(screen.getByText('Mostrando 12 de 12')).toBeVisible();
  });

  it('segmentos com contagem, aria-pressed e estado na URL', () => {
    montar();
    const grupo = within(screen.getByRole('group', { name: 'Segmentos' }));
    expect(grupo.getByRole('button', { name: /Todos\s*12/ })).toHaveAttribute('aria-pressed', 'true');
    const abaixo = grupo.getByRole('button', { name: /Constantemente abaixo\s*5/ });
    fireEvent.click(abaixo);
    expect(abaixo).toHaveAttribute('aria-pressed', 'true');
    expect(url()).toBe('/mentor/turma?segmento=abaixo');
    expect(within(tabelaAlunos()).getAllByRole('button')).toHaveLength(5);
  });

  it('busca sem resultado mostra o vazio com Limpar filtros, que zera alerta, segmento e busca', () => {
    montar('/mentor/turma?alerta=regrediram&segmento=acima');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar aluno' }), { target: { value: 'zzz' } });
    expect(screen.getByText('Nenhum aluno neste recorte')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(url()).toBe('/mentor/turma');
    expect(screen.getByRole('searchbox', { name: 'Buscar aluno' })).toHaveValue('');
    expect(screen.getByText('Mostrando 12 de 12')).toBeVisible();
  });

  it('clique no aluno abre o drawer por ?aluno= e marca a linha, preservando os filtros', () => {
    montar('/mentor/turma?segmento=variacao');
    fireEvent.click(within(tabelaAlunos()).getByRole('button', { name: 'Beatriz Sampaio' }));
    expect(url()).toBe('/mentor/turma?segmento=variacao&aluno=beatriz.sampaio%40exemplo.com');
    expect(linhaDe('Beatriz Sampaio')).toHaveAttribute('aria-current', 'true');
  });

  it('matriz com segmented: Turma toda pelos temas; segmento recalcula com os e-mails do segmento', () => {
    montar();
    const bloco = within(screen.getByRole('region', { name: 'Onde a turma perde ponto' }));
    const abas = bloco.getAllByRole('tab');
    expect(abas.map((a) => a.textContent)).toEqual(['Turma toda', 'Acima do corte', 'Em variação', 'Abaixo']);
    expect(abas[0]).toHaveAttribute('aria-selected', 'true');
    expect(bloco.getByRole('rowheader', { name: 'Preventiva' })).toBeVisible();
    expect(bloco.getByText('78% ou mais')).toBeVisible();
    fireEvent.click(abas[1]);
    expect(abas[1]).toHaveAttribute('aria-selected', 'true');
    const ultima = vi.mocked(useDetalhamento).mock.calls.at(-1)!;
    expect(ultima[0]).toEqual(['mock-sim-1', 'mock-sim-2', 'mock-sim-3', 'mock-sim-4', 'mock-sim-5']);
    expect(ultima[1]).toEqual(['larissa.freitas@exemplo.com', 'taina.vasconcelos@exemplo.com']);
    fireEvent.keyDown(abas[1], { key: 'ArrowRight' });
    expect(abas[2]).toHaveAttribute('aria-selected', 'true');
    expect(abas[2]).toHaveFocus();
  });

  it('sem prevalência cadastrada: estado curto, sem números inventados, e o resto da tela segue', () => {
    mockar({ temas: PROTO.temas.map((t) => ({ ...t, prevalencia: null, peso: null })) });
    montar();
    expect(screen.getByText('Prevalência ainda não cadastrada')).toBeVisible();
    expect(screen.queryByText('78% ou mais')).not.toBeInTheDocument();
    expect(tabelaAlunos()).toBeVisible();
  });

  it('tema crítico: intervenção cria card coletivo e mostra toast role=status por 3,2 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      montar();
      const temas = within(screen.getByRole('table', { name: 'Temas críticos' }));
      fireEvent.click(temas.getByRole('button', { name: 'Expandir Vigilância em saúde' }));
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Criar intervenção' })); });
      expect(mutateAsync).toHaveBeenCalledWith({ tipo: 'intervencao_tema', temaId: 'vigilancia-em-saude', tema: 'Vigilância em saúde', acertoPct: 44, origem: 'tema_critico' });
      expect(screen.getByText('Intervenção criada em A fazer: Vigilância em saúde').closest('[role="status"]')).not.toBeNull();
      await act(async () => { vi.advanceTimersByTime(3300); });
      expect(screen.queryByText(/Intervenção criada em A fazer/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('erro da fonte ao criar intervenção vira toast com a mensagem de erros.ts', async () => {
    mutateAsync.mockRejectedValue(new ErroFonte(503, 'rede', 'x'));
    montar();
    fireEvent.click(within(screen.getByRole('table', { name: 'Temas críticos' })).getByRole('button', { name: 'Expandir Vigilância em saúde' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Criar intervenção' })); });
    expect(await screen.findByText('Não foi possível carregar agora. Tente novamente.')).toBeVisible();
  });

  it('null nunca vira zero: sem fonte de questões e sem nota mostram traço', () => {
    const [a] = PROTO.turma;
    mockar({
      turma: [{ ...a, temDadoQuestoes: false, questoes30d: { respondidas: null, acertos: null, erros: null, pctAcerto: null }, acessoAte: null, diasSemAtividade: null, segmento: 'sem_dado', meta: null }],
      desempenho: { ...PROTO.desempenho, alunos: [] },
    });
    montar();
    const linha = within(linhaDe('Beatriz Sampaio'));
    expect(linha.getByText('Sem dado')).toBeVisible();
    expect(linha.getByText('Aguardando Metas')).toBeVisible();
    expect(linha.getByText('acesso até —')).toBeVisible();
    expect(linha.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(linha.queryByText(/^0/)).not.toBeInTheDocument();
  });

  it('acessibilidade básica sem violações do axe', async () => {
    const { container } = montar();
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
});

describe('Minha Turma · V0 sem simulado', () => {
  beforeEach(() => {
    mockar({
      desempenho: { ...PROTO.desempenho, simulados: [], possivelAprovacaoPct: null, acertoMedioUltimo: null, participacaoUltimo: { simuladoId: null, fizeram: 0, total: 12 },
        alunos: PROTO.desempenho.alunos.map((x) => ({ ...x, notas: [], fezUltimo: null, regrediu: false, estagnado: false, vsCortePp: null, situacao: 'sem_simulado' as const })) },
      serie: [], temas: [],
    });
  });

  it('KPIs de engajamento, matriz e temas somem, sem botão de detalhar', () => {
    montar();
    expect(within(screen.getByTestId('kpi-possivel-aprovacao')).getByTestId('kpi-rodape')).toHaveTextContent('Precisa de simulados e de Metas (previsto para novembro).');
    expect(within(screen.getByTestId('kpi-possivel-aprovacao')).getByTestId('kpi-valor')).toHaveTextContent('—');
    const ativos = within(screen.getByTestId('kpi-ativos-semana'));
    expect(ativos.getByTestId('kpi-valor')).toHaveTextContent('9');
    expect(ativos.getByTestId('kpi-sufixo')).toHaveTextContent('/ 12');
    expect(ativos.getByTestId('kpi-rodape')).toHaveTextContent('último acesso = última atividade no Flix');
    const sem = within(screen.getByTestId('kpi-sem-acesso'));
    expect(sem.getByTestId('kpi-valor')).toHaveTextContent('3');
    expect(sem.getByTestId('kpi-rodape')).toHaveTextContent('Abra o segmento Sumidos abaixo.');
    expect(screen.queryByText('Onde a turma perde ponto')).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Temas críticos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Detalhar/ })).not.toBeInTheDocument();
  });

  it('segmentos de engajamento; Acima/Abaixo do corte desabilitados; Aguardando Metas e Sem dado', () => {
    montar();
    const grupo = within(screen.getByRole('group', { name: 'Segmentos' }));
    expect(grupo.getAllByRole('button').map((b) => b.textContent)).toEqual(['Todos12', 'Ativos · até 7 dias9', 'Esfriando · 8 a 140', 'Sumidos · 15+3', 'Acima do corte', 'Abaixo do corte']);
    expect(grupo.getByRole('button', { name: 'Acima do corte' })).toBeDisabled();
    expect(grupo.getByRole('button', { name: 'Abaixo do corte' })).toBeDisabled();
    const bia = within(linhaDe('Beatriz Sampaio'));
    expect(bia.getByText('Ativo')).toBeVisible();
    expect(bia.getByText('Aguardando Metas')).toBeVisible();
    expect(bia.getByText('corte entra com Metas')).toBeVisible();
    expect(bia.getByText('Sem dado')).toBeVisible();
    fireEvent.click(grupo.getByRole('button', { name: /Sumidos/ }));
    expect(url()).toBe('/mentor/turma?segmento=sumido');
    expect(within(tabelaAlunos()).getAllByRole('button')).toHaveLength(3);
  });
});

describe('Minha Turma · carregando e erro', () => {
  it('carregando: título visível e skeletons na anatomia dos blocos', () => {
    mockar({}, { turma: { data: undefined, isLoading: true }, desempenho: { data: undefined, isLoading: true } });
    (useTurmaAcademy as unknown as H).mockReturnValue(res(undefined, { isLoading: true }));
    (useDesempenhoTurma as unknown as H).mockReturnValue(res(undefined, { isLoading: true }));
    montar();
    expect(screen.getByRole('heading', { level: 1, name: 'Minha Turma' })).toBeVisible();
    expect(screen.getByRole('status', { name: 'Carregando alunos' })).toBeVisible();
    expect(screen.getByRole('status', { name: 'Carregando matriz' })).toBeVisible();
    expect(screen.queryByRole('table', { name: 'Alunos da turma' })).not.toBeInTheDocument();
  });

  it('erro: EstadoErro com Tentar novamente refaz só o que falhou', () => {
    (useTurmaAcademy as unknown as H).mockReturnValue(res(undefined, { isError: true, error: new ErroFonte(503, 'rede', 'x') }));
    montar();
    const alerta = within(screen.getByRole('region', { name: 'Alunos' })).getByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar os dados da turma.');
    fireEvent.click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalled();
  });
});
