import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  SaudacaoGestor,
  saudacaoPorHora,
  primeiroNome,
} from '@/features/gestor/components/SaudacaoGestor';
import { DirecionadoresGestor } from '@/features/gestor/components/DirecionadoresGestor';
import { visaoGeralQueryKey } from '@/features/gestor/api/prefetch';
import type { ContextoGestor, Envelope, Meta } from '@/features/gestor/api/types';

const mocks = vi.hoisted(() => ({
  useGestorContexto: vi.fn(),
  rpc: vi.fn(),
}));

/**
 * `prefetch.ts` reusa `chamarRpcGestor`/`GESTOR_STALE_TIME` de `api/queries.ts`
 * — substituir o módulo inteiro por só `useGestorContexto` quebraria esse
 * import. Preserva o resto do módulo real via `importActual`.
 */
vi.mock('@/features/gestor/api/queries', async () => {
  const real = await vi.importActual<typeof import('@/features/gestor/api/queries')>(
    '@/features/gestor/api/queries',
  );
  return { ...real, useGestorContexto: mocks.useGestorContexto };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: mocks.rpc },
}));

// O setup global mocka useNavigate/useLocation; aqui precisamos do módulo real.
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return actual;
});

const META: Meta = {
  periodo: '2026',
  fonte: 'users + ies',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'IES acessíveis pelo token',
  partial: false,
  lowSample: false,
};

const CONTEXTO: Envelope<ContextoGestor> = {
  data: {
    usuario: { id: 'user-1', nome: 'Marina Alves Ribeiro', papel: 'gestor' },
    iesDisponiveis: [{ id: 'ies-1', nome: 'Universidade do Estado do Amazonas' }],
    iesAtual: { id: 'ies-1', nome: 'Universidade do Estado do Amazonas' },
    contrato: {
      nome: 'Academy 2026',
      simuladosContratados: 7,
      vigencia: '01/01/2026 a 31/12/2026',
    },
    podeTrocarIes: false,
    podeExportar: true,
  },
  meta: META,
};

function SondaDeRota() {
  const location = useLocation();
  return <div data-testid="rota">{location.pathname}</div>;
}

function montar(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestor']}>
        <SondaDeRota />
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, queryClient };
}

