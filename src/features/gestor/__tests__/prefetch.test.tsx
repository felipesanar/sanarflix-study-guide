import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { FiltrosGestor } from '@/features/gestor/api/types';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

import { useAluno, useAlunos, useDiagnostico } from '@/features/gestor/api/queries';
import { useVisaoGeral } from '@/features/gestor/api/queries';
import {
  alunoQueryKey,
  alunosQueryKey,
  diagnosticoQueryKey,
  prefetchAluno,
  prefetchDiagnosticoNivel,
  prefetchProximaPaginaAlunos,
  prefetchVisaoGeral,
  visaoGeralQueryKey,
} from '@/features/gestor/api/prefetch';

const META = {
  periodo: '2026.1',
  fonte: 'resultados_alunos_tri',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'proficiência >= 60',
  partial: false,
  lowSample: false,
};

const envelope = (data: unknown) => ({ data: { data, meta: META }, error: null });

const FILTROS: FiltrosGestor = { iesId: 'ies-1', semestre: '6ano', simulados: [] };

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={['/gestor?ies=ies-1']}>{children}</MemoryRouter>
  </QueryClientProvider>
);

/**
 * Achado 1 (revisão de 03/08): a queryKey do prefetch precisa bater EXATAMENTE
 * com a que `useVisaoGeral`/`useEnvelope` observa (card 107: `user.id` logo
 * após o namespace `'gestor'`) — senão o cache aquecido no hover nunca é lido
 * e a RPC mais cara do portal (`get_gestor_visao_geral`) roda duas vezes.
 */
describe('prefetchVisaoGeral / visaoGeralQueryKey (achado 1, revisão de 03/08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockRpc.mockResolvedValue(envelope({ kpis: [] }));
  });

  it('visaoGeralQueryKey inclui o userId logo após o namespace, igual ao useEnvelope (card 107)', () => {
    expect(visaoGeralQueryKey('u1', 'ies-1', '6ano')).toEqual([
      'gestor',
      'u1',
      'visao-geral',
      'ies-1',
      '6ano',
    ]);
  });

  it('a chave aquecida no prefetch é EXATAMENTE a que useVisaoGeral observa para o mesmo usuário/recorte', async () => {
    // Aquece o cache como o hover em DirecionadoresGestor faria.
    await prefetchVisaoGeral(queryClient, 'u1', FILTROS.iesId, FILTROS.semestre);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_gestor_visao_geral', {
      p_ies_id: 'ies-1',
      p_semestre: '6ano',
    });

    // Monta a Visão Geral com o MESMO queryClient, como a navegação faria.
    const { result } = renderHook(() => useVisaoGeral(FILTROS), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Cache hit: nenhuma segunda chamada à RPC mais cara do portal.
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ kpis: [] });

    // A chave observada pelo hook é a mesma que o prefetch calculou.
    const chaves = queryClient.getQueryCache().getAll().map((q) => q.queryKey);
    expect(chaves).toEqual([visaoGeralQueryKey('u1', 'ies-1', '6ano')]);
  });

  it('usuários diferentes não herdam a entrada aquecida um do outro (mesmo raciocínio do card 107)', async () => {
    await prefetchVisaoGeral(queryClient, 'u1', FILTROS.iesId, FILTROS.semestre);
    expect(mockRpc).toHaveBeenCalledTimes(1);

    mockUseAuth.mockReturnValue({ user: { id: 'u2' } });
    const { result } = renderHook(() => useVisaoGeral(FILTROS), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // u2 não é u1: cache miss esperado, segunda chamada à RPC.
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});

/**
 * Onda 1 (`docs/superpowers/plans/2026-08-09-gestor-motion-e-loading.md`):
 * as 3 funções de prefetch novas — mesmo raciocínio do achado 1 acima
 * (`prefetchVisaoGeral`): a queryKey aquecida no hover precisa bater EXATAMENTE
 * com a que o hook real observa, senão o prefetch aquece um cache que a
 * página nunca lê e a RPC roda de novo no clique.
 */
describe('prefetchAluno / alunoQueryKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockRpc.mockResolvedValue(envelope([{ simuladoId: 's1', simuladoNome: 'Simulado 1' }]));
  });

  it('alunoQueryKey inclui o userId logo após o namespace, com a lista de simulados ORDENADA', () => {
    expect(alunoQueryKey('u1', 'ies-1', 'aluno-1', ['b', 'a'])).toEqual([
      'gestor',
      'u1',
      'aluno',
      'ies-1',
      'aluno-1',
      ['a', 'b'],
    ]);
  });

  it('a chave aquecida é EXATAMENTE a que useAluno observa para o mesmo usuário/aluno/simulados', async () => {
    await prefetchAluno(queryClient, 'u1', 'ies-1', 'aluno-1', ['b', 'a']);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_gestor_aluno', {
      p_ies_id: 'ies-1',
      p_aluno_id: 'aluno-1',
      p_simulados: ['a', 'b'],
    });

    // Monta o drawer com o MESMO queryClient, como o clique faria — a ordem
    // de seleção na UI é invertida ('a','b') de propósito, para provar que a
    // ordenação (não a ordem literal do array) é o que decide o cache hit.
    const { result } = renderHook(() => useAluno('aluno-1', ['a', 'b']), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const chaves = queryClient.getQueryCache().getAll().map((q) => q.queryKey);
    expect(chaves).toEqual([alunoQueryKey('u1', 'ies-1', 'aluno-1', ['b', 'a'])]);
  });
});

