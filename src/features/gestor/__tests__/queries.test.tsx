import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { FiltrosGestor, PaginacaoGestor } from '@/features/gestor/api/types';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import {
  useGestorContexto,
  useCronograma,
  useAvisos,
  useVisaoGeral,
  useDiagnostico,
  useDiagnosticoTemas,
  useAlunos,
  useAluno,
  useDetalhamento,
  useQuestoes,
} from '@/features/gestor/api/queries';

const META = {
  periodo: '2026.1',
  fonte: 'resultados_alunos_tri',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'proficiência >= 60',
  partial: false,
  lowSample: false,
};

const envelope = (data: unknown) => ({ data: { data, meta: META }, error: null });

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={['/gestor?ies=ies-1']}>{children}</MemoryRouter>
  </QueryClientProvider>
);

const FILTROS: FiltrosGestor = { iesId: 'ies-1', semestre: '6ano', simulados: [] };
const PAGINACAO: PaginacaoGestor = { page: 1, pageSize: 25, sort: 'nome', order: 'asc', q: 'ana' };

const chaves = () => queryClient.getQueryCache().getAll().map((q) => q.queryKey);

describe('queries do gestor (spec §5.2, §8.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('desembrulha o envelope: data e meta separados', async () => {
    mockRpc.mockResolvedValue(envelope({ usuario: { id: 'u1', nome: 'Ana', papel: 'gestor' } }));
    const { result } = renderHook(() => useGestorContexto(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ usuario: { id: 'u1', nome: 'Ana', papel: 'gestor' } });
    expect(result.current.meta?.criterio).toBe('proficiência >= 60');
    expect(mockRpc).toHaveBeenCalledWith('get_gestor_contexto', undefined);
    expect(chaves()).toEqual([['gestor', 'contexto']]);
  });

  it('cada hook chama a sua RPC com os parâmetros p_* e a queryKey canônica', async () => {
    mockRpc.mockResolvedValue(envelope([]));

    const casos: Array<[() => unknown, string, unknown, unknown[]]> = [
      [() => useCronograma('ies-1'), 'get_gestor_cronograma', { p_ies_id: 'ies-1' }, ['gestor', 'cronograma', 'ies-1']],
      [() => useAvisos('ies-1'), 'get_gestor_avisos', { p_ies_id: 'ies-1' }, ['gestor', 'avisos', 'ies-1']],
      [
        () => useVisaoGeral(FILTROS),
        'get_gestor_visao_geral',
        { p_ies_id: 'ies-1', p_semestre: '6ano' },
        ['gestor', 'visao-geral', 'ies-1', '6ano'],
      ],
      [
        () => useDiagnostico(FILTROS, 'cirurgia'),
        'get_gestor_diagnostico',
        { p_ies_id: 'ies-1', p_semestre: '6ano', p_node: 'cirurgia' },
        ['gestor', 'diagnostico', 'ies-1', '6ano', 'cirurgia'],
      ],
      [
        () => useDiagnosticoTemas(FILTROS, 'cardiologia'),
        'get_gestor_diagnostico_temas',
        { p_ies_id: 'ies-1', p_semestre: '6ano', p_especialidade: 'cardiologia' },
        ['gestor', 'diagnostico-temas', 'ies-1', '6ano', 'cardiologia'],
      ],
      [
        () => useAlunos(FILTROS, PAGINACAO),
        'get_gestor_alunos',
        {
          p_ies_id: 'ies-1', p_semestre: '6ano', p_page: 1, p_page_size: 25,
          p_sort: 'nome', p_order: 'asc', p_q: 'ana',
        },
        ['gestor', 'alunos', 'ies-1', '6ano', 1, 25, 'nome', 'asc', 'ana'],
      ],
      [
        () => useDetalhamento({ ...FILTROS, simulados: ['s2', 's1'] }),
        'get_gestor_detalhamento',
        { p_ies_id: 'ies-1', p_semestre: '6ano', p_simulados: ['s1', 's2'] },
        ['gestor', 'detalhamento', 'ies-1', '6ano', ['s1', 's2']],
      ],
      [
        () => useQuestoes({ ...FILTROS, simulados: ['s1'] }, { page: 2, pageSize: 10, sort: 'numero', area: 'clinica' }),
        'get_gestor_questoes',
        {
          p_ies_id: 'ies-1', p_simulado_id: 's1', p_page: 2, p_page_size: 10,
          p_sort: 'numero', p_area: 'clinica',
        },
        ['gestor', 'questoes', 'ies-1', 's1', 2, 10, 'numero', 'clinica'],
      ],
      [
        () => useAluno('aluno-7', ['s2', 's1']),
        'get_gestor_aluno',
        { p_ies_id: 'ies-1', p_aluno_id: 'aluno-7', p_simulados: ['s1', 's2'] },
        ['gestor', 'aluno', 'ies-1', 'aluno-7', ['s1', 's2']],
      ],
    ];

    for (const [hook, fn, args, chave] of casos) {
      mockRpc.mockClear();
      queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { result } = renderHook(hook as () => { isLoading: boolean }, { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockRpc, `RPC de ${fn}`).toHaveBeenCalledWith(fn, args);
      expect(chaves(), `queryKey de ${fn}`).toEqual([chave]);
    }
  });

  it('detalhamento com 0 simulados NÃO faz requisição (caso de teste 4 da spec §12)', async () => {
    mockRpc.mockResolvedValue(envelope({}));
    const { result } = renderHook(() => useDetalhamento({ ...FILTROS, simulados: [] }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('questões só com EXATAMENTE 1 simulado (spec §4.7)', async () => {
    mockRpc.mockResolvedValue(envelope({ data: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }));
    const { result } = renderHook(
      () => useQuestoes({ ...FILTROS, simulados: ['s1', 's2'] }, { page: 1, pageSize: 10 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('sem IES em foco, nenhum hook de IES dispara', async () => {
    mockRpc.mockResolvedValue(envelope([]));
    const { result } = renderHook(() => useCronograma(null), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('propaga erro da RPC (ex.: feature_not_enabled) como isError', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'feature_not_enabled' } });
    const { result } = renderHook(() => useVisaoGeral(FILTROS), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('mantém o dado anterior na troca de filtro (placeholderData, React Query v5)', async () => {
    mockRpc.mockResolvedValue(envelope({ kpis: 'primeiro' }));
    const { result, rerender } = renderHook(
      ({ semestre }: { semestre: FiltrosGestor['semestre'] }) =>
        useVisaoGeral({ ...FILTROS, semestre }),
      { wrapper, initialProps: { semestre: '6ano' as const } },
    );
    await waitFor(() => expect(result.current.data).toEqual({ kpis: 'primeiro' }));

    let liberar: (v: unknown) => void = () => undefined;
    mockRpc.mockReturnValue(new Promise((resolve) => { liberar = resolve; }));
    rerender({ semestre: 'geral' as never });

    // Durante o fetch do novo recorte, a tela continua com o dado anterior.
    expect(result.current.data).toEqual({ kpis: 'primeiro' });
    liberar(envelope({ kpis: 'segundo' }));
    await waitFor(() => expect(result.current.data).toEqual({ kpis: 'segundo' }));
  });
});
