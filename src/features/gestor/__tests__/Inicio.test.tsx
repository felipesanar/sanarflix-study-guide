import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Inicio from '@/features/gestor/routes/Inicio';
import type { Aviso, ContextoGestor, ItemCronograma, Meta } from '@/features/gestor/api/types';

const mocks = vi.hoisted(() => ({
  useGestorContexto: vi.fn(),
  useCronograma: vi.fn(),
  useAvisos: vi.fn(),
  useFiltrosGestor: vi.fn(),
  useMarcarAvisoLido: vi.fn(),
  prefetchVisaoGeral: vi.fn(),
}));

vi.mock('@/features/gestor/api/queries', () => ({
  useGestorContexto: mocks.useGestorContexto,
  useCronograma: mocks.useCronograma,
  useAvisos: mocks.useAvisos,
}));

vi.mock('@/features/gestor/hooks/useFiltrosGestor', () => ({
  useFiltrosGestor: mocks.useFiltrosGestor,
}));

vi.mock('@/features/gestor/hooks/useMarcarAvisoLido', () => ({
  useMarcarAvisoLido: mocks.useMarcarAvisoLido,
  avisosQueryKey: (iesId: string) => ['gestor', 'avisos', iesId],
}));

vi.mock('@/features/gestor/api/prefetch', () => ({
  prefetchVisaoGeral: mocks.prefetchVisaoGeral,
  visaoGeralQueryKey: (iesId: string, semestre: string) => [
    'gestor',
    'visao-geral',
    iesId,
    semestre,
  ],
}));

const META: Meta = {
  periodo: '2026',
  fonte: 'gvqv',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'Contrato vigente',
  partial: false,
  lowSample: false,
};

const CONTEXTO: ContextoGestor = {
  usuario: { id: 'user-1', nome: 'Marina Alves', papel: 'gestor' },
  iesDisponiveis: [{ id: 'ies-1', nome: 'UEA' }],
  iesAtual: { id: 'ies-1', nome: 'UEA' },
  contrato: {
    nome: 'Academy 2026',
    simuladosContratados: 7,
    vigencia: '01/01/2026 a 31/12/2026',
  },
  podeTrocarIes: false,
  podeExportar: true,
};

const ITENS: ItemCronograma[] = [
  { id: 's1', nome: 'Simulado 1', data: '2026-03-10T12:00:00Z', status: 'realizado', modalidade: 'online', participantes: 88 },
  { id: 's4', nome: 'Simulado 4', data: '2026-08-18T12:00:00Z', status: 'reagendado', modalidade: 'presencial', participantes: null },
  { id: 's5', nome: 'Simulado 5', data: null, status: 'previsto', modalidade: null, participantes: null },
];

const AVISOS: Aviso[] = [
  { id: 'a1', titulo: 'Manutencao programada', resumo: 'Janela no sabado.', data: '2026-07-20T12:00:00Z', lido: false },
];

const pronto = (data: unknown, meta: unknown = META) => ({
  isLoading: false,
  isError: false,
  data,
  meta,
  refetch: vi.fn(),
});

const carregando = () => ({
  isLoading: true,
  isError: false,
  data: undefined,
  meta: undefined,
  refetch: vi.fn(),
});

const comErro = () => ({
  isLoading: false,
  isError: true,
  data: undefined,
  meta: undefined,
  refetch: vi.fn(),
});

function montar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestor']}>
        <Inicio />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.useFiltrosGestor.mockReturnValue({
    semestre: '6ano',
    setSemestre: vi.fn(),
    simulados: [],
    setSimulados: vi.fn(),
    iesId: null,
    setIesId: vi.fn(),
  });
  mocks.useMarcarAvisoLido.mockReturnValue({ mutate: vi.fn() });
  mocks.useGestorContexto.mockReturnValue(pronto(CONTEXTO));
  mocks.useCronograma.mockReturnValue(pronto(ITENS));
  mocks.useAvisos.mockReturnValue(pronto(AVISOS));
});

