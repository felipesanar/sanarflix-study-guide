import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  /**
   * `DirecionadoresGestor` lê `useAuth().user?.id` para montar a queryKey do
   * prefetch — `useEnvelope` insere esse id logo após o namespace `'gestor'`
   * (card 107), então a chave aquecida no hover só casa com a que a Visão Geral
   * observa se o id entrar nela. O valor é o MESMO `usuario.id` do contexto
   * abaixo, como em produção.
   */
  userId: 'user-1',
}));

/** `useAuth` real explode fora de um `<AuthProvider>`; aqui só o `user.id` importa. */
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: mocks.userId } }),
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

  it('loading: skeleton acessível (role="status") no lugar do texto (achado 19)', () => {
    mocks.useGestorContexto.mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    montar(<SaudacaoGestor />);

    const skeleton = screen.getByTestId('saudacao-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(screen.queryByTestId('saudacao')).not.toBeInTheDocument();
    expect(within(skeleton).getAllByRole('status').length).toBeGreaterThan(0);
  });

  describe('IES em foco divergente da IES padrão do usuário (achados 1, 3, 4 e 7)', () => {
    const CONTEXTO_MULTI_IES = {
      ...CONTEXTO.data,
      iesDisponiveis: [
        { id: 'ies-1', nome: 'Universidade do Estado do Amazonas' },
        { id: 'ies-2', nome: 'Universidade Federal Fluminense' },
      ],
    };

    beforeEach(() => {
      mocks.useGestorContexto.mockReturnValue({
        data: CONTEXTO_MULTI_IES,
        meta: CONTEXTO.meta,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
    });

    it('usa o nome da IES em foco (prop iesId), não o da IES padrão do usuário', () => {
      montar(<SaudacaoGestor iesId="ies-2" />);

      expect(screen.getByTestId('saudacao')).toHaveTextContent(
        'Universidade Federal Fluminense',
      );
      expect(screen.getByTestId('saudacao')).not.toHaveTextContent(
        'Universidade do Estado do Amazonas',
      );
    });

    it('omite o contrato quando ele pertence à IES padrão do usuário, não à IES em foco', () => {
      montar(<SaudacaoGestor iesId="ies-2" />);

      expect(screen.getByTestId('saudacao')).not.toHaveTextContent('Academy 2026');
      expect(screen.getByTestId('saudacao')).not.toHaveTextContent('simulados contratados');
    });

    it('sem iesId (uso isolado, sem recorte), cai na IES padrão do usuário — comportamento inalterado', () => {
      montar(<SaudacaoGestor />);

      expect(screen.getByTestId('saudacao')).toHaveTextContent(
        'Universidade do Estado do Amazonas',
      );
      expect(screen.getByTestId('saudacao')).toHaveTextContent('Academy 2026');
    });

    it('quando iesId aponta para a própria IES padrão, o contrato continua aparecendo', () => {
      montar(<SaudacaoGestor iesId="ies-1" />);

      expect(screen.getByTestId('saudacao')).toHaveTextContent('Academy 2026');
    });
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

    expect(
      queryClient.getQueryData(visaoGeralQueryKey(mocks.userId, 'ies-1', '6ano')),
    ).toBeUndefined();

    await user.hover(screen.getByTestId('direcionador-visao-geral'));

    await waitFor(() => {
      expect(
        queryClient.getQueryData(visaoGeralQueryKey(mocks.userId, 'ies-1', '6ano')),
      ).toBeDefined();
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
      expect(
        queryClient.getQueryData(visaoGeralQueryKey(mocks.userId, 'ies-1', '11')),
      ).toBeDefined();
    });
    expect(
      queryClient.getQueryData(visaoGeralQueryKey(mocks.userId, 'ies-1', '6ano')),
    ).toBeUndefined();
  });

  it('hover no card do Detalhamento não faz prefetch da Visão Geral', async () => {
    const user = userEvent.setup();
    montar(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />);

    await user.hover(screen.getByTestId('direcionador-detalhamento'));

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

/**
 * Achados 6 e 16 da revisão de 03/08: os direcionadores navegavam sem a
 * query string, então o recorte global (IES + semestre) morria ao clicar e
 * a chave aquecida no hover (props) divergia da chave que a tela de destino
 * pediria (URL). A correção preserva a `search` vigente nos dois `<Link>`.
 */
describe('DirecionadoresGestor preserva a query string ao navegar (achados 6 e 16)', () => {
  function montarComSearch(ui: React.ReactNode, entrada: string) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const utils = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[entrada]}>
          <SondaDeRota />
          {ui}
        </MemoryRouter>
      </QueryClientProvider>,
    );
    return { ...utils, queryClient };
  }

  it('o card da Visão Geral carrega a query string vigente no href', () => {
    montarComSearch(
      <DirecionadoresGestor iesId="ies-1" semestre="3" />,
      '/gestor?ies=ies-1&semestre=3',
    );

    expect(screen.getByTestId('direcionador-visao-geral')).toHaveAttribute(
      'href',
      '/gestor/visao-geral?ies=ies-1&semestre=3',
    );
  });

  it('o card do Detalhamento carrega a query string vigente no href', () => {
    montarComSearch(
      <DirecionadoresGestor iesId="ies-1" semestre="3" />,
      '/gestor?ies=ies-1&semestre=3',
    );

    expect(screen.getByTestId('direcionador-detalhamento')).toHaveAttribute(
      'href',
      '/gestor/detalhamento?ies=ies-1&semestre=3',
    );
  });

  it('sem query string na URL de origem, o href não ganha "?" pendurado', () => {
    montarComSearch(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />, '/gestor');

    expect(screen.getByTestId('direcionador-visao-geral')).toHaveAttribute(
      'href',
      '/gestor/visao-geral',
    );
    expect(screen.getByTestId('direcionador-detalhamento')).toHaveAttribute(
      'href',
      '/gestor/detalhamento',
    );
  });

  it('o clique na Visão Geral navega mantendo a query string', async () => {
    const user = userEvent.setup();
    montarComSearch(
      <DirecionadoresGestor iesId="ies-1" semestre="3" />,
      '/gestor?ies=ies-1&semestre=3',
    );

    await user.click(screen.getByTestId('direcionador-visao-geral'));

    expect(screen.getByTestId('rota')).toHaveTextContent('/gestor/visao-geral');
    expect(window.location.search).toBe('');
  });

  it('a chave aquecida no hover casa com a chave que a Visão Geral pediria para a mesma URL', async () => {
    const user = userEvent.setup();
    const { queryClient } = montarComSearch(
      <DirecionadoresGestor iesId="ies-2" semestre="5" />,
      '/gestor?ies=ies-2&semestre=5',
    );

    await user.hover(screen.getByTestId('direcionador-visao-geral'));

    await waitFor(() => {
      expect(
        queryClient.getQueryData(visaoGeralQueryKey(mocks.userId, 'ies-2', '5')),
      ).toBeDefined();
    });
    expect(mocks.rpc).toHaveBeenCalledWith('get_gestor_visao_geral', {
      p_ies_id: 'ies-2',
      p_semestre: '5',
    });
  });
});

describe('visaoGeralQueryKey', () => {
  it('é a tupla canônica ["gestor",userId,"visao-geral",iesId,semestre]', () => {
    expect(visaoGeralQueryKey('user-1', 'ies-1', '6ano')).toEqual([
      'gestor',
      'user-1',
      'visao-geral',
      'ies-1',
      '6ano',
    ]);
  });

  /**
   * As asserções de hover acima passam pelo próprio `visaoGeralQueryKey`, então
   * não provariam nada se `DirecionadoresGestor` deixasse de repassar o
   * `user.id` (a chave errada seria consultada com o mesmo erro). Aqui a chave
   * é lida CRUA do cache, sem o helper: é o que pega o componente passando
   * `(queryClient, iesId, semestre)` na assinatura antiga de 3 argumentos, que
   * deslocava tudo e mandava `p_semestre: undefined` para a RPC.
   */
  it('o hover grava no cache a chave com o user.id na posição 1, não uma chave deslocada', async () => {
    const user = userEvent.setup();
    const { queryClient } = montar(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />);

    await user.hover(screen.getByTestId('direcionador-visao-geral'));

    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(1));
    expect(queryClient.getQueryCache().getAll()[0].queryKey).toEqual([
      'gestor',
      'user-1',
      'visao-geral',
      'ies-1',
      '6ano',
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith('get_gestor_visao_geral', {
      p_ies_id: 'ies-1',
      p_semestre: '6ano',
    });
  });
});
