import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AvisosSanar, AVISOS_VISIVEIS } from '@/features/gestor/components/AvisosSanar';
import { avisosQueryKey } from '@/features/gestor/hooks/useMarcarAvisoLido';
import type { Aviso, Envelope, Meta } from '@/features/gestor/api/types';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  from: vi.fn(),
  useAuth: vi.fn(),
  avisosQueryFn: vi.fn(),
  toastError: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      mocks.from(tabela);
      return { insert: mocks.insert };
    },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.useAuth() }));

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => {
  const Logger = { error: mocks.loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
  return { Logger, default: Logger };
});

/**
 * useAvisos real (`useEnvelope` em api/queries.ts) usa `useQuery` de verdade,
 * com `placeholderData: (anterior) => anterior` e a queryKey
 * `['gestor', user?.id, 'avisos', iesId]` — o id do usuário logado entra
 * DEPOIS do namespace (ver comentário de `useEnvelope`). Este mock espelha
 * exatamente essa forma: por padrão `avisosQueryFn` lança (o cache já vem
 * semeado pelo teste, staleTime infinito, então a queryFn nunca deveria
 * rodar); os testes que precisam de um fetch "em voo" de verdade (achado 2)
 * sobrescrevem `avisosQueryFn` com uma implementação controlável.
 */
vi.mock('@/features/gestor/api/queries', async () => {
  const rq = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  return {
    useAvisos: (iesId: string) => {
      const auth = mocks.useAuth();
      const query = rq.useQuery<Envelope<Aviso[]>>({
        queryKey: avisosQueryKey(auth.user?.id, iesId),
        queryFn: mocks.avisosQueryFn,
        staleTime: Infinity,
        retry: false,
        placeholderData: (anterior: Envelope<Aviso[]> | undefined) => anterior,
      });
      return {
        data: query.data?.data,
        meta: query.data?.meta,
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: () => void query.refetch(),
      };
    },
  };
});

const META: Meta = {
  periodo: '2026',
  fonte: 'announcements',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'Avisos com publico_alvo contendo gestor',
  partial: false,
  lowSample: false,
};

const AVISOS: Aviso[] = [
  { id: 'a1', titulo: 'Manutencao programada', resumo: 'Janela de manutencao no sabado.', data: '2026-07-20T12:00:00Z', lido: false },
  { id: 'a2', titulo: 'Nova trilha disponivel', resumo: 'Trilha de revisao publicada.', data: '2026-07-18T12:00:00Z', lido: true },
  { id: 'a3', titulo: 'Atualizacao de contrato', resumo: 'Documento revisado no portal.', data: '2026-07-15T12:00:00Z', lido: true },
  { id: 'a4', titulo: 'Webinar para gestores', resumo: 'Inscricoes abertas.', data: '2026-07-10T12:00:00Z', lido: false },
];

const AVISOS_IES2: Aviso[] = [
  { id: 'b1', titulo: 'Aviso exclusivo da segunda IES', resumo: 'Resumo do b1.', data: '2026-07-22T12:00:00Z', lido: false },
];

const envelope = (avisos: Aviso[]): Envelope<Aviso[]> => ({ data: avisos, meta: META });

function novoQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function montar(avisos: Aviso[] = AVISOS) {
  const userId = mocks.useAuth().user?.id as string | undefined;
  const queryClient = novoQueryClient();
  queryClient.setQueryData(avisosQueryKey(userId, 'ies-1'), envelope(avisos));

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AvisosSanar iesId="ies-1" />
    </QueryClientProvider>,
  );

  return { ...utils, queryClient, userId };
}

beforeEach(() => {
  mocks.useAuth.mockReturnValue({ user: { id: 'user-1' }, logout: vi.fn() });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.avisosQueryFn.mockImplementation(() => {
    throw new Error('queryFn não deve ser chamada: o cache é semeado no teste');
  });
});

describe('AvisosSanar — lido e não-lido', () => {
  it('marca visualmente o não-lido com ponto de marca e o lido sem ponto', () => {
    montar();

    expect(screen.getByTestId('aviso-a1')).toHaveAttribute('data-lido', 'false');
    expect(screen.getByTestId('aviso-ponto-a1').style.opacity).toBe('1');

    expect(screen.getByTestId('aviso-a2')).toHaveAttribute('data-lido', 'true');
    // Spec §20: o ponto SEMPRE monta — o que muda entre lido/não-lido é a
    // visibilidade (opacidade/escala), nunca a desmontagem instantânea.
    expect(screen.getByTestId('aviso-ponto-a2')).toBeInTheDocument();
    expect(screen.getByTestId('aviso-ponto-a2').style.opacity).toBe('0');
  });

  it('expõe "não lido" textualmente, não só por cor (a11y)', () => {
    montar();
    expect(screen.getByTestId('aviso-a1')).toHaveTextContent('não lido');
    expect(screen.getByTestId('aviso-a2')).not.toHaveTextContent('não lido');
  });

  it('abrir revela o resumo do aviso', async () => {
    const user = userEvent.setup();
    montar();

    expect(screen.queryByText('Janela de manutencao no sabado.')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('aviso-a1'));
    expect(screen.getByText('Janela de manutencao no sabado.')).toBeInTheDocument();
  });
});