describe('prefetchDiagnosticoNivel / diagnosticoQueryKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockRpc.mockResolvedValue(envelope([{ id: 'clinica-medica', nome: 'Clínica Médica' }]));
  });

  it('diagnosticoQueryKey inclui o userId logo após o namespace, igual ao useEnvelope', () => {
    expect(diagnosticoQueryKey('u1', 'ies-1', '6ano', 'grande-area-1')).toEqual([
      'gestor',
      'u1',
      'diagnostico',
      'ies-1',
      '6ano',
      'grande-area-1',
    ]);
  });

  it('a chave aquecida é EXATAMENTE a que useDiagnostico observa para o mesmo nó da cascata', async () => {
    await prefetchDiagnosticoNivel(queryClient, 'u1', 'ies-1', '6ano', 'grande-area-1');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_gestor_diagnostico', {
      p_ies_id: 'ies-1',
      p_semestre: '6ano',
      p_node: 'grande-area-1',
    });

    const { result } = renderHook(() => useDiagnostico(FILTROS, 'grande-area-1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const chaves = queryClient.getQueryCache().getAll().map((q) => q.queryKey);
    expect(chaves).toEqual([diagnosticoQueryKey('u1', 'ies-1', '6ano', 'grande-area-1')]);
  });
});

describe('prefetchProximaPaginaAlunos / alunosQueryKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockRpc.mockResolvedValue(envelope({ page: 2, pageSize: 20, total: 40, data: [] }));
  });

  it('alunosQueryKey inclui o userId logo após o namespace, com grupo ausente normalizado para null', () => {
    expect(alunosQueryKey('u1', 'ies-1', '6ano', 2, 20, 'nome', 'asc', 'joão', undefined)).toEqual([
      'gestor',
      'u1',
      'alunos',
      'ies-1',
      '6ano',
      2,
      20,
      'nome',
      'asc',
      'joão',
      null,
    ]);
  });

  it('a chave aquecida é EXATAMENTE a que useAlunos observa para a mesma página/ordenação/busca', async () => {
    await prefetchProximaPaginaAlunos(queryClient, 'u1', 'ies-1', '6ano', 2, 20, 'nome', 'asc', 'joão', null);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_gestor_alunos', {
      p_ies_id: 'ies-1',
      p_semestre: '6ano',
      p_page: 2,
      p_page_size: 20,
      p_sort: 'nome',
      p_order: 'asc',
      p_q: 'joão',
      p_grupo: null,
    });

    const paginacao = { page: 2, pageSize: 20, sort: 'nome', order: 'asc' as const, q: 'joão', grupo: null };
    const { result } = renderHook(() => useAlunos(FILTROS, paginacao), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const chaves = queryClient.getQueryCache().getAll().map((q) => q.queryKey);
    expect(chaves).toEqual([alunosQueryKey('u1', 'ies-1', '6ano', 2, 20, 'nome', 'asc', 'joão', null)]);
  });
});
