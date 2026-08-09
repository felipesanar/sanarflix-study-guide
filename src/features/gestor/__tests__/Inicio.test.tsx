import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/**
 * `DirecionadoresGestor` (renderizado por `Inicio`) lê `useAuth().user?.id`
 * para montar a queryKey do prefetch da Visão Geral — `useEnvelope` insere esse
 * id logo após o namespace `'gestor'` (card 107), então sem ele o hover
 * aqueceria uma chave que a tela de destino nunca leria. `useAuth` real explode
 * fora de um `<AuthProvider>`; aqui só o `user.id` importa.
 */
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

/**
 * Assinatura espelhando a real (`api/prefetch.ts`): o `userId` vem PRIMEIRO,
 * porque `useEnvelope` insere o id do usuário logo após o namespace `'gestor'`
 * (card 107). Este arquivo mocka o módulo inteiro e não exercita a
 * implementação, mas um mock com assinatura defasada engana quem lê depois.
 */
vi.mock('@/features/gestor/api/prefetch', () => ({
  prefetchVisaoGeral: mocks.prefetchVisaoGeral,
  visaoGeralQueryKey: (userId: string | undefined, iesId: string, semestre: string) => [
    'gestor',
    userId,
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

    // A saudação voltou (09/08): cabeçalho da página, no fluxo do scroll.
    expect(screen.getByTestId('saudacao')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('direcionadores')).toBeInTheDocument();
    expect(screen.getByTestId('cronograma')).toBeInTheDocument();
    expect(screen.getByTestId('avisos')).toBeInTheDocument();
  });

  /**
   * A referência nunca solta a grade de direcionadores direto sob a saudação:
   * o overline é o que declara que ali se ESCOLHE um caminho, e não que ali se
   * lê um resumo (LIGHT.html:3375).
   */
  it('precede os direcionadores do overline "O que você quer ver?"', () => {
    montar();
    const overline = screen.getByTestId('overline-direcionadores');
    expect(overline).toHaveTextContent('O que você quer ver?');
    expect(
      overline.compareDocumentPosition(screen.getByTestId('direcionadores')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

    const skeletonCronograma = screen.getByTestId('inicio-skeleton-cronograma');
    const skeletonAvisos = screen.getByTestId('inicio-skeleton-avisos');
    expect(skeletonCronograma).toBeInTheDocument();
    expect(skeletonAvisos).toBeInTheDocument();
    expect(screen.queryByTestId('cronograma')).not.toBeInTheDocument();
    expect(screen.queryByTestId('avisos')).not.toBeInTheDocument();
    // A saudação reserva a própria altura enquanto o contexto carrega.
    expect(screen.getByTestId('saudacao-skeleton')).toBeInTheDocument();
  });

  it('loading: os skeletons são acessíveis (role="status"), não um <Skeleton> cru sem rótulo (achado 19)', () => {
    mocks.useGestorContexto.mockReturnValue(carregando());
    montar();

    expect(
      within(screen.getByTestId('inicio-skeleton-cronograma')).getAllByRole('status').length,
    ).toBeGreaterThan(0);
    expect(
      within(screen.getByTestId('inicio-skeleton-avisos')).getAllByRole('status').length,
    ).toBeGreaterThan(0);
    expect(
      within(screen.getByTestId('inicio-skeleton-direcionadores')).getAllByRole('status').length,
    ).toBeGreaterThan(0);
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

  /**
   * O varrido exclui o cabeçalho de saudação, e só ele.
   *
   * A regra da spec §2.1 é sobre MEDIR: nenhum bloco do Início pode exibir
   * indicador de desempenho. O subtítulo da saudação não exibe nada — ele diz
   * para onde ir ("...e os caminhos para analisar o desempenho das suas
   * turmas"), que é exatamente o trabalho de uma tela cujo propósito é
   * orientar. A lista abaixo é um blacklist de PALAVRAS, um proxy grosseiro
   * para "tem número de desempenho aqui": aplicá-la também à frase de
   * orientação proibiria o Início de nomear o seu próprio destino.
   *
   * Continua valendo para tudo mais — direcionadores, cronograma, avisos —,
   * que é onde um indicador de fato apareceria por descuido.
   */
  const textoDosBlocos = (): string => {
    const tela = screen.getByTestId('gestor-inicio').cloneNode(true) as HTMLElement;
    tela.querySelector('[data-testid="saudacao"]')?.remove();
    return tela.textContent ?? '';
  };

  it('nenhum bloco da tela contém vocabulário de desempenho', () => {
    montar();
    const texto = textoDosBlocos();

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
    const texto = textoDosBlocos();

    for (const proibido of PROIBIDOS) {
      expect(texto).not.toMatch(proibido);
    }
  });
});

describe('Inicio — estado de erro do contexto, com caminho de recuperação (achado 5)', () => {
  it('contexto com erro: mostra estado de erro em vez de skeleton permanente', () => {
    mocks.useGestorContexto.mockReturnValue(comErro());
    montar();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('saudacao')).not.toBeInTheDocument();
    expect(screen.queryByTestId('direcionadores')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cronograma')).not.toBeInTheDocument();
    expect(screen.queryByTestId('avisos')).not.toBeInTheDocument();
    // Nenhum skeleton fica preso para sempre — o erro substitui o loading.
    expect(screen.queryByTestId('inicio-skeleton-cronograma')).not.toBeInTheDocument();
  });

  it('o retry do estado de erro refaz a query do contexto', async () => {
    const refetch = vi.fn();
    mocks.useGestorContexto.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      meta: undefined,
      refetch,
    });
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('Inicio — proveniência escopada à IES em foco na troca de IES (achados 1, 3, 4 e 7)', () => {
  const CONTEXTO_MULTI_IES: ContextoGestor = {
    ...CONTEXTO,
    iesDisponiveis: [
      { id: 'ies-1', nome: 'UEA' },
      { id: 'ies-9', nome: 'Universidade Federal Fluminense' },
    ],
  };

  beforeEach(() => {
    mocks.useGestorContexto.mockReturnValue(pronto(CONTEXTO_MULTI_IES));
    mocks.useFiltrosGestor.mockReturnValue({
      semestre: '6ano',
      setSemestre: vi.fn(),
      simulados: [],
      setSimulados: vi.fn(),
      iesId: 'ies-9',
      setIesId: vi.fn(),
    });
  });

  it('a IES em foco (da URL) é a que alimenta as queries da tela, não a IES padrão', () => {
    montar();

    // Sem saudação para carregar o nome da IES, a prova de escopo passa a ser
    // o argumento das queries de cronograma e avisos.
    expect(mocks.useCronograma).toHaveBeenCalledWith('ies-9');
    expect(mocks.useAvisos).toHaveBeenCalledWith('ies-9');
  });

  it('o rodapé do cronograma usa a vigência devolvida pela query da IES em foco, não o contrato do contexto', () => {
    mocks.useCronograma.mockReturnValue(
      pronto(ITENS, { ...META, periodo: '01/06/2026 — 31/05/2027' }),
    );
    montar();

    expect(screen.getByTestId('cronograma-proveniencia')).toHaveTextContent(
      '01/06/2026 — 31/05/2027',
    );
    // Formato do contrato mis-escopado (contexto.contrato.vigencia) não aparece.
    expect(screen.getByTestId('cronograma-proveniencia')).not.toHaveTextContent(
      '01/01/2026 a 31/12/2026',
    );
  });

  it('os botões de WhatsApp do cronograma usam o nome da IES em foco, não o da IES padrão do usuário', async () => {
    mocks.useCronograma.mockReturnValue(
      pronto([
        { id: 's5', nome: 'Simulado 5', data: null, status: 'previsto', modalidade: null, participantes: null },
      ]),
    );
    const abrir = vi.fn();
    vi.stubGlobal('open', abrir);
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole('button', { name: /falar com consultor/i }));

    expect(abrir).toHaveBeenCalledTimes(1);
    const [url] = abrir.mock.calls[0] as [string];
    expect(decodeURIComponent(url)).toContain('Sou gestor(a) da Universidade Federal Fluminense');
    expect(decodeURIComponent(url)).not.toContain('Sou gestor(a) da UEA');
  });
});