beforeEach(() => {
  mocks.useGestorContexto.mockReturnValue({
    data: CONTEXTO.data,
    meta: CONTEXTO.meta,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  mocks.rpc.mockResolvedValue({
    data: { data: { kpis: {} }, meta: META },
    error: null,
  });
});

describe('saudacaoPorHora', () => {
  it('antes do meio-dia é Bom dia', () => {
    expect(saudacaoPorHora(new Date(2026, 6, 26, 9, 0))).toBe('Bom dia');
    expect(saudacaoPorHora(new Date(2026, 6, 26, 11, 59))).toBe('Bom dia');
  });

  it('entre 12h e 18h é Boa tarde', () => {
    expect(saudacaoPorHora(new Date(2026, 6, 26, 12, 0))).toBe('Boa tarde');
    expect(saudacaoPorHora(new Date(2026, 6, 26, 17, 59))).toBe('Boa tarde');
  });

  it('das 18h em diante é Boa noite', () => {
    expect(saudacaoPorHora(new Date(2026, 6, 26, 18, 0))).toBe('Boa noite');
    expect(saudacaoPorHora(new Date(2026, 6, 26, 23, 30))).toBe('Boa noite');
  });
});

describe('primeiroNome', () => {
  it('devolve só o primeiro nome', () => {
    expect(primeiroNome('Marina Alves Ribeiro')).toBe('Marina');
  });

  it('tolera espaços sobrando e nome único', () => {
    expect(primeiroNome('  Marina  ')).toBe('Marina');
  });
});

describe('SaudacaoGestor (spec §2.1)', () => {
  it('mostra o primeiro nome e a linha de contexto da IES', () => {
    montar(<SaudacaoGestor />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Marina$/);
    expect(screen.getByTestId('saudacao')).toHaveTextContent(
      'Universidade do Estado do Amazonas',
    );
    expect(screen.getByTestId('saudacao')).toHaveTextContent('Academy 2026');
  });

  it('sem contrato, mostra só o nome da IES', () => {
    mocks.useGestorContexto.mockReturnValue({
      data: { ...CONTEXTO.data, contrato: null },
      meta: CONTEXTO.meta,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    montar(<SaudacaoGestor />);

    expect(screen.getByTestId('saudacao')).toHaveTextContent(
      'Universidade do Estado do Amazonas',
    );
    expect(screen.getByTestId('saudacao')).not.toHaveTextContent('Academy 2026');
  });

  it('loading: skeleton no lugar do texto', () => {
    mocks.useGestorContexto.mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    montar(<SaudacaoGestor />);

    expect(screen.getByTestId('saudacao-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('saudacao')).not.toBeInTheDocument();
  });
});

describe('DirecionadoresGestor (spec §2.1)', () => {
  it('renderiza os dois cards com href correto', () => {
    montar(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />);

    expect(screen.getByTestId('direcionador-visao-geral')).toHaveAttribute(
      'href',
      '/gestor/visao-geral',
    );
    expect(screen.getByTestId('direcionador-detalhamento')).toHaveAttribute(
      'href',
      '/gestor/detalhamento',
    );
    expect(screen.getByText('Visão Geral')).toBeInTheDocument();
    expect(screen.getByText('Detalhamento por Simulados')).toBeInTheDocument();
  });

  it('o card da Visão Geral navega para /gestor/visao-geral', async () => {
    const user = userEvent.setup();
    montar(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />);

    await user.click(screen.getByTestId('direcionador-visao-geral'));
    expect(screen.getByTestId('rota')).toHaveTextContent('/gestor/visao-geral');
  });

  it('o card do Detalhamento navega para /gestor/detalhamento', async () => {
    const user = userEvent.setup();
    montar(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />);

    await user.click(screen.getByTestId('direcionador-detalhamento'));
    expect(screen.getByTestId('rota')).toHaveTextContent('/gestor/detalhamento');
  });

  it('hover no card da Visão Geral faz prefetch da query (§8.2)', async () => {
    const user = userEvent.setup();
    const { queryClient } = montar(
      <DirecionadoresGestor iesId="ies-1" semestre="6ano" />,
    );

    expect(queryClient.getQueryData(visaoGeralQueryKey('ies-1', '6ano'))).toBeUndefined();

    await user.hover(screen.getByTestId('direcionador-visao-geral'));

    await waitFor(() => {
      expect(queryClient.getQueryData(visaoGeralQueryKey('ies-1', '6ano'))).toBeDefined();
    });
    expect(mocks.rpc).toHaveBeenCalledWith('get_gestor_visao_geral', {
      p_ies_id: 'ies-1',
      p_semestre: '6ano',
    });
  });

  it('prefetch respeita o semestre em vigor', async () => {
    const user = userEvent.setup();
    const { queryClient } = montar(
      <DirecionadoresGestor iesId="ies-1" semestre="11" />,
    );

    await user.hover(screen.getByTestId('direcionador-visao-geral'));

    await waitFor(() => {
      expect(queryClient.getQueryData(visaoGeralQueryKey('ies-1', '11'))).toBeDefined();
    });
    expect(queryClient.getQueryData(visaoGeralQueryKey('ies-1', '6ano'))).toBeUndefined();
  });

  it('hover no card do Detalhamento não faz prefetch da Visão Geral', async () => {
    const user = userEvent.setup();
    montar(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />);

    await user.hover(screen.getByTestId('direcionador-detalhamento'));

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe('visaoGeralQueryKey', () => {
  it('é a tupla canônica ["gestor","visao-geral",iesId,semestre]', () => {
    expect(visaoGeralQueryKey('ies-1', '6ano')).toEqual([
      'gestor',
      'visao-geral',
      'ies-1',
      '6ano',
    ]);
  });
});
