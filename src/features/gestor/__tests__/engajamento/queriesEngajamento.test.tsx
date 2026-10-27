import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

import {
  buscarExportAlunos,
  buscarListaCompleta,
  useEngajamentoAluno,
  useEngajamentoAlunos,
  useEngajamentoConteudoAlunos,
  useEngajamentoConteudos,
  useEngajamentoLista,
  useEngajamentoQuestoes,
  useEngajamentoQuestoesAlunos,
  useEngajamentoVisaoGeral,
  type FiltrosRecorteEngajamento,
} from '@/features/gestor/api/engajamento';
import { useFiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';

/** Spec 2026-10-22-engajamento §8.11 (assinaturas) e §10.4 (hooks). */

const META = {
  periodo: '01/05/2026 a 22/10/2026',
  fonte: 'SanarFlix',
  atualizadoEm: '2026-10-22T09:02:41.5+00:00',
  criterio: 'Base ativa: …',
  partial: true,
  lowSample: false,
};
const envelope = (data: unknown) => ({ data: { data, meta: META }, error: null });

const F: FiltrosRecorteEngajamento = {
  iesId: 'ies-1',
  inicio: '2026-05-01',
  fim: '2026-10-22',
  semestre: null,
  alunoId: null,
  tipo: 'todos',
};

let queryClient: QueryClient;
const wrapperEm = (url = '/gestor/engajamento?ies=ies-1') =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
const wrapper = wrapperEm();

const chaves = () => queryClient.getQueryCache().getAll().map((q) => q.queryKey);

describe('hooks de RPC do Engajamento (spec §10.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('cada hook chama a sua RPC com os p_* EXATOS da §8.11 e a queryKey começa em gestor › user.id › engajamento', async () => {
    mockRpc.mockResolvedValue(envelope([]));
    const base = { p_ies_id: 'ies-1', p_inicio: '2026-05-01', p_fim: '2026-10-22' };

    const casos: Array<[string, () => unknown, string, unknown, unknown[]]> = [
      [
        'visao-geral',
        () => useEngajamentoVisaoGeral({ ...F, semestre: 8 }),
        'get_gestor_engajamento_visao_geral',
        { ...base, p_semestre: 8, p_aluno: null },
        ['gestor', 'u1', 'engajamento', 'visao-geral', 'ies-1', '2026-05-01', '2026-10-22', 8, null],
      ],
      [
        'visao-geral com aluno',
        () => useEngajamentoVisaoGeral({ ...F, alunoId: 'aluno-7' }),
        'get_gestor_engajamento_visao_geral',
        { ...base, p_semestre: null, p_aluno: 'aluno-7' },
        ['gestor', 'u1', 'engajamento', 'visao-geral', 'ies-1', '2026-05-01', '2026-10-22', null, 'aluno-7'],
      ],
      [
        'alunos',
        () => useEngajamentoAlunos(F, 'videos', 'asc', 'ana', true, 3),
        'get_gestor_engajamento_alunos',
        {
          ...base, p_semestre: null, p_ordem: 'videos', p_direcao: 'asc', p_busca: 'ana',
          p_sem_atividade_14d: true, p_page: 3, p_page_size: 20,
        },
        ['gestor', 'u1', 'engajamento', 'alunos', 'ies-1', '2026-05-01', '2026-10-22', null, 'videos', 'asc', 'ana', true, 3],
      ],
      [
        'lista',
        () => useEngajamentoLista({ ...F, semestre: 8 }, 'parou', 'bia', 2, 5),
        'get_gestor_engajamento_lista',
        {
          ...base, p_semestre: 8, p_aluno: null, p_categoria: 'parou', p_busca: 'bia',
          p_page: 2, p_page_size: 5,
        },
        ['gestor', 'u1', 'engajamento', 'lista', 'ies-1', '2026-05-01', '2026-10-22', 8, null, 'parou', 'bia', 2, 5],
      ],
      [
        'aluno',
        () => useEngajamentoAluno(F, 'aluno-7'),
        'get_gestor_engajamento_aluno',
        { ...base, p_aluno: 'aluno-7' },
        ['gestor', 'u1', 'engajamento', 'aluno', 'ies-1', '2026-05-01', '2026-10-22', 'aluno-7'],
      ],
      [
        'questoes',
        () => useEngajamentoQuestoes({ ...F, semestre: 4 }),
        'get_gestor_engajamento_questoes',
        { ...base, p_semestre: 4 },
        ['gestor', 'u1', 'engajamento', 'questoes', 'ies-1', '2026-05-01', '2026-10-22', 4],
      ],
      [
        'questoes-alunos',
        () => useEngajamentoQuestoesAlunos(F, 'folha-9'),
        'get_gestor_engajamento_questoes_alunos',
        { ...base, p_semestre: null, p_folha_id: 'folha-9' },
        ['gestor', 'u1', 'engajamento', 'questoes-alunos', 'ies-1', '2026-05-01', '2026-10-22', null, 'folha-9'],
      ],
      [
        'conteudos',
        () => useEngajamentoConteudos({ ...F, tipo: 'video' }),
        'get_gestor_engajamento_conteudos',
        { ...base, p_semestre: null, p_tipo: 'video' },
        ['gestor', 'u1', 'engajamento', 'conteudos', 'ies-1', '2026-05-01', '2026-10-22', null, 'video'],
      ],
      [
        'conteudo-alunos',
        () => useEngajamentoConteudoAlunos(F, { content_id: 'c1', especialidade: 'Infectologia', modulo: 'Tuberculose' }),
        'get_gestor_engajamento_conteudo_alunos',
        {
          ...base, p_semestre: null, p_content_id: 'c1', p_especialidade: 'Infectologia', p_modulo: 'Tuberculose',
        },
        ['gestor', 'u1', 'engajamento', 'conteudo-alunos', 'ies-1', '2026-05-01', '2026-10-22', null, 'c1', 'Infectologia', 'Tuberculose'],
      ],
    ];

    for (const [nome, hook, fn, args, chave] of casos) {
      mockRpc.mockClear();
      queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { result } = renderHook(hook as () => { isLoading: boolean }, { wrapper });
      await waitFor(() => expect(result.current.isLoading, nome).toBe(false));
      expect(mockRpc, `RPC de ${nome}`).toHaveBeenCalledTimes(1);
      expect(mockRpc, `RPC de ${nome}`).toHaveBeenCalledWith(fn, args);
      expect(chaves(), `queryKey de ${nome}`).toEqual([chave]);
    }
  });

  it('a queryKey leva "engajamento" e o id do usuário logado (nunca serve o cache de outro usuário)', async () => {
    mockRpc.mockResolvedValue(envelope({}));
    const { result } = renderHook(() => useEngajamentoQuestoes(F), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const [chave] = chaves();
    expect(chave).toContain('engajamento');
    expect(chave[1]).toBe('u1');
  });

  it('busca vazia ou só espaços vai como p_busca null (a RPC trata null como "sem busca")', async () => {
    mockRpc.mockResolvedValue(envelope({}));
    const { result } = renderHook(() => useEngajamentoAlunos(F, 'questoes', 'desc', '   ', false, 1), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect((mockRpc.mock.calls[0][1] as Record<string, unknown>).p_busca).toBeNull();
  });

  it('sem iesId, nenhum hook dispara', async () => {
    mockRpc.mockResolvedValue(envelope({}));
    const semIes = { ...F, iesId: null };
    const hooks: Array<() => { isLoading: boolean }> = [
      () => useEngajamentoVisaoGeral(semIes),
      () => useEngajamentoAlunos(semIes, 'questoes', 'desc', '', false, 1),
      () => useEngajamentoLista(semIes, 'parou', '', 1, 20),
      () => useEngajamentoAluno(semIes, 'aluno-7'),
      () => useEngajamentoQuestoes(semIes),
      () => useEngajamentoQuestoesAlunos(semIes, 'folha-9'),
      () => useEngajamentoConteudos(semIes),
      () => useEngajamentoConteudoAlunos(semIes, { content_id: 'c1', especialidade: 'e', modulo: 'm' }),
    ];
    for (const hook of hooks) {
      const { result } = renderHook(hook, { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    }
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('pop-ups e drawer só buscam com o objeto aberto (aluno, folha ou conteúdo nulos não disparam)', async () => {
    mockRpc.mockResolvedValue(envelope({}));
    const hooks: Array<() => { isLoading: boolean }> = [
      () => useEngajamentoAluno(F, null),
      () => useEngajamentoQuestoesAlunos(F, null),
      () => useEngajamentoConteudoAlunos(F, null),
    ];
    for (const hook of hooks) {
      const { result } = renderHook(hook, { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    }
    expect(mockRpc).not.toHaveBeenCalled();
  });

  describe('dado anterior na troca de filtro (manterDadoAnterior)', () => {
    it('visão geral, tabela, questões e conteúdos mantêm o dado anterior e sinalizam isPlaceholderData', async () => {
      mockRpc.mockResolvedValue(envelope({ kpis: 'primeiro' }));
      const { result, rerender } = renderHook(
        ({ semestre }: { semestre: number | null }) => useEngajamentoVisaoGeral({ ...F, semestre }),
        { wrapper, initialProps: { semestre: null as number | null } },
      );
      await waitFor(() => expect(result.current.data).toEqual({ kpis: 'primeiro' }));
      expect(result.current.isPlaceholderData).toBe(false);

      let liberar: (v: unknown) => void = () => undefined;
      mockRpc.mockReturnValue(new Promise((resolve) => { liberar = resolve; }));
      rerender({ semestre: 8 });

      expect(result.current.data).toEqual({ kpis: 'primeiro' });
      expect(result.current.isPlaceholderData).toBe(true);
      liberar(envelope({ kpis: 'segundo' }));
      await waitFor(() => expect(result.current.data).toEqual({ kpis: 'segundo' }));
      expect(result.current.isPlaceholderData).toBe(false);
    });

    it.each([
      ['useEngajamentoAlunos', (page: number) => useEngajamentoAlunos(F, 'questoes', 'desc', '', false, page)],
      ['useEngajamentoQuestoes', (sem: number) => useEngajamentoQuestoes({ ...F, semestre: sem })],
      ['useEngajamentoConteudos', (sem: number) => useEngajamentoConteudos({ ...F, semestre: sem })],
    ])('%s mantém o dado anterior', async (_nome, hook) => {
      mockRpc.mockResolvedValue(envelope({ marca: 'A' }));
      const { result, rerender } = renderHook(({ n }: { n: number }) => hook(n), {
        wrapper,
        initialProps: { n: 1 },
      });
      await waitFor(() => expect(result.current.data).toEqual({ marca: 'A' }));
      mockRpc.mockReturnValue(new Promise(() => undefined));
      rerender({ n: 2 });
      expect(result.current.data).toEqual({ marca: 'A' });
      expect(result.current.isPlaceholderData).toBe(true);
    });

    it.each([
      ['useEngajamentoLista', (alvo: string) => useEngajamentoLista(F, alvo as 'parou', '', 1, 20)],
      ['useEngajamentoAluno', (alvo: string) => useEngajamentoAluno(F, alvo)],
      ['useEngajamentoQuestoesAlunos', (alvo: string) => useEngajamentoQuestoesAlunos(F, alvo)],
      ['useEngajamentoConteudoAlunos', (alvo: string) =>
        useEngajamentoConteudoAlunos(F, { content_id: alvo, especialidade: 'e', modulo: 'm' })],
    ])('%s NÃO mantém o dado anterior: o parâmetro identifica o objeto exibido', async (_nome, hook) => {
      // Se mantivesse, o pop-up/drawer mostraria os dados de um aluno/nó/conteúdo sob o título de outro.
      mockRpc.mockResolvedValue(envelope({ marca: 'A' }));
      const { result, rerender } = renderHook(({ alvo }: { alvo: string }) => hook(alvo), {
        wrapper,
        initialProps: { alvo: 'parou' },
      });
      await waitFor(() => expect(result.current.data).toEqual({ marca: 'A' }));
      mockRpc.mockReturnValue(new Promise(() => undefined));
      rerender({ alvo: 'nunca' });
      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(true);
    });
  });

  it('propaga erro da RPC como isError', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'periodo_invalido' } });
    const { result } = renderHook(() => useEngajamentoVisaoGeral(F), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  describe('regra 8 da §9.6: aluno_fora_do_recorte limpa o aluno e recarrega', () => {
    const useCombinado = () => {
      const filtros = useFiltrosEngajamento();
      return { filtros, consulta: useEngajamentoVisaoGeral(filtros) };
    };

    it('um aluno de outra IES na URL é removido e a consulta é refeita sem p_aluno', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: null, error: { message: 'aluno_fora_do_recorte' } })
        .mockResolvedValue(envelope({ kpis: 'ok' }));
      const { result } = renderHook(useCombinado, {
        wrapper: wrapperEm('/gestor/engajamento?ies=ies-1&aluno=aluno-de-outra-ies'),
      });

      await waitFor(() => expect(result.current.filtros.alunoId).toBeNull());
      await waitFor(() => expect(result.current.consulta.data).toEqual({ kpis: 'ok' }));

      expect(mockRpc).toHaveBeenCalledTimes(2);
      expect((mockRpc.mock.calls[0][1] as Record<string, unknown>).p_aluno).toBe('aluno-de-outra-ies');
      expect((mockRpc.mock.calls[1][1] as Record<string, unknown>).p_aluno).toBeNull();
    });

    it('outros erros NÃO apagam o aluno', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Permission denied: cannot access this IES' } });
      const { result } = renderHook(useCombinado, {
        wrapper: wrapperEm('/gestor/engajamento?ies=ies-1&aluno=aluno-7'),
      });
      await waitFor(() => expect(result.current.consulta.isError).toBe(true));
      expect(result.current.filtros.alunoId).toBe('aluno-7');
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });
  });

  describe('funções assíncronas (não são hooks)', () => {
    it('buscarListaCompleta chama a lista com p_page_size 5000 e devolve a página inteira', async () => {
      const pagina = { categoria: 'parou', data: [{ id: 'a1' }], page: 1, pageSize: 5000, total: 1, totalPages: 1 };
      mockRpc.mockResolvedValue(envelope(pagina));
      const resultado = await buscarListaCompleta({ ...F, semestre: 8 }, 'parou', 'ana');
      expect(mockRpc).toHaveBeenCalledWith('get_gestor_engajamento_lista', {
        p_ies_id: 'ies-1', p_inicio: '2026-05-01', p_fim: '2026-10-22', p_semestre: 8, p_aluno: null,
        p_categoria: 'parou', p_busca: 'ana', p_page: 1, p_page_size: 5000,
      });
      expect(resultado).toEqual(pagina);
    });

    it('buscarExportAlunos chama a exportação com os mesmos filtros da tabela e devolve as linhas', async () => {
      const alunos = [{ nome: 'Ana', email: 'ana@x.com', semestre: 8 }];
      mockRpc.mockResolvedValue(envelope({ alunos }));
      const resultado = await buscarExportAlunos(F, 'documentos', 'asc', '', true);
      expect(mockRpc).toHaveBeenCalledWith('get_gestor_engajamento_export_alunos', {
        p_ies_id: 'ies-1', p_inicio: '2026-05-01', p_fim: '2026-10-22', p_semestre: null,
        p_ordem: 'documentos', p_direcao: 'asc', p_busca: null, p_sem_atividade_14d: true,
      });
      expect(resultado).toEqual(alunos);
    });

    it('sem IES, as duas funções recusam em vez de chamar a RPC com p_ies_id nulo', async () => {
      await expect(buscarListaCompleta({ ...F, iesId: null }, 'parou', '')).rejects.toThrow(/IES/);
      await expect(buscarExportAlunos({ ...F, iesId: null }, 'questoes', 'desc', '', false)).rejects.toThrow(/IES/);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('erro da RPC vira exceção com o nome da função', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'ordem_invalida' } });
      await expect(buscarExportAlunos(F, 'questoes', 'desc', '', false)).rejects.toThrow(
        /get_gestor_engajamento_export_alunos: ordem_invalida/,
      );
    });
  });
});
