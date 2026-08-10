// src/features/gestor/__tests__/DrawerTemasDetalhamento.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, userEvent, waitFor } from '@/test/utils';
import { DrawerTemasDetalhamento } from '@/features/gestor/components/DrawerTemasDetalhamento';
import { useDetalhamentoTemas, type NoDetalhamentoTemas } from '@/features/gestor/api/queries';
import { ATRASO_SKELETON_MS } from '@/features/gestor/hooks/useDelayedLoading';

vi.mock('@/features/gestor/api/queries', () => ({
  useDetalhamentoTemas: vi.fn(),
}));

const metaFake = {
  periodo: '2026.1',
  fonte: 'Simulados ENAMED SanarFlix',
  atualizadoEm: '2026-08-09T12:00:00.000Z',
  criterio: 'Desempenho em % de acerto',
  partial: false,
  lowSample: false,
};

const especialidades: NoDetalhamentoTemas[] = [
  {
    id: 'Cardiologia',
    nome: 'Cardiologia',
    nivel: 'especialidade',
    acertoPct: 41,
    desempenho: 'mediano',
    amostra: 118,
    respostas: 944,
    lowSample: false,
    temFilhos: true,
  },
  {
    id: 'Pneumologia',
    nome: 'Pneumologia',
    nivel: 'especialidade',
    acertoPct: 22,
    desempenho: 'critico',
    amostra: 7,
    respostas: 56,
    lowSample: true,
    temFilhos: false,
  },
];

const temas: NoDetalhamentoTemas[] = [
  {
    id: 'Insuficiência cardíaca',
    nome: 'Insuficiência cardíaca',
    nivel: 'tema',
    acertoPct: 30,
    desempenho: 'critico',
    amostra: 60,
    respostas: 480,
    lowSample: false,
    temFilhos: false,
  },
];

const area = { id: 'Clínica Médica', nome: 'Clínica Médica' };
const mockUseTemas = vi.mocked(useDetalhamentoTemas);

const resultado = (over: Record<string, unknown> = {}) => ({
  data: especialidades,
  meta: metaFake,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  ...over,
});