describe('AvisosSanar — marcar como lido (otimista)', () => {
  it('abrir um não-lido marca como lido na hora e grava em announcements_viewed', async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByTestId('aviso-a1'));

    await waitFor(() => {
      expect(screen.getByTestId('aviso-a1')).toHaveAttribute('data-lido', 'true');
    });
    // O ponto segue montado, só invisível (spec §20: fade de saída, não desmontagem).
    expect(screen.getByTestId('aviso-ponto-a1')).toBeInTheDocument();
    expect(screen.getByTestId('aviso-ponto-a1').style.opacity).toBe('0');

    expect(mocks.from).toHaveBeenCalledWith('announcements_viewed');
    expect(mocks.insert).toHaveBeenCalledWith({
      announcement_id: 'a1',
      user_id: 'user-1',
    });
  });

  it('abrir um já lido não grava nada', async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByTestId('aviso-a2'));

    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('rollback: falha na escrita devolve o aviso para não-lido', async () => {
    // Delay real (não fake timer): sem ele, o `onMutate` otimista e o
    // `onError` do rollback resolvem no mesmo microtask e o React nunca
    // pinta o estado intermediário — o `waitFor` de "otimista primeiro"
    // nunca observaria o `true`.
    mocks.insert.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ error: { message: 'rls_violation' } }), 20);
        }),
    );
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByTestId('aviso-a1'));

    // otimista primeiro
    await waitFor(() => {
      expect(screen.getByTestId('aviso-a1')).toHaveAttribute('data-lido', 'true');
    });
    // e depois volta
    await waitFor(() => {
      expect(screen.getByTestId('aviso-a1')).toHaveAttribute('data-lido', 'false');
    });
    expect(screen.getByTestId('aviso-ponto-a1')).toBeInTheDocument();
  });

  it('rollback também acontece quando não há sessão', async () => {
    mocks.useAuth.mockReturnValue({ user: null, logout: vi.fn() });
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByTestId('aviso-a1'));

    await waitFor(() => {
      expect(screen.getByTestId('aviso-a1')).toHaveAttribute('data-lido', 'false');
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe('AvisosSanar — achados da revisão de 04/08 (frente 3)', () => {
  it('achado 2: trocar de IES com o fetch novo em voo não congela nos avisos da IES anterior', async () => {
    let resolverIes2: ((valor: Envelope<Aviso[]>) => void) | undefined;
    mocks.avisosQueryFn.mockImplementation(({ queryKey }: { queryKey: readonly unknown[] }) => {
      const iesDoFetch = queryKey[queryKey.length - 1];
      if (iesDoFetch === 'ies-2') {
        return new Promise<Envelope<Aviso[]>>((resolve) => {
          resolverIes2 = resolve;
        });
      }
      throw new Error('queryFn não deveria rodar para outra IES neste teste');
    });

    const userId = mocks.useAuth().user?.id as string | undefined;
    const queryClient = novoQueryClient();
    queryClient.setQueryData(avisosQueryKey(userId, 'ies-1'), envelope(AVISOS));

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AvisosSanar iesId="ies-1" />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('aviso-a1')).toBeInTheDocument();

    // Troca de IES: a query de ies-2 nunca foi buscada e fica em voo;
    // `placeholderData` (igual ao `useEnvelope` real) segue mostrando os
    // avisos da IES anterior enquanto isso — sem spinner.
    rerender(
      <QueryClientProvider client={queryClient}>
        <AvisosSanar iesId="ies-2" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('aviso-a1')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId('aviso-a1'));

    // O fetch da IES nova finalmente resolve — se o `onMutate` tiver
    // cancelado esse fetch (bug), esta resolução não tem mais efeito e o
    // teste trava mostrando pra sempre os avisos da IES antiga.
    resolverIes2?.(envelope(AVISOS_IES2));

    await waitFor(() => {
      expect(screen.getByTestId('aviso-b1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('aviso-a1')).not.toBeInTheDocument();
  });

  it('achado 12: rollback de uma mutação não desfaz o otimismo de outra em voo', async () => {
    mocks.insert.mockImplementation((payload: { announcement_id: string }) => {
      if (payload.announcement_id === 'a1') {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ error: { message: 'rls_violation' } }), 40);
        });
      }
      return new Promise((resolve) => {
        setTimeout(() => resolve({ error: null }), 10);
      });
    });

    const user = userEvent.setup();
    montar();
    // a4 é o 4º aviso — só aparece depois de expandir a lista.
    await user.click(screen.getByRole('button', { name: 'Ver todos' }));

    await user.click(screen.getByTestId('aviso-a1'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    await user.click(screen.getByTestId('aviso-a4'));

    // a4 grava com sucesso primeiro
    await waitFor(() => {
      expect(screen.getByTestId('aviso-a4')).toHaveAttribute('data-lido', 'true');
    });

    // a1 falha depois — mas isso não pode desfazer o sucesso de a4
    await waitFor(() => {
      expect(screen.getByTestId('aviso-a1')).toHaveAttribute('data-lido', 'false');
    });
    expect(screen.getByTestId('aviso-a4')).toHaveAttribute('data-lido', 'true');
  });

  it('achado 13: falha na escrita avisa com toast e loga o erro', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'rls_violation' } });
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByTestId('aviso-a1'));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalled();
    });
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it('achado 14: marcar como lido propaga para o cache de outras IES do mesmo usuário', async () => {
    const userId = mocks.useAuth().user?.id as string | undefined;
    const queryClient = novoQueryClient();
    queryClient.setQueryData(avisosQueryKey(userId, 'ies-1'), envelope(AVISOS));
    // Mesmo aviso "a1" (visibilidade "todas") também cacheado, ainda não
    // lido, na segunda IES deste mesmo gestor de grupo.
    queryClient.setQueryData(avisosQueryKey(userId, 'ies-2'), envelope(AVISOS));

    render(
      <QueryClientProvider client={queryClient}>
        <AvisosSanar iesId="ies-1" />
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId('aviso-a1'));

    await waitFor(() => {
      expect(screen.getByTestId('aviso-a1')).toHaveAttribute('data-lido', 'true');
    });

    const cacheIes2 = queryClient.getQueryData<Envelope<Aviso[]>>(
      avisosQueryKey(userId, 'ies-2'),
    );
    expect(cacheIes2?.data.find((aviso) => aviso.id === 'a1')?.lido).toBe(true);
  });
});

