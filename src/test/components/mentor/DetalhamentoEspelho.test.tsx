import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  AreaDesempenho,
  Detalhamento as DetalhamentoDados,
  DesempenhoTurma,
} from '@/services/mentor/desempenho';
import { NIVEL_CRITICO_MAX, NIVEL_EXCELENTE_MIN, nivelDesempenho } from '@/features/gestor/lib/regras';

const fetchDesempenhoTurma = vi.fn();
const fetchDetalhamento = vi.fn();
vi.mock('@/services/mentor/desempenho', async () => ({
  ...(await vi.importActual<typeof import('@/services/mentor/desempenho')>('@/services/mentor/desempenho')),
  fetchDesempenhoTurma: (s?: string[]) => fetchDesempenhoTurma(s),
  fetchDetalhamento: (s: string[]) => fetchDetalhamento(s),
  fetchQuestao: () => Promise.reject(new Error('indisponível neste teste')),
  fetchAlunoNotas: vi.fn(),
}));
vi.mock('@/services/mentor/turma', () => ({ fetchTurma: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import Detalhamento from '@/features/mentor/routes/Detalhamento';
import { AcertoPorArea } from '@/features/mentor/components/detalhamento/AcertoPorArea';
import { SeletorSimuladosMentor } from '@/features/mentor/components/SeletorSimuladosMentor';
import { ROTULO_NIVEL } from '@/features/mentor/components/detalhamento/util';
import { simuladoB2C } from './fixtures';

const T = { timeout: 3000 };
const LIBERA = '2026-10-20T12:30:00Z'; // 09:30 em São Paulo
const DICA = 'Resultado liberado em 20/10 às 09:30';

const DETALHE_VAZIO: DetalhamentoDados = { areas: [], questoes: [] };
const DETALHE_OK: DetalhamentoDados = {
  areas: [{ grande_area: 'Pediatria', acerto_pct: 81, respostas: 30, temas: [{ tema: 'Vacinas', acerto_pct: 81, respostas: 30 }] }],
  questoes: [
    {
      questao_id: 'q1',
      numero: 1,
      sequence_number: 2,
      grande_area: 'Pediatria',
      tema: 'Vacinas',
      correta_label: 'A',
      acerto_pct: 81,
      respostas: 30,
      distribuicao: { A: 24, B: 6 },
      emails: {},
    },
  ],
};

const turma = (simulados: DesempenhoTurma['simulados']): DesempenhoTurma => ({
  alunos: [],
  simulados,
  possivel_aprovacao_pct: null,
  acerto_medio_ultimo: null,
  participacao_ultimo: { simulado_id: null, fizeram: 0, total: 0 },
});

function renderPagina() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/mentor/detalhamento']}>
        <Detalhamento />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Detalhamento: simulados bloqueados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefere o simulado liberado mais recente: o bloqueado vira chip desabilitado com a data no tooltip', async () => {
    // s3 é o encerrado mais recente, mas o resultado ainda não foi liberado aos alunos.
    fetchDesempenhoTurma.mockResolvedValue(
      turma([simuladoB2C('s1', 1), simuladoB2C('s2', 2), simuladoB2C('s3', 3)]),
    );
    fetchDetalhamento.mockImplementation(async (ids: string[]) =>
      ids.includes('s3')
        ? { ...DETALHE_VAZIO, bloqueados: [{ simulado_id: 's3', sequence_number: 3, libera_em: LIBERA }] }
        : DETALHE_OK,
    );
    renderPagina();

    await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s2']), T);
    expect(await screen.findByText('Vacinas', undefined, T)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simulado 2' })).toHaveAttribute('aria-pressed', 'true');

    const chip = screen.getByRole('button', { name: 'Simulado 3' });
    expect(chip).toBeDisabled();
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('chip-bloqueado-3')).toHaveAttribute('title', DICA);
    // Selecionar o bloqueado não é possível, então não há aviso de "fora dos números".
    expect(screen.queryByTestId('nota-bloqueados')).toBeNull();
    fireEvent.click(chip);
    expect(fetchDetalhamento).not.toHaveBeenLastCalledWith(['s2', 's3']);
  });

  it('"Todos" não marca os bloqueados', async () => {
    fetchDesempenhoTurma.mockResolvedValue(
      turma([simuladoB2C('s1', 1), simuladoB2C('s2', 2), simuladoB2C('s3', 3)]),
    );
    fetchDetalhamento.mockImplementation(async (ids: string[]) =>
      ids.includes('s3')
        ? { ...DETALHE_VAZIO, bloqueados: [{ simulado_id: 's3', sequence_number: 3, libera_em: LIBERA }] }
        : DETALHE_OK,
    );
    renderPagina();
    await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s2']), T);
    await screen.findByText('Vacinas', undefined, T);
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s1', 's2']));
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('seleção que contém um bloqueado ainda não conhecido: mostra a nota e o dado do resto segue na tela', async () => {
    // s3 está aberto (aparece como chip normal); ao escolhê-lo o backend o devolve em `bloqueados`.
    fetchDesempenhoTurma.mockResolvedValue(
      turma([simuladoB2C('s1', 1), simuladoB2C('s2', 2), simuladoB2C('s3', 3, { encerrado: false })]),
    );
    fetchDetalhamento.mockImplementation(async (ids: string[]) => ({
      ...DETALHE_OK,
      bloqueados: ids.includes('s3') ? [{ simulado_id: 's3', sequence_number: 3, libera_em: LIBERA }] : [],
    }));
    renderPagina();
    await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s2']), T);
    await screen.findByText('Vacinas', undefined, T);
    expect(screen.queryByTestId('nota-bloqueados')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Simulado 3' }));
    await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s2', 's3']));
    const nota = await screen.findByTestId('nota-bloqueados', undefined, T);
    expect(nota).toHaveTextContent(/Simulado 3: resultado liberado em 20\/10 às 09:30/);
    expect(nota).toHaveTextContent(/não entra nos números/);
    expect(screen.getByTestId('chip-bloqueado-3')).toHaveAttribute('title', DICA);
    expect(screen.getByText('Vacinas')).toBeInTheDocument();
    // Um chip bloqueado já marcado pode ser desmarcado.
    const chip = screen.getByRole('button', { name: 'Simulado 3' });
    expect(chip).toBeEnabled();
    fireEvent.click(chip);
    await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s2']));
    await waitFor(() => expect(screen.queryByTestId('nota-bloqueados')).toBeNull());
  });

  it('sem libera_em o tooltip diz só que o resultado ainda não foi liberado', () => {
    render(
      <SeletorSimuladosMentor
        opcoes={[simuladoB2C('s1', 1), simuladoB2C('s2', 2)]}
        selecionados={['s1']}
        onChange={vi.fn()}
        exigirSelecao
        bloqueados={{ s2: { simulado_id: 's2', sequence_number: 2, libera_em: null } }}
      />,
    );
    expect(screen.getByTestId('chip-bloqueado-2')).toHaveAttribute('title', 'Resultado ainda não liberado');
  });

  it('todos os simulados bloqueados: explica em vez de mostrar vazio', async () => {
    fetchDesempenhoTurma.mockResolvedValue(turma([simuladoB2C('s1', 1)]));
    fetchDetalhamento.mockResolvedValue({
      ...DETALHE_VAZIO,
      bloqueados: [{ simulado_id: 's1', sequence_number: 1, libera_em: LIBERA }],
    });
    renderPagina();
    expect(await screen.findByText(/ainda não foi liberado aos alunos/, undefined, T)).toBeInTheDocument();
    expect(screen.queryByText(/Sem questões respondidas/)).toBeNull();
  });

  it('backend sem `bloqueados`: comportamento de sempre', async () => {
    fetchDesempenhoTurma.mockResolvedValue(turma([simuladoB2C('s1', 1), simuladoB2C('s2', 2)]));
    fetchDetalhamento.mockResolvedValue(DETALHE_OK);
    renderPagina();
    await screen.findByText('Vacinas', undefined, T);
    expect(fetchDetalhamento).toHaveBeenCalledTimes(1);
    expect(fetchDetalhamento).toHaveBeenCalledWith(['s2']);
    expect(screen.getByRole('button', { name: 'Simulado 1' })).toBeEnabled();
    expect(screen.queryByTestId('nota-bloqueados')).toBeNull();
  });
});

describe('Detalhar grande área (04b)', () => {
  const AREA: AreaDesempenho = {
    grande_area: 'Clínica Médica',
    acerto_pct: 58,
    respostas: 60,
    temas: [{ tema: 'Diabetes', acerto_pct: 44, respostas: 20 }],
    especialidades: [
      {
        especialidade: 'Endocrinologia',
        acerto_pct: NIVEL_CRITICO_MAX - 1,
        respostas: 20,
        temas: [{ tema: 'Diabetes', acerto_pct: 44, respostas: 20 }],
      },
      { especialidade: 'Cardiologia', acerto_pct: NIVEL_CRITICO_MAX, respostas: 30, temas: [{ tema: 'Hipertensão', acerto_pct: 51, respostas: 30 }] },
      { especialidade: 'Nefrologia', acerto_pct: NIVEL_EXCELENTE_MIN, respostas: 10, temas: [] },
      { especialidade: null, acerto_pct: 70, respostas: 5, temas: [{ tema: 'Outros', acerto_pct: 70, respostas: 5 }] },
    ],
  };

  const abrir = (area: AreaDesempenho) => {
    render(
      <MemoryRouter>
        <AcertoPorArea areas={[area]} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Detalhar/ }));
    return screen.findByRole('dialog');
  };

  const nivelDe = (linha: HTMLElement) => within(linha).getByTestId('nivel').textContent;

  it('o nível de cada especialidade vem da régua única do Gestor (rótulo = função do Gestor, sem mock)', async () => {
    const painel = await abrir(AREA);
    for (const e of AREA.especialidades ?? []) {
      const nome = e.especialidade ?? 'Geral';
      const esperado = ROTULO_NIVEL[nivelDesempenho(e.acerto_pct) as keyof typeof ROTULO_NIVEL];
      expect(nivelDe(within(painel).getByTestId(`especialidade-${nome}`))).toBe(esperado);
    }
    // Fronteiras da régua: 49 crítico, 50 mediano, 80 bom.
    expect(nivelDe(within(painel).getByTestId('especialidade-Endocrinologia'))).toBe('Crítico');
    expect(nivelDe(within(painel).getByTestId('especialidade-Cardiologia'))).toBe('Mediano');
    expect(nivelDe(within(painel).getByTestId('especialidade-Nefrologia'))).toBe('Bom');
  });

  it('mostra %, nº de respostas e usa "Geral" para especialidade nula', async () => {
    const painel = await abrir(AREA);
    const geral = within(painel).getByTestId('especialidade-Geral');
    expect(geral).toHaveTextContent('70%');
    expect(geral).toHaveTextContent('5 respostas');
    expect(within(painel).getByTestId('especialidade-Cardiologia')).toHaveTextContent('30 respostas');
    expect(within(painel).queryByText(/corte/i)).toBeNull();
  });

  it('"Ver temas" expande os temas e cada tema leva a Intervenções da turma com o título pré-preenchido', async () => {
    const painel = await abrir(AREA);
    const esp = within(painel).getByTestId('especialidade-Endocrinologia');
    expect(within(esp).queryByText('Diabetes')).toBeNull();
    const ver = within(esp).getByRole('button', { name: /Ver temas/ });
    expect(ver).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(ver);
    expect(ver).toHaveAttribute('aria-expanded', 'true');
    const tema = within(esp).getByTestId('tema-Diabetes');
    expect(tema).toHaveTextContent('44%');

    const link = within(tema).getByRole('link', { name: /Intervenção/ });
    const url = new URL(link.getAttribute('href') as string, 'http://x');
    expect(url.pathname).toBe('/mentor/intervencoes');
    expect(url.searchParams.get('novo')).toBe('1');
    expect(url.searchParams.get('alvo')).toBe('turma');
    expect(url.searchParams.get('titulo')).toBe('Tema: Diabetes (Clínica Médica)');
    expect(url.searchParams.has('alunos')).toBe(false);
  });

  it('especialidade sem temas não oferece "Ver temas"', async () => {
    const painel = await abrir(AREA);
    expect(within(within(painel).getByTestId('especialidade-Nefrologia')).queryByRole('button', { name: /Ver temas/ })).toBeNull();
  });

  it('sem `especialidades` cai na lista de temas de antes', async () => {
    const painel = await abrir({ ...AREA, especialidades: undefined });
    expect(within(painel).getByText('Diabetes')).toBeInTheDocument();
    expect(within(painel).getByText('44%')).toBeInTheDocument();
    expect(within(painel).getByText('20 respostas')).toBeInTheDocument();
    expect(within(painel).queryByRole('button', { name: /Ver temas/ })).toBeNull();
    expect(within(painel).queryByTestId('nivel')).toBeNull();
  });
});