beforeEach(() => {
  mockUseTemas.mockReturnValue(resultado() as unknown as ReturnType<typeof useDetalhamentoTemas>);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('DrawerTemasDetalhamento', () => {
  it('não renderiza nada sem área selecionada', () => {
    render(
      <DrawerTemasDetalhamento area={null} iesId="ies-1" simulados={['s1']}
        semestre="geral" onFechar={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('chama o hook com iesId/simulados/grandeArea/semestre, sem especialidade no nível raiz', () => {
    render(
      <DrawerTemasDetalhamento area={area} iesId="ies-1" simulados={['s2', 's1']} semestre="geral" onFechar={vi.fn()} />,
    );
    expect(mockUseTemas).toHaveBeenCalledWith('ies-1', ['s2', 's1'], 'Clínica Médica', null, 'geral');
  });

  it('repassa o semestre do recorte ao hook e imprime o recorte no cabeçalho', () => {
    render(
      <DrawerTemasDetalhamento area={area} iesId="ies-1" simulados={['s1']} semestre="7" onFechar={vi.fn()} />,
    );
    expect(mockUseTemas).toHaveBeenCalledWith('ies-1', ['s1'], 'Clínica Médica', null, '7');
    expect(screen.getByTestId('drawer-detalhamento-recorte-semestre')).toHaveTextContent('7º semestre');
  });

  it('lista as especialidades da área, com % de acerto e nível', () => {
    render(
      <DrawerTemasDetalhamento area={area} iesId="ies-1" simulados={['s1']}
        semestre="geral" onFechar={vi.fn()} />,
    );
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveAccessibleName(/Especialidades de Clínica Médica/i);

    const linha = screen.getByTestId('detalhamento-no-Cardiologia');
    expect(linha).toHaveTextContent('Cardiologia');
    expect(linha).toHaveTextContent('41%');
  });

  it('marca cobertura parcial no nó com amostra pequena', () => {
    render(
      <DrawerTemasDetalhamento area={area} iesId="ies-1" simulados={['s1']}
        semestre="geral" onFechar={vi.fn()} />,
    );
    expect(screen.getByTestId('detalhamento-no-Pneumologia')).toHaveTextContent('cobertura parcial');
  });

  it('só a especialidade com temFilhos drila — a folha não é clicável', () => {
    render(
      <DrawerTemasDetalhamento area={area} iesId="ies-1" simulados={['s1']}
        semestre="geral" onFechar={vi.fn()} />,
    );
    const comFilhos = screen.getByTestId('detalhamento-no-Cardiologia');
    const semFilhos = screen.getByTestId('detalhamento-no-Pneumologia');

    expect(comFilhos.querySelector('button')).not.toBeNull();
    expect(semFilhos.querySelector('button')).toBeNull();
  });

  it('drila para temas ao clicar numa especialidade com temFilhos, e mostra "Voltar"', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    // `mockImplementation` (não `mockReturnValueOnce` encadeado) porque o
    // número de renders antes do clique não é garantido — a resposta certa
    // depende do 4º argumento (`especialidade`), não da ORDEM das chamadas.
    mockUseTemas.mockImplementation(
      (..._args: unknown[]) =>
        (_args[3] === null ? resultado() : resultado({ data: temas })) as unknown as ReturnType<
          typeof useDetalhamentoTemas
        >,
    );

    render(
      <DrawerTemasDetalhamento area={area} iesId="ies-1" simulados={['s1']}
        semestre="geral" onFechar={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /Cardiologia/ }));

    expect(mockUseTemas).toHaveBeenLastCalledWith('ies-1', ['s1'], 'Clínica Médica', 'Cardiologia', 'geral');
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Temas de Cardiologia em Clínica Médica/i);
    expect(screen.getByTestId('drawer-detalhamento-voltar')).toBeInTheDocument();

    await user.click(screen.getByTestId('drawer-detalhamento-voltar'));
    expect(screen.queryByTestId('drawer-detalhamento-voltar')).toBeNull();
  });

  it('trocar de área (novo clique em outra grande área) reseta para o nível raiz', () => {
    const { rerender } = render(
      <DrawerTemasDetalhamento area={area} iesId="ies-1" simulados={['s1']}
        semestre="geral" onFechar={vi.fn()} />,
    );

    rerender(
      <DrawerTemasDetalhamento
        area={{ id: 'Cirurgia', nome: 'Cirurgia' }}
        iesId="ies-1"
        simulados={['s1']}
        semestre="geral"
        onFechar={vi.fn()}
      />,
    );

    expect(mockUseTemas).toHaveBeenLastCalledWith('ies-1', ['s1'], 'Cirurgia', null, 'geral');
    expect(screen.queryByTestId('drawer-detalhamento-voltar')).toBeNull();
  });

  it('declara a proveniência do recorte a partir do meta do envelope', () => {
    render(
      <DrawerTemasDetalhamento area={area} iesId="ies-1" simulados={['s1']}
        semestre="geral" onFechar={vi.fn()} />,
    );
    const proveniencia = screen.getByTestId('detalhamento-temas-proveniencia');
    expect(proveniencia).toHaveTextContent(metaFake.periodo);
    expect(proveniencia).toHaveTextContent(metaFake.fonte);
  });

  it('fecha com ESC', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onFechar = vi.fn();
    render(
      <DrawerTemasDetalhamento area={area} iesId="ies-1" simulados={['s1']}
        semestre="geral" onFechar={onFechar} />,
    );
    await user.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('mostra estado vazio quando a área não tem especialidade com dado', () => {
    mockUseTemas.mockReturnValue(resultado({ data: [] }) as unknown as ReturnType<typeof useDetalhamentoTemas>);
    render(
      <DrawerTemasDetalhamento area={area} iesId="ies-1" simulados={['s1']}
        semestre="geral" onFechar={vi.fn()} />,
    );
    expect(screen.getByTestId('detalhamento-temas-vazio')).toHaveTextContent(
      'Sem especialidade com resultado neste recorte',
    );
  });

  describe('estados de carregamento e erro', () => {
    it('loading: antes dos 400ms não mostra skeleton (regra dos 400ms)', () => {
      mockUseTemas.mockReturnValue(
        resultado({ data: undefined, isLoading: true }) as unknown as ReturnType<typeof useDetalhamentoTemas>,
      );
      vi.useFakeTimers();
      render(
        <DrawerTemasDetalhamento area={area} iesId="ies-1" simulados={['s1']}
        semestre="geral" onFechar={vi.fn()} />,
      );
      expect(screen.queryByTestId('drawer-detalhamento-temas-skeleton')).not.toBeInTheDocument();
      expect(screen.queryByTestId('detalhamento-no-Cardiologia')).not.toBeInTheDocument();
    });

    it('loading: mostra skeleton acessível em grade 2×2 + barras, depois dos 400ms', () => {
      mockUseTemas.mockReturnValue(
        resultado({ data: undefined, isLoading: true }) as unknown as ReturnType<typeof useDetalhamentoTemas>,
      );
      vi.useFakeTimers();
      render(
        <DrawerTemasDetalhamento area={area} iesId="ies-1" simulados={['s1']}
        semestre="geral" onFechar={vi.fn()} />,
      );
      act(() => {
        vi.advanceTimersByTime(ATRASO_SKELETON_MS + 1);
      });
      expect(screen.getByTestId('drawer-detalhamento-temas-skeleton')).toBeInTheDocument();
      expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
      expect(screen.queryByTestId('detalhamento-no-Cardiologia')).not.toBeInTheDocument();
    });

    it('erro: mensagem com retry que refaz só esta consulta', async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockUseTemas.mockReturnValue(
        resultado({ data: undefined, isError: true, refetch }) as unknown as ReturnType<typeof useDetalhamentoTemas>,
      );
      render(
        <DrawerTemasDetalhamento area={area} iesId="ies-1" simulados={['s1']}
        semestre="geral" onFechar={vi.fn()} />,
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Tentar novamente/i }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });
});