describe('AvisosSanar — limite de 3 + Ver todos', () => {
  it('mostra no máximo 3 avisos', () => {
    montar();
    expect(AVISOS_VISIVEIS).toBe(3);
    expect(screen.getAllByTestId(/^aviso-a\d$/)).toHaveLength(3);
    expect(screen.queryByTestId('aviso-a4')).not.toBeInTheDocument();
  });

  it('Ver todos expande e Ver menos recolhe', async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole('button', { name: 'Ver todos' }));
    expect(screen.getAllByTestId(/^aviso-a\d$/)).toHaveLength(4);
    expect(screen.getByTestId('aviso-a4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver menos' }));
    expect(screen.getAllByTestId(/^aviso-a\d$/)).toHaveLength(3);
  });

  it('não oferece Ver todos com 3 avisos ou menos', () => {
    montar(AVISOS.slice(0, 3));
    expect(screen.queryByRole('button', { name: 'Ver todos' })).not.toBeInTheDocument();
  });
});

/** Anatomia da referência (handoff §10.13). */
describe('AvisosSanar — anatomia da referência (§10.13)', () => {
  it('o não-lido ganha fundo e borda de marca por token, nunca cor crua', () => {
    montar();
    const naoLido = screen.getByTestId('aviso-a1');
    expect(naoLido.style.background).toBe('var(--gp-brand-surface)');
    expect(naoLido.style.borderColor).toBe('var(--gp-brand-border)');
    expect(naoLido.style.borderRadius).toBe('var(--gp-radius-sm)');

    // O lido não é destacado: fica na superfície do card.
    expect(screen.getByTestId('aviso-a2').style.background).toBe('');
  });

  it('o ponto do não-lido é 7px de marca', () => {
    montar();
    const ponto = screen.getByTestId('aviso-ponto-a1');
    expect(ponto.style.width).toBe('7px');
    expect(ponto.style.background).toBe('var(--gp-brand)');
  });

  /**
   * "Cada card mantém a altura final — sem salto de layout ao carregar"
   * (docs/04-componentes.md). O skeleton já reservava; vazio e erro não, então
   * a coluna encolhia quando a query falhava DEPOIS do skeleton.
   */
  it('vazio e erro reservam a mesma altura que o skeleton — a coluna não encolhe ao trocar de estado', async () => {
    const { unmount } = montar([]);
    const vazio = screen.getByText('Nenhum aviso da Sanar por aqui.').closest('div');
    expect(vazio?.style.minHeight).toBe('288px');
    unmount();

    // Erro: mesma altura. `avisosQueryFn` rejeita e o cache fica sem semear.
    mocks.avisosQueryFn.mockRejectedValue(new Error('boom'));
    const queryClient = novoQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AvisosSanar iesId="ies-1" />
      </QueryClientProvider>,
    );

    const erro = await screen.findByRole('alert');
    expect(erro.style.minHeight).toBe('288px');
  });

  it('o chevron de expansão vira expand_less quando o aviso abre', async () => {
    const user = userEvent.setup();
    montar();

    const aviso = screen.getByTestId('aviso-a2');
    expect(aviso.querySelector('.icon-dende-icons-expand_more-outlined')).not.toBeNull();

    await user.click(aviso);
    expect(aviso.querySelector('.icon-dende-icons-expand_less-outlined')).not.toBeNull();
  });
});