describe('Inicio — composição (spec §2.1)', () => {
  it('monta saudação, direcionadores, cronograma e avisos', () => {
    montar();

    expect(screen.getByTestId('saudacao')).toBeInTheDocument();
    expect(screen.getByTestId('direcionadores')).toBeInTheDocument();
    expect(screen.getByTestId('cronograma')).toBeInTheDocument();
    expect(screen.getByTestId('avisos')).toBeInTheDocument();
  });

  it('passa a IES do contexto adiante quando a URL não tem ies', () => {
    montar();
    expect(mocks.useCronograma).toHaveBeenCalledWith('ies-1');
    expect(mocks.useAvisos).toHaveBeenCalledWith('ies-1');
  });

  it('a IES da URL vence como hint de UI', () => {
    mocks.useFiltrosGestor.mockReturnValue({
      semestre: '6ano',
      setSemestre: vi.fn(),
      simulados: [],
      setSimulados: vi.fn(),
      iesId: 'ies-9',
      setIesId: vi.fn(),
    });
    montar();
    expect(mocks.useCronograma).toHaveBeenCalledWith('ies-9');
  });
});

describe('Inicio — estados (spec §8.4)', () => {
  it('loading: skeleton das duas colunas, sem cronograma nem avisos', () => {
    mocks.useGestorContexto.mockReturnValue(carregando());
    montar();

    expect(screen.getByTestId('inicio-skeleton-cronograma')).toBeInTheDocument();
    expect(screen.getByTestId('inicio-skeleton-avisos')).toBeInTheDocument();
    expect(screen.queryByTestId('cronograma')).not.toBeInTheDocument();
    expect(screen.queryByTestId('avisos')).not.toBeInTheDocument();
    expect(screen.getByTestId('saudacao-skeleton')).toBeInTheDocument();
  });

  it('empty: nenhum simulado contratado, e os avisos continuam de pé', () => {
    mocks.useCronograma.mockReturnValue(pronto([]));
    montar();

    expect(screen.getByText(/nenhum simulado contratado/i)).toBeInTheDocument();
    expect(screen.getByTestId('avisos')).toBeInTheDocument();
    expect(screen.getByText('Manutencao programada')).toBeInTheDocument();
  });

  it('error por bloco: cronograma quebrado não derruba os avisos', () => {
    mocks.useCronograma.mockReturnValue(comErro());
    montar();

    expect(screen.getByText(/não foi possível carregar o cronograma/i)).toBeInTheDocument();
    expect(screen.getByTestId('avisos')).toBeInTheDocument();
    expect(screen.getByTestId('direcionadores')).toBeInTheDocument();
  });

  it('error por bloco: avisos quebrados não derrubam o cronograma', () => {
    mocks.useAvisos.mockReturnValue(comErro());
    montar();

    expect(screen.getByText(/não foi possível carregar os avisos/i)).toBeInTheDocument();
    expect(screen.getByTestId('cronograma')).toBeInTheDocument();
    expect(screen.getByTestId('cronograma-item-s1')).toBeInTheDocument();
  });
});

describe('Inicio — nenhum indicador de desempenho na tela (spec §2.1)', () => {
  const PROIBIDOS: RegExp[] = [
    /%/,
    /proficiênc/i,
    /proficienc/i,
    /\bTRI\b/,
    /ENAMED/i,
    /acerto/i,
    /conceito/i,
    /desempenho/i,
    /\bmédia\b/i,
    /\bnota\b/i,
  ];

  it('a tela inteira não contém nenhum vocabulário de desempenho', () => {
    montar();
    const texto = screen.getByTestId('gestor-inicio').textContent ?? '';

    for (const proibido of PROIBIDOS) {
      expect(
        texto,
        `a tela de Início não pode conter ${proibido} — o propósito é orientar, não medir`,
      ).not.toMatch(proibido);
    }
  });

  it('vale também no estado vazio do cronograma', () => {
    mocks.useCronograma.mockReturnValue(pronto([]));
    montar();
    const texto = screen.getByTestId('gestor-inicio').textContent ?? '';

    for (const proibido of PROIBIDOS) {
      expect(texto).not.toMatch(proibido);
    }
  });
});
