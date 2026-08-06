import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { AlunoSimuladoEntry, FiltrosGestor, PaginacaoGestor } from '@/features/gestor/api/types';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

// Espiona as opções passadas a `useQuery` sem perder o comportamento real
// (QueryClient/QueryClientProvider continuam vindos do módulo de verdade) —
// usado para verificar a config de refetch do card 110 sem depender de timers.
const useQuerySpy = vi.fn();
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const real = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...real,
    useQuery: (options: Parameters<typeof real.useQuery>[0]) => {
      useQuerySpy(options);
      return real.useQuery(options);
    },
  };
});

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
  GESTOR_STALE_TIME,
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
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('desembrulha o envelope: data e meta separados', async () => {
    mockRpc.mockResolvedValue(envelope({ usuario: { id: 'u1', nome: 'Ana', papel: 'gestor' } }));
    const { result } = renderHook(() => useGestorContexto(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ usuario: { id: 'u1', nome: 'Ana', papel: 'gestor' } });
    expect(result.current.meta?.criterio).toBe('proficiência >= 60');
    expect(mockRpc).toHaveBeenCalledWith('get_gestor_contexto', undefined);
    // A queryKey leva o id do usuário (card 107) — namespace 'gestor', depois o id.
    expect(chaves()).toEqual([['gestor', 'u1', 'contexto']]);
  });

  it('cada hook chama a sua RPC com os parâmetros p_* e a queryKey canônica', async () => {
    mockRpc.mockResolvedValue(envelope([]));

    // A queryKey leva o id do usuário logo após o namespace 'gestor' (card 107).
    const casos: Array<[() => unknown, string, unknown, unknown[]]> = [
      [() => useCronograma('ies-1'), 'get_gestor_cronograma', { p_ies_id: 'ies-1' }, ['gestor', 'u1', 'cronograma', 'ies-1']],
      [() => useAvisos('ies-1'), 'get_gestor_avisos', { p_ies_id: 'ies-1' }, ['gestor', 'u1', 'avisos', 'ies-1']],
      [
        () => useVisaoGeral(FILTROS),
        'get_gestor_visao_geral',
        { p_ies_id: 'ies-1', p_semestre: '6ano' },
        ['gestor', 'u1', 'visao-geral', 'ies-1', '6ano'],
      ],
      [
        () => useDiagnostico(FILTROS, 'cirurgia'),
        'get_gestor_diagnostico',
        { p_ies_id: 'ies-1', p_semestre: '6ano', p_node: 'cirurgia' },
        ['gestor', 'u1', 'diagnostico', 'ies-1', '6ano', 'cirurgia'],
      ],
      [
        () => useDiagnosticoTemas(FILTROS, 'cardiologia', 'clinica-medica'),
        'get_gestor_diagnostico_temas',
        {
          p_ies_id: 'ies-1', p_semestre: '6ano',
          p_especialidade: 'cardiologia', p_grande_area: 'clinica-medica',
        },
        ['gestor', 'u1', 'diagnostico-temas', 'ies-1', '6ano', 'cardiologia', 'clinica-medica'],
      ],
      [
        () => useAlunos(FILTROS, PAGINACAO),
        'get_gestor_alunos',
        {
          p_ies_id: 'ies-1', p_semestre: '6ano', p_page: 1, p_page_size: 25,
          p_sort: 'nome', p_order: 'asc', p_q: 'ana',
        },
        ['gestor', 'u1', 'alunos', 'ies-1', '6ano', 1, 25, 'nome', 'asc', 'ana'],
      ],
      [
        () => useDetalhamento({ ...FILTROS, simulados: ['s2', 's1'] }),
        'get_gestor_detalhamento',
        { p_ies_id: 'ies-1', p_semestre: '6ano', p_simulados: ['s1', 's2'] },
        ['gestor', 'u1', 'detalhamento', 'ies-1', '6ano', ['s1', 's2']],
      ],
      [
        /* `sort` recebe o valor REAL do controle (`ordem_da_prova`), não o
           vocabulário da RPC. Antes este caso passava `'numero'` — um valor que
           a UI nunca produz — e por isso não percebeu que o hook mandava o
           rótulo cru para uma RPC que só aceita ('numero','acerto'). A chave de
           cache guarda o valor da UI; só `p_sort` é traduzido. */
        () => useQuestoes({ ...FILTROS, simulados: ['s1'] }, { page: 2, pageSize: 10, sort: 'ordem_da_prova', area: 'clinica' }),
        'get_gestor_questoes',
        {
          p_ies_id: 'ies-1', p_simulado_id: 's1', p_page: 2, p_page_size: 10,
          p_sort: 'numero', p_area: 'clinica',
        },
        ['gestor', 'u1', 'questoes', 'ies-1', 's1', 2, 10, 'ordem_da_prova', 'clinica'],
      ],
      [
        () => useAluno('aluno-7', ['s2', 's1']),
        'get_gestor_aluno',
        { p_ies_id: 'ies-1', p_aluno_id: 'aluno-7', p_simulados: ['s1', 's2'] },
        ['gestor', 'u1', 'aluno', 'ies-1', 'aluno-7', ['s1', 's2']],
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

  it('useDiagnosticoTemas sempre envia p_grande_area — nunca omite a chave (achado 11, card 115)', async () => {
    // Sem p_grande_area, q.especialidade não é único entre grandes áreas e o
    // SQL soma temas de duas especialidades homônimas em áreas diferentes
    // (20260804132000_get_gestor_diagnostico_temas_escopo_grande_area.sql).
    // O parâmetro é ADITIVO com DEFAULT NULL no servidor hoje, mas outro
    // agente pode torná-lo obrigatório — o front sempre envia a chave, com o
    // valor vindo do nó pai que originou o clique, nunca omitida.
    mockRpc.mockResolvedValue(envelope([]));
    const { result } = renderHook(
      () => useDiagnosticoTemas(FILTROS, 'cardiologia', 'clinica-medica'),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const args = mockRpc.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(args)).toContain('p_grande_area');
    expect(args.p_grande_area).toBe('clinica-medica');
  });

  it('useDiagnosticoTemas: mesma especialidade em grandes áreas diferentes NÃO compartilha cache (card 115)', async () => {
    // `grandeArea` faz parte do recorte e precisa estar na queryKey — do
    // contrário, o nó "cardiologia" de "clínica médica" e o nó homônimo
    // "cardiologia" de "cirurgia" (nomenclatura de especialidade não é única
    // entre grandes áreas) compartilhariam a mesma entrada de cache.
    mockRpc.mockResolvedValue(envelope([]));
    renderHook(() => useDiagnosticoTemas(FILTROS, 'cardiologia', 'clinica-medica'), { wrapper });
    renderHook(() => useDiagnosticoTemas(FILTROS, 'cardiologia', 'cirurgia'), { wrapper });
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));

    const chavesFinais = chaves();
    expect(chavesFinais).toContainEqual(
      ['gestor', 'u1', 'diagnostico-temas', 'ies-1', '6ano', 'cardiologia', 'clinica-medica'],
    );
    expect(chavesFinais).toContainEqual(
      ['gestor', 'u1', 'diagnostico-temas', 'ies-1', '6ano', 'cardiologia', 'cirurgia'],
    );
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

  it('mantém o dado anterior na troca de filtro (placeholderData, React Query v5) — e sinaliza via isPlaceholderData (achado alto, revisão 03/08)', async () => {
    mockRpc.mockResolvedValue(envelope({ kpis: 'primeiro' }));
    const { result, rerender } = renderHook(
      ({ semestre }: { semestre: FiltrosGestor['semestre'] }) =>
        useVisaoGeral({ ...FILTROS, semestre }),
      { wrapper, initialProps: { semestre: '6ano' as const } },
    );
    await waitFor(() => expect(result.current.data).toEqual({ kpis: 'primeiro' }));
    expect(result.current.isPlaceholderData).toBe(false);

    let liberar: (v: unknown) => void = () => undefined;
    mockRpc.mockReturnValue(new Promise((resolve) => { liberar = resolve; }));
    rerender({ semestre: 'geral' as never });

    // Durante o fetch do novo recorte, a tela continua com o dado anterior —
    // mas agora `ResultadoGestor` PRECISA expor que esse dado é velho: sem
    // este sinal, o consumidor (VisaoGeral, ContextoDoRecorte) não tem como
    // saber que está olhando o recorte ANTERIOR sob o seletor já trocado.
    expect(result.current.data).toEqual({ kpis: 'primeiro' });
    expect(result.current.isPlaceholderData).toBe(true);
    liberar(envelope({ kpis: 'segundo' }));
    await waitFor(() => expect(result.current.data).toEqual({ kpis: 'segundo' }));
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it('useDiagnosticoTemas NÃO mantém o dado anterior ao trocar de especialidade — o parâmetro identifica o objeto exibido, "manter o anterior" nunca é o comportamento desejado (achado alto, revisão 03/08)', async () => {
    // Cenário do drawer: gestora fecha o drawer de Cardiologia e abre o de
    // Pneumologia. Se o hook mantivesse o dado anterior, `DrawerTemas`
    // renderizaria "Temas de Pneumologia" com os percentuais de Cardiologia
    // — e um clique em "Copiar resumo" nesse instante colaria essa mistura.
    mockRpc.mockResolvedValue(envelope([{ id: 't1', nome: 'Arritmias', acertoPct: 40, amostra: 12, lowSample: false }]));
    const { result, rerender } = renderHook(
      ({ especialidade }: { especialidade: string }) =>
        useDiagnosticoTemas(FILTROS, especialidade, 'clinica-medica'),
      { wrapper, initialProps: { especialidade: 'cardiologia' } },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    let liberar: (v: unknown) => void = () => undefined;
    mockRpc.mockReturnValue(new Promise((resolve) => { liberar = resolve; }));
    rerender({ especialidade: 'pneumologia' });

    // Enquanto os temas de Pneumologia carregam, NUNCA os de Cardiologia.
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    liberar(envelope([{ id: 't2', nome: 'DPOC', acertoPct: 55, amostra: 9, lowSample: false }]));
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0].nome).toBe('DPOC');
  });

  it('useAluno NÃO mantém o dado anterior ao trocar de aluno — alunoId identifica o objeto exibido, "manter o anterior" nunca é o comportamento desejado (achado alto, revisão 03/08)', async () => {
    // Se o hook mantivesse o dado anterior, o `DrawerAluno` mostraria as
    // notas/simulados de um aluno sob o nome/ficha de outro, transitoriamente.
    const entradaAna: AlunoSimuladoEntry = {
      id: 'aluno-7', nome: 'Ana', semestre: 6,
      simuladoId: 's1', simuladoNome: 'Simulado 1', simuladoData: '2026-01-01T00:00:00Z',
      participou: true, acertos: 40, proficiencia: 72, situacao: 'proficiente',
    };
    const entradaBia: AlunoSimuladoEntry = {
      id: 'aluno-9', nome: 'Bia', semestre: 6,
      simuladoId: 's1', simuladoNome: 'Simulado 1', simuladoData: '2026-01-01T00:00:00Z',
      participou: true, acertos: 30, proficiencia: 58, situacao: 'proficiente',
    };
    mockRpc.mockResolvedValue(envelope([entradaAna]));
    const { result, rerender } = renderHook(
      ({ alunoId }: { alunoId: string }) => useAluno(alunoId, ['s1']),
      { wrapper, initialProps: { alunoId: 'aluno-7' } },
    );
    await waitFor(() => expect(result.current.data?.[0]?.nome).toBe('Ana'));

    let liberar: (v: unknown) => void = () => undefined;
    mockRpc.mockReturnValue(new Promise((resolve) => { liberar = resolve; }));
    rerender({ alunoId: 'aluno-9' });

    // Enquanto a ficha de Bia carrega, NUNCA a de Ana.
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    liberar(envelope([entradaBia]));
    await waitFor(() => expect(result.current.data?.[0]?.nome).toBe('Bia'));
  });

  it('useAluno devolve um array tipado — a RPC materializa UMA ENTRADA POR SIMULADO (card 106)', async () => {
    // Forma real de `get_gestor_aluno` (migration 20260803150000): jsonb_agg
    // de uma linha por simulado do recorte, nunca um objeto singular. Tipado
    // DIRETO como `AlunoSimuladoEntry[]`, sem nenhum cast — a prova de que o
    // tipo de entrada (o gap do card 106: `simuladoId`/`simuladoNome`/
    // `simuladoData` presentes no tipo) agora existe em api/types.ts.
    const entradas: AlunoSimuladoEntry[] = [
      {
        id: 'aluno-7', nome: 'Ana', semestre: 6,
        simuladoId: 's1', simuladoNome: 'Simulado 1', simuladoData: '2026-01-01T00:00:00Z',
        participou: true, acertos: 40, proficiencia: 72, situacao: 'proficiente',
      },
      {
        id: 'aluno-7', nome: 'Ana', semestre: 6,
        simuladoId: 's2', simuladoNome: 'Simulado 2', simuladoData: '2026-02-01T00:00:00Z',
        participou: true, acertos: null, proficiencia: null, situacao: 'aguardando_resultado',
      },
    ];
    mockRpc.mockResolvedValue(envelope(entradas));
    const { result } = renderHook(() => useAluno('aluno-7', ['s1', 's2']), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(2);
    // Acesso direto a `.simuladoId`/`.situacao` sem cast — só compila porque
    // `result.current.data` já é `AlunoSimuladoEntry[] | undefined`.
    expect(result.current.data?.[0].simuladoId).toBe('s1');
    expect(result.current.data?.[0].simuladoNome).toBe('Simulado 1');
    expect(result.current.data?.[1].situacao).toBe('aguardando_resultado');

    // Prova de tipo (checada por `tsc`, não pelo runtime do vitest): se
    // `useAluno` voltasse a tipar `data` como `AlunoNoSimulado[]` (sem os
    // três campos de simulado), esta atribuição deixaria de compilar.
    type DadoDeAluno = ReturnType<typeof useAluno>['data'];
    const provaDeTipo: DadoDeAluno = entradas;
    void provaDeTipo;
  });

  it('logout→login na mesma aba NÃO serve o contexto do usuário anterior (card 107)', async () => {
    // Mesmo QueryClient (module-scoped, como em App.tsx) atravessando dois
    // usuários — reproduz "logout->login na mesma aba" sem limpar o cache.
    mockUseAuth.mockReturnValue({ user: { id: 'admin-1' } });
    mockRpc.mockResolvedValueOnce(
      envelope({
        usuario: { id: 'admin-1', nome: 'Admin', papel: 'admin' },
        iesDisponiveis: [{ id: 'ies-a', nome: 'A' }, { id: 'ies-b', nome: 'B' }],
      }),
    );
    const primeiro = renderHook(() => useGestorContexto(), { wrapper });
    await waitFor(() => expect(primeiro.result.current.isLoading).toBe(false));
    expect((primeiro.result.current.data as { iesDisponiveis: unknown[] }).iesDisponiveis).toHaveLength(2);
    primeiro.unmount();

    mockUseAuth.mockReturnValue({ user: { id: 'gestor-2' } });
    mockRpc.mockResolvedValueOnce(
      envelope({
        usuario: { id: 'gestor-2', nome: 'Beatriz', papel: 'gestor' },
        iesDisponiveis: [{ id: 'ies-c', nome: 'C' }],
      }),
    );
    const segundo = renderHook(() => useGestorContexto(), { wrapper });
    await waitFor(() => expect(segundo.result.current.isLoading).toBe(false));

    // Nova busca — não serviu do cache do usuário anterior.
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect((segundo.result.current.data as { usuario: { id: string } }).usuario.id).toBe('gestor-2');
    expect((segundo.result.current.data as { iesDisponiveis: unknown[] }).iesDisponiveis).toHaveLength(1);
  });

  it('staleTime tem efeito real: refetchOnMount e refetchOnWindowFocus ligados só no gestor (card 110)', async () => {
    mockRpc.mockResolvedValue(envelope({ usuario: { id: 'u1', nome: 'Ana', papel: 'gestor' } }));
    renderHook(() => useGestorContexto(), { wrapper });
    await waitFor(() => expect(useQuerySpy).toHaveBeenCalled());

    const opcoes = useQuerySpy.mock.calls[0][0] as Record<string, unknown>;
    // Sem isso, o staleTime de 5min é inerte: o QueryClient global (App.tsx)
    // desliga os três refetchOnX para o app inteiro.
    expect(opcoes.refetchOnMount).toBe(true);
    expect(opcoes.refetchOnWindowFocus).toBe(true);
    expect(opcoes.staleTime).toBe(GESTOR_STALE_TIME);
  });
});
