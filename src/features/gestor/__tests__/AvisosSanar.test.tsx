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

/**
 * useAvisos real leria a RPC. Aqui ele é um useQuery na queryKey canônica com
 * staleTime infinito: o teste semeia o cache e o hook devolve o dado semeado
 * sem chamar queryFn. Assim o update otimista da mutation aparece na UI de
 * verdade, em vez de ser observado só no cache.
 */
vi.mock('@/features/gestor/api/queries', async () => {
  const rq = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  return {
    useAvisos: (iesId: string) => {
      const query = rq.useQuery<Envelope<Aviso[]>>({
        queryKey: ['gestor', 'avisos', iesId],
        queryFn: () => {
          throw new Error('queryFn não deve ser chamada: o cache é semeado no teste');
        },
        staleTime: Infinity,
        retry: false,
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

const envelope = (avisos: Aviso[]): Envelope<Aviso[]> => ({ data: avisos, meta: META });

function montar(avisos: Aviso[] = AVISOS) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(avisosQueryKey('ies-1'), envelope(avisos));

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AvisosSanar iesId="ies-1" />
    </QueryClientProvider>,
  );

  return { ...utils, queryClient };
}

beforeEach(() => {
  mocks.useAuth.mockReturnValue({ user: { id: 'user-1' }, logout: vi.fn() });
  mocks.insert.mockResolvedValue({ error: null });
});

describe('AvisosSanar — lido e não-lido', () => {
  it('marca visualmente o não-lido com ponto de marca e o lido sem ponto', () => {
    montar();

    expect(screen.getByTestId('aviso-a1')).toHaveAttribute('data-lido', 'false');
    expect(screen.getByTestId('aviso-ponto-a1')).toBeInTheDocument();

    expect(screen.getByTestId('aviso-a2')).toHaveAttribute('data-lido', 'true');
    expect(screen.queryByTestId('aviso-ponto-a2')).not.toBeInTheDocument();
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
    expect(screen.queryByTestId('aviso-ponto-a1')).not.toBeInTheDocument();

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
