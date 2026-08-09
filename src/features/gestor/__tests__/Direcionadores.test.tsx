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
import { GESTOR_V2_NAV } from '@/features/gestor/shell/SidebarNav';
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
  it('mostra o primeiro nome e a frase de orientação com a IES em foco', () => {
    montar(<SaudacaoGestor />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Marina$/);
    expect(screen.getByTestId('saudacao')).toHaveTextContent(
      'Acompanhe a visão institucional da Universidade do Estado do Amazonas: o cronograma de simulados, os avisos da Sanar e os caminhos para analisar o desempenho das suas turmas.',
    );
  });

  /**
   * O subtítulo é ORIENTAÇÃO, não a ficha do contrato (spec §2.1: o Início
   * existe para orientar). Vigência e nº de simulados continuam ditos onde são
   * dado e não moldura — o rodapé de proveniência do cronograma. Sem isto, a
   * mesma informação aparecia em dois lugares da mesma tela, e o subtítulo
   * ainda arriscava atribuir o contrato da IES padrão à IES em foco (achados
   * 1, 3 e 4 da revisão de 03/08).
   */
  it('o subtítulo não repete o contrato — ele vive no rodapé do cronograma', () => {
    montar(<SaudacaoGestor />);

    expect(screen.getByTestId('saudacao')).not.toHaveTextContent('Academy 2026');
    expect(screen.getByTestId('saudacao')).not.toHaveTextContent('simulados contratados');
  });

  it('sem contrato no contexto, a frase de orientação é a mesma', () => {
    mocks.useGestorContexto.mockReturnValue({
      data: { ...CONTEXTO.data, contrato: null },
      meta: CONTEXTO.meta,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    montar(<SaudacaoGestor />);

    expect(screen.getByTestId('saudacao')).toHaveTextContent(
      'Acompanhe a visão institucional da Universidade do Estado do Amazonas:',
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

  /**
   * Título de tela da referência (§5): 26px/700, tracking -0.01em, 32px de
   * linha. `text-2xl`/`tracking-tight` do Tailwind davam 24px/600 com tracking
   * 2,5× mais apertado — a saudação ficava do mesmo peso visual dos títulos de
   * card logo abaixo, e a hierarquia da home sumia.
   */
  it('o título de tela tem a escala da referência, não a do Tailwind', () => {
    montar(<SaudacaoGestor />);

    const titulo = screen.getByRole('heading', { level: 1 });
    expect(titulo.style.fontSize).toBe('26px');
    expect(titulo.style.fontWeight).toBe('700');
    expect(titulo.style.letterSpacing).toBe('-0.01em');
    expect(titulo.style.lineHeight).toBe('32px');
    expect(titulo.className).not.toContain('tracking-tight');
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

    it('nunca afirma o contrato — que é o da IES padrão, não o da IES em foco', () => {
      montar(<SaudacaoGestor iesId="ies-2" />);

      expect(screen.getByTestId('saudacao')).not.toHaveTextContent('Academy 2026');
      expect(screen.getByTestId('saudacao')).not.toHaveTextContent('simulados contratados');
    });

    it('sem iesId (uso isolado, sem recorte), cai na IES padrão do usuário — comportamento inalterado', () => {
      montar(<SaudacaoGestor />);

      expect(screen.getByTestId('saudacao')).toHaveTextContent(
        'Universidade do Estado do Amazonas',
      );
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
    // Os títulos vêm da nav, não de literal aqui: o direcionador e o item da
    // sidebar apontam para a mesma tela e têm que dizer o mesmo nome. Este
    // teste afirmava "Detalhamento por simulados" com `s` minúsculo enquanto a
    // nav dizia `S` maiúsculo — a divergência que motivou a fonte única.
    for (const item of GESTOR_V2_NAV.filter((i) => i.url !== '/gestor')) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
    }
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
 * Anatomia do cartão de direcionamento (handoff §4.4): linha horizontal com
 * tile de ícone 48×48, texto e chevron. A implementação anterior era um cartão
 * vertical com ícone Lucide solto e um CTA "Abrir" que a referência não tem —
 * afordância duplicada, já que o cartão inteiro é o link.
 */
describe('DirecionadoresGestor — anatomia da referência (§4.4)', () => {
  it('não tem o rótulo "Abrir": o chevron é a afordância inteira', () => {
    montar(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />);

    expect(screen.queryByText('Abrir')).not.toBeInTheDocument();
    for (const testid of ['direcionador-visao-geral', 'direcionador-detalhamento']) {
      const cartao = screen.getByTestId(testid);
      expect(cartao.querySelector('.icon-dende-icons-chevron_right-outlined')).not.toBeNull();
    }
  });

  it('cada cartão abre com um tile de 48×48 e o glifo Dendê preenchido de 24px', () => {
    montar(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />);

    const visaoGeral = screen.getByTestId('direcionador-visao-geral');
    const tileVisaoGeral = visaoGeral.firstElementChild as HTMLElement;
    expect(tileVisaoGeral.style.width).toBe('48px');
    expect(tileVisaoGeral.style.height).toBe('48px');
    expect(tileVisaoGeral.style.borderRadius).toBe('var(--gp-radius-md)');
    // Primário: tile de marca. Secundário: neutro.
    expect(tileVisaoGeral.style.background).toBe('var(--gp-brand-surface)');
    expect(visaoGeral.querySelector('.icon-dende-icons-equalizer-filled')).not.toBeNull();

    const detalhamento = screen.getByTestId('direcionador-detalhamento');
    const tileDetalhamento = detalhamento.firstElementChild as HTMLElement;
    expect(tileDetalhamento.style.background).toBe('var(--gp-surface-3)');
    expect(detalhamento.querySelector('.icon-dende-icons-insights-filled')).not.toBeNull();
  });

  /**
   * A eyebrow "O que você quer ver?" é da SEÇÃO, não deste componente — quem
   * decide o que a seção mostra é a rota, que troca estes cartões por skeletons
   * enquanto a IES não resolve, e o rótulo tem que sobreviver a esse estado.
   *
   * Este caso existe invertido de propósito: por um tempo o rótulo viveu nos
   * DOIS lugares (dois lotes do passe de conformidade o acrescentaram em
   * paralelo) e a tela imprimia a frase duas vezes. Quem cobra a presença é
   * `Inicio.test.tsx`, via `overline-direcionadores`.
   */
  it('NÃO renderiza a eyebrow — ela pertence à seção, e duplicá-la já aconteceu', () => {
    montar(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />);
    expect(screen.getByTestId('direcionadores')).not.toHaveTextContent('O que você quer ver?');
  });

  /**
   * ATENÇÃO ao que este caso consegue e ao que NÃO consegue provar.
   *
   * Ele afirma a CLASSE, não o efeito — e a versão anterior dele passava
   * verde enquanto o cartão estava, em produção, com `box-shadow: none`. O
   * Tailwind resolvia `shadow-[var(--gp-shadow-card)]` como `--tw-shadow-color`
   * (a COR da sombra) em vez de `--tw-shadow`, então a sombra inteira ia parar
   * no slot errado e nada era pintado. jsdom não roda o Tailwind, então nenhum
   * teste desta suíte poderia ter pego: foi preciso medir `getComputedStyle` no
   * navegador real.
   *
   * A sintaxe de propriedade explícita não tem essa ambiguidade, e
   * `tema.test.tsx` passou a proibir as duas formas ambíguas em todo o portal.
   *
   * Duração/curva migraram de `[transition-duration:140ms]
   * [transition-timing-function:cubic-bezier(0.2,0,0,1)]` (achado da
   * auditoria de movimento de 09/08: valor hardcoded, não token) para
   * `style` lendo `--gp-motion-2`/`--gp-ease` — mesmo padrão de
   * `FiltroSemestre.tsx`. Migrar para `duration-[var(--gp-motion-2))]`/
   * `ease-[var(--gp-ease)]` no Tailwind arbitrário reintroduziria a MESMA
   * ambiguidade que este teste existe para proibir: `tema.test.tsx` reprova
   * qualquer `ease-[` no código do portal.
   */
  it('o cartão declara sombra em repouso e a duração/curva por token, em sintaxe não-ambígua', () => {
    montar(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />);
    const cartao = screen.getByTestId('direcionador-visao-geral');
    expect(cartao.className).toContain('[box-shadow:var(--gp-shadow-card)]');
    expect(cartao.style.transitionDuration).toBe('var(--gp-motion-2)');
    expect(cartao.style.transitionTimingFunction).toBe('var(--gp-ease)');
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
