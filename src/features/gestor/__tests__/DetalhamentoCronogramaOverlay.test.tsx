import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import Detalhamento from '@/features/gestor/routes/Detalhamento';
import { useCronograma, useDetalhamento, useGestorContexto, useQuestoes } from '@/features/gestor/api/queries';
import type { ContextoGestor, ItemCronograma, Meta } from '@/features/gestor/api/types';

/**
 * O drawer do cronograma é o terceiro overlay do portal (junto com
 * `DrawerAluno` e `DrawerTemas`) e vinha com o fechar cru do shadcn: `X` do
 * Lucide, nome acessível "Close" e scrim `bg-black/80`. Este arquivo trava só
 * esse contrato visual/acessível — o comportamento do drawer (abrir pelo
 * atalho, fechar quando a URL troca de recorte) já é coberto por
 * `Detalhamento.test.tsx`, e mantê-los separados evita que dois agentes
 * disputem o mesmo arquivo.
 *
 * A rota é renderizada SEM simulado no recorte de propósito: aí ela cai no
 * estado vazio (§12 caso 4) e nenhum bloco pesado monta, mas a barra de
 * filtros — onde vive o "Ver cronograma" — continua na tela.
 */
vi.mock('@/features/gestor/api/queries', () => ({
  useCronograma: vi.fn(),
  useDetalhamento: vi.fn(),
  useQuestoes: vi.fn(),
  useGestorContexto: vi.fn(),
}));

vi.mock('@/features/gestor/components/FiltroSemestre', () => ({
  FiltroSemestre: () => <div data-testid="filtro-semestre" />,
}));

vi.mock('@/features/gestor/components/CronogramaSimulados', () => ({
  CronogramaSimulados: () => <div data-testid="cronograma-simulados" />,
}));

const META: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados SanarFlix',
  atualizadoEm: '2026-07-20T13:00:00Z',
  criterio: 'Proficiente = proficiência maior ou igual a 60',
  partial: false,
  lowSample: false,
};

const CONTEXTO: ContextoGestor = {
  usuario: { id: 'u1', nome: 'Ana', papel: 'gestor' },
  iesDisponiveis: [{ id: 'ies-1', nome: 'IES Alfa' }],
  iesAtual: { id: 'ies-1', nome: 'IES Alfa' },
  contrato: null,
  podeTrocarIes: false,
  podeExportar: true,
};

const CRONOGRAMA: ItemCronograma[] = [
  { id: 's1', nome: 'Simulado 1', data: '2026-03-10T13:00:00Z', status: 'realizado', modalidade: 'online', participantes: 40 },
];

const resultado = (data: unknown) =>
  ({
    data,
    meta: META,
    isLoading: false,
    isError: false,
    isPlaceholderData: false,
    isFetching: false,
    refetch: vi.fn(),
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useGestorContexto).mockReturnValue(resultado(CONTEXTO));
  vi.mocked(useCronograma).mockReturnValue(resultado(CRONOGRAMA));
  vi.mocked(useDetalhamento).mockReturnValue(resultado(undefined));
  vi.mocked(useQuestoes).mockReturnValue(resultado(undefined));
});

const renderRota = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/gestor/detalhamento?ies=ies-1&semestre=6ano']}>
        <TooltipProvider>
          <Detalhamento />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('Detalhamento · drawer do cronograma', () => {
  it('o fechar é do Dendê, anuncia "Fechar" e o scrim usa o token do portal', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { baseElement } = renderRota();

    await user.click(screen.getByRole('button', { name: 'Ver cronograma' }));
    expect(await screen.findByTestId('cronograma-simulados')).toBeInTheDocument();

    const fechar = screen.getByRole('button', { name: 'Fechar' });
    expect(fechar.querySelector('.icon-dende-icons-close-outlined')).not.toBeNull();
    expect(fechar.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    // Alvo de 30×30 com borda e raio 8px (handoff §4.5).
    expect(fechar.className).toContain('h-[30px]');
    expect(fechar.className).toContain('w-[30px]');
    expect(fechar.className).toContain('rounded-[8px]');

    const scrim = baseElement.querySelector('div.fixed.inset-0');
    expect(scrim?.className).toContain('bg-[var(--gp-scrim)]');
    expect(scrim?.className).not.toContain('bg-black/80');
  });
});
